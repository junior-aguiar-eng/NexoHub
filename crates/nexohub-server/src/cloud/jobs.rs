//! Máquina de estados de execução: claim com fencing, vagas distribuídas, reconciliação.
//! Invariante central: depois de marcada a chamada externa, ela nunca é repetida para o mesmo job.
//! Ainda sem ligação ao ledger Firestore nem a adapters reais.
use super::{
    CloudError,
    policy::CloudPolicy,
    providers::{Provider, ProviderDone, ProviderError},
    quotes::CloudTool,
};
use std::{
    collections::{HashMap, HashSet},
    sync::Mutex,
};

const LEASE_MARGIN_SECONDS: u64 = 30;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum JobState {
    Queued,
    Running,
    NeedsReconciliation,
    Settled,
    Failed,
    Cancelled,
}
impl JobState {
    fn holds_slot(self) -> bool {
        matches!(self, Self::Running | Self::NeedsReconciliation)
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Lease {
    pub job_id: String,
    pub fence: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Proof {
    Completed(u64),
    NotConsumed,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Reconciliation {
    Resolved,
    Pending,
    Quarantined,
    AlreadyFinal,
}

struct Job {
    participant: String,
    tool: CloudTool,
    maximum: u64,
    state: JobState,
    fence: u64,
    lease_until: u64,
    external_started: bool,
    enqueued_at: u64,
    unknown_since: Option<u64>,
    cost: Option<u64>,
}

#[derive(Default)]
struct Inner {
    jobs: HashMap<String, Job>,
    quarantined: HashSet<CloudTool>,
}

pub struct JobEngine {
    policy: CloudPolicy,
    inner: Mutex<Inner>,
}

impl JobEngine {
    pub fn new(policy: CloudPolicy) -> Self {
        Self {
            policy,
            inner: Mutex::default(),
        }
    }
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Inner>, CloudError> {
        self.inner.lock().map_err(|_| CloudError::Unavailable)
    }
    fn lease_seconds(&self, tool: CloudTool) -> u64 {
        LEASE_MARGIN_SECONDS
            + match tool {
                CloudTool::Ocr => self.policy.ocr.timeout_seconds,
                CloudTool::TranslateText => self.policy.translation.timeout_seconds,
                CloudTool::OfficeToPdf => self.policy.office.timeout_seconds,
            }
    }

    /// Idempotente: reentrega da mesma mensagem não cria outro job.
    pub fn enqueue(
        &self,
        id: &str,
        participant: &str,
        tool: CloudTool,
        maximum_usd_micros: u64,
        now: u64,
    ) -> Result<(), CloudError> {
        let mut g = self.lock()?;
        if let Some(job) = g.jobs.get(id) {
            return if job.participant == participant && job.tool == tool {
                Ok(())
            } else {
                Err(CloudError::Conflict)
            };
        }
        g.jobs.insert(
            id.into(),
            Job {
                participant: participant.into(),
                tool,
                maximum: maximum_usd_micros,
                state: JobState::Queued,
                fence: 0,
                lease_until: 0,
                external_started: false,
                enqueued_at: now,
                unknown_since: None,
                cost: None,
            },
        );
        Ok(())
    }

    pub fn state(&self, id: &str) -> Result<JobState, CloudError> {
        self.lock()?
            .jobs
            .get(id)
            .map(|j| j.state)
            .ok_or(CloudError::InvalidRequest)
    }
    pub fn held_slots(&self) -> usize {
        self.lock()
            .map(|g| g.jobs.values().filter(|j| j.state.holds_slot()).count())
            .unwrap_or(usize::MAX)
    }
    pub fn dispatch_pending(&self) -> Vec<String> {
        let mut ids: Vec<_> = self
            .lock()
            .map(|g| {
                g.jobs
                    .iter()
                    .filter(|(_, j)| j.state == JobState::Queued)
                    .map(|(k, _)| k.clone())
                    .collect()
            })
            .unwrap_or_default();
        ids.sort();
        ids
    }

    pub fn claim(&self, id: &str, now: u64) -> Result<Lease, CloudError> {
        let mut g = self.lock()?;
        let (state, tool, participant) = {
            let j = g.jobs.get(id).ok_or(CloudError::InvalidRequest)?;
            (j.state, j.tool, j.participant.clone())
        };
        let lease_seconds = self.lease_seconds(tool);
        match state {
            JobState::Running => {
                let j = g.jobs.get_mut(id).ok_or(CloudError::InvalidRequest)?;
                if now < j.lease_until {
                    return Err(CloudError::Busy);
                }
                if j.external_started {
                    // Lease vencido depois de iniciar a chamada: não repetir nem liberar a vaga.
                    j.state = JobState::NeedsReconciliation;
                    j.unknown_since.get_or_insert(now);
                    return Err(CloudError::ReconciliationRequired);
                }
                j.fence += 1;
                j.lease_until = now + lease_seconds;
                Ok(Lease {
                    job_id: id.into(),
                    fence: j.fence,
                })
            }
            JobState::NeedsReconciliation => Err(CloudError::ReconciliationRequired),
            JobState::Queued => {
                if now.saturating_sub(g.jobs[id].enqueued_at) > self.policy.timing.queue_seconds {
                    g.jobs.get_mut(id).ok_or(CloudError::InvalidRequest)?.state =
                        JobState::Cancelled;
                    return Err(CloudError::Busy);
                }
                if g.quarantined.contains(&tool) {
                    return Err(CloudError::Busy);
                }
                let held = g.jobs.values().filter(|j| j.state.holds_slot());
                let (global, mine) = held.fold((0, 0), |(a, b), j| {
                    (a + 1, b + u64::from(j.participant == participant))
                });
                if global >= self.policy.concurrency.global_running
                    || mine >= self.policy.concurrency.participant_running
                {
                    return Err(CloudError::Busy);
                }
                let j = g.jobs.get_mut(id).ok_or(CloudError::InvalidRequest)?;
                j.state = JobState::Running;
                j.fence += 1;
                j.lease_until = now + lease_seconds;
                Ok(Lease {
                    job_id: id.into(),
                    fence: j.fence,
                })
            }
            _ => Err(CloudError::Conflict),
        }
    }

    pub fn execute(
        &self,
        lease: &Lease,
        provider: &dyn Provider,
        now: u64,
    ) -> Result<ProviderDone, CloudError> {
        let tool = {
            let mut g = self.lock()?;
            let j = g
                .jobs
                .get_mut(&lease.job_id)
                .ok_or(CloudError::InvalidRequest)?;
            if j.state != JobState::Running
                || j.fence != lease.fence
                || now >= j.lease_until
                || j.external_started
            {
                return Err(CloudError::Conflict);
            }
            // Persistir a intenção ANTES da chamada: reinício aqui nunca repete a cobrança.
            j.external_started = true;
            j.tool
        };
        let result = provider.invoke(&lease.job_id, tool); // sem lock durante a chamada
        let mut g = self.lock()?;
        let j = g
            .jobs
            .get_mut(&lease.job_id)
            .ok_or(CloudError::InvalidRequest)?;
        if j.fence != lease.fence || j.state.is_final() {
            return Err(CloudError::Conflict);
        }
        match result {
            Ok(done) if done.cost_usd_micros <= j.maximum => {
                j.state = JobState::Settled;
                j.cost = Some(done.cost_usd_micros);
                Self::lift_quarantine(&mut g, tool);
                Ok(done)
            }
            Ok(_) => {
                // Custo acima do máximo reservado não é liquidado sem revisão.
                j.state = JobState::NeedsReconciliation;
                j.unknown_since.get_or_insert(now);
                Err(CloudError::ReconciliationRequired)
            }
            Err(ProviderError::Rejected) => {
                j.state = JobState::Failed;
                Err(CloudError::Unavailable)
            }
            Err(ProviderError::Unknown) => {
                j.state = JobState::NeedsReconciliation;
                j.unknown_since.get_or_insert(now);
                Err(CloudError::ReconciliationRequired)
            }
        }
    }

    pub fn cancel(&self, id: &str) -> Result<(), CloudError> {
        let mut g = self.lock()?;
        let j = g.jobs.get_mut(id).ok_or(CloudError::InvalidRequest)?;
        match j.state {
            JobState::Cancelled => Ok(()),
            JobState::Queued => {
                j.state = JobState::Cancelled;
                Ok(())
            }
            JobState::Running if !j.external_started => {
                j.state = JobState::Cancelled;
                j.fence += 1; // invalida o worker que ainda segura o lease
                Ok(())
            }
            // Depois da chamada externa o custo é mantido até haver prova.
            _ => Err(CloudError::Conflict),
        }
    }

    /// Prova do provedor/faturamento ou verificação periódica sem prova.
    pub fn reconcile(
        &self,
        id: &str,
        proof: Option<Proof>,
        now: u64,
    ) -> Result<Reconciliation, CloudError> {
        let mut g = self.lock()?;
        let j = g.jobs.get_mut(id).ok_or(CloudError::InvalidRequest)?;
        if j.state.is_final() {
            return Ok(Reconciliation::AlreadyFinal); // status atrasado não reabre nem altera
        }
        if j.state == JobState::Running && j.external_started && now >= j.lease_until {
            j.state = JobState::NeedsReconciliation;
            j.unknown_since.get_or_insert(now);
        }
        if j.state != JobState::NeedsReconciliation {
            return Err(CloudError::Conflict);
        }
        let tool = j.tool;
        match proof {
            Some(Proof::Completed(cost)) => {
                if cost > j.maximum {
                    return Err(CloudError::InvalidRequest);
                }
                j.state = JobState::Settled;
                j.cost = Some(cost);
            }
            Some(Proof::NotConsumed) => j.state = JobState::Failed,
            None => {
                let since = j.unknown_since.unwrap_or(now);
                if now.saturating_sub(since)
                    >= self.policy.timing.unknown_provider_quarantine_seconds
                {
                    g.quarantined.insert(tool);
                    return Ok(Reconciliation::Quarantined);
                }
                return Ok(Reconciliation::Pending);
            }
        }
        Self::lift_quarantine(&mut g, tool);
        Ok(Reconciliation::Resolved)
    }

    fn lift_quarantine(g: &mut Inner, tool: CloudTool) {
        if !g
            .jobs
            .values()
            .any(|j| j.tool == tool && j.state == JobState::NeedsReconciliation)
        {
            g.quarantined.remove(&tool);
        }
    }
}
impl JobState {
    fn is_final(self) -> bool {
        matches!(self, Self::Settled | Self::Failed | Self::Cancelled)
    }
}
