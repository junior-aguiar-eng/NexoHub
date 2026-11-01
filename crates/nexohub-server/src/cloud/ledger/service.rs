//! Transições de execução feitas pelo serviço (workers), sem token de participante. Cada operação é
//! uma única transação sobre reserva + contadores, então vaga, saldo e fence nunca divergem.
use super::{
    Account, BillingPeriod, CloudError, Holds, Ledger, Reservation, Units, add, default_doc, read,
    sub, write,
};
use crate::cloud::{
    jobs::{Lease, Proof, Reconciliation},
    providers::{Provider, ProviderDone, ProviderError},
    quotes::CloudTool,
};
use serde_json::json;

fn tool_of(units: &Units) -> CloudTool {
    if units.ocr_pages > 0 {
        CloudTool::Ocr
    } else if units.characters > 0 {
        CloudTool::TranslateText
    } else {
        CloudTool::OfficeToPdf
    }
}
fn tool_name(tool: CloudTool) -> &'static str {
    match tool {
        CloudTool::Ocr => "ocr",
        CloudTool::TranslateText => "translate-text",
        CloudTool::OfficeToPdf => "office-to-pdf",
    }
}

enum Claimed {
    Granted(u64),
    Reconcile,
    QueueExpired,
}
pub enum Finished {
    Settled(ProviderDone),
    Failed,
    Reconcile,
}

fn valid_id(id: &str) -> Result<(), CloudError> {
    if id.len() == 64 && id.bytes().all(|c| c.is_ascii_hexdigit()) {
        Ok(())
    } else {
        Err(CloudError::InvalidRequest)
    }
}

/// Libera vaga, reserva financeira e unidades de um job (queued ou com vaga ocupada).
fn release(job: &Reservation, gh: &mut Holds, uh: &mut Holds) -> Result<(), CloudError> {
    if job.state == "queued" {
        gh.queued = sub(gh.queued, 1)?;
        uh.queued = sub(uh.queued, 1)?;
    } else {
        gh.running = sub(gh.running, 1)?;
        uh.running = sub(uh.running, 1)?;
    }
    gh.reserved_usd_micros = sub(gh.reserved_usd_micros, job.maximum_usd_micros)?;
    uh.reserved_usd_micros = sub(uh.reserved_usd_micros, job.maximum_usd_micros)?;
    gh.units = gh.units.sub(&job.units)?;
    uh.units = uh.units.sub(&job.units)?;
    Ok(())
}
fn is_final(state: &str) -> bool {
    matches!(state, "settled" | "failed" | "cancelled")
}

impl Ledger {
    fn lease_seconds(&self, tool: CloudTool) -> u64 {
        30 + match tool {
            CloudTool::Ocr => self.policy.ocr.timeout_seconds,
            CloudTool::TranslateText => self.policy.translation.timeout_seconds,
            CloudTool::OfficeToPdf => self.policy.office.timeout_seconds,
        }
    }

    /// Executa `apply` numa transação com os documentos de contagem e a reserva.
    fn service_tx<T>(
        &self,
        participant: &str,
        id: &str,
        now: u64,
        with_usage: bool,
        apply: impl Fn(
            &mut Reservation,
            &mut Holds,
            &mut Holds,
            Option<(&mut Account, &mut Account)>,
            &BillingPeriod,
        ) -> Result<T, CloudError>,
    ) -> Result<T, CloudError> {
        valid_id(id)?;
        self.policy
            .validate()
            .map_err(|_| CloudError::Unavailable)?;
        let period = BillingPeriod::at(now)?;
        let (path, holds) = (
            format!("reservations/{id}"),
            format!("participants/{participant}/state/holds"),
        );
        let global = format!("periods/{}", period.id);
        let account = format!("periods/{}/participants/{participant}", period.id);
        let audit = format!("audit/{id}-service");
        let mut paths = vec![
            "pilot/holds".to_owned(),
            holds.clone(),
            path.clone(),
            audit.clone(),
        ];
        if with_usage {
            paths.push(global.clone());
            paths.push(account.clone());
        }
        self.store.transact(&paths, |docs| {
            let mut job: Reservation = read(docs, &path)?;
            if job.participant_id != participant {
                return Err(CloudError::NotAdmitted);
            }
            let mut gh: Holds = default_doc(docs, "pilot/holds")?;
            let mut uh: Holds = default_doc(docs, &holds)?;
            let result = if with_usage {
                let mut g: Account = default_doc(docs, &global)?;
                let mut a: Account = default_doc(docs, &account)?;
                let r = apply(&mut job, &mut gh, &mut uh, Some((&mut g, &mut a)), &period)?;
                write(docs, &global, &g)?;
                write(docs, &account, &a)?;
                r
            } else {
                apply(&mut job, &mut gh, &mut uh, None, &period)?
            };
            write(docs, "pilot/holds", &gh)?;
            write(docs, &holds, &uh)?;
            write(docs, &path, &job)?;
            docs.insert(
                audit.clone(),
                json!({"kind":"service","state":job.state,"at":now}),
            );
            Ok(result)
        })
    }

    /// Assume o job com lease e fence. Reentrega, segundo worker e lease vigente recebem `Busy`.
    pub fn claim_job(&self, participant: &str, id: &str, now: u64) -> Result<Lease, CloudError> {
        let outcome = self.service_tx(participant, id, now, false, |job, gh, uh, _, period| {
            let tool = tool_of(&job.units);
            match job.state.as_str() {
                "queued" => {
                    if now.saturating_sub(job.enqueued_at) > self.policy.timing.queue_seconds {
                        release(job, gh, uh)?;
                        job.state = "cancelled".into();
                        job.dispatch_pending = false;
                        return Ok(Claimed::QueueExpired);
                    }
                    let prefix = format!("{}:", tool_name(tool));
                    if gh.quarantined.iter().any(|q| q.starts_with(&prefix)) {
                        return Err(CloudError::Busy);
                    }
                    if job.period != period.id
                        || period.ends_at.saturating_sub(now)
                            <= self.policy.timing.month_guard_seconds
                    {
                        return Err(CloudError::Conflict);
                    }
                    if gh.running >= self.policy.concurrency.global_running
                        || uh.running >= self.policy.concurrency.participant_running
                    {
                        return Err(CloudError::Busy);
                    }
                    gh.queued = sub(gh.queued, 1)?;
                    uh.queued = sub(uh.queued, 1)?;
                    gh.running = add(gh.running, 1)?;
                    uh.running = add(uh.running, 1)?;
                    job.state = "running".into();
                    job.dispatch_pending = false;
                    job.fence = add(job.fence, 1)?;
                    job.lease_until = now + self.lease_seconds(tool);
                    Ok(Claimed::Granted(job.fence))
                }
                "running" => {
                    if now < job.lease_until {
                        return Err(CloudError::Busy);
                    }
                    if job.external_started {
                        // Lease vencido depois de iniciar a chamada: não repetir nem liberar a vaga.
                        job.state = "needs_reconciliation".into();
                        job.unknown_since.get_or_insert(now);
                        return Ok(Claimed::Reconcile);
                    }
                    job.fence = add(job.fence, 1)?;
                    job.lease_until = now + self.lease_seconds(tool);
                    Ok(Claimed::Granted(job.fence))
                }
                "needs_reconciliation" => Ok(Claimed::Reconcile),
                _ => Err(CloudError::Conflict),
            }
        })?;
        match outcome {
            Claimed::Granted(fence) => Ok(Lease {
                job_id: id.into(),
                fence,
            }),
            Claimed::Reconcile => Err(CloudError::ReconciliationRequired),
            Claimed::QueueExpired => Err(CloudError::Busy),
        }
    }

    /// Persiste a intenção ANTES da chamada externa; depois disso ela nunca é repetida.
    pub fn begin_external(
        &self,
        participant: &str,
        lease: &Lease,
        now: u64,
    ) -> Result<(), CloudError> {
        self.service_tx(participant, &lease.job_id, now, false, |job, _, _, _, _| {
            if job.state != "running"
                || job.fence != lease.fence
                || now >= job.lease_until
                || job.external_started
            {
                return Err(CloudError::Conflict);
            }
            job.external_started = true;
            Ok(())
        })
    }

    /// Resultado da chamada. Fence antigo ou estado final recusa; custo acima do reservado reconcilia.
    pub fn finish_external(
        &self,
        participant: &str,
        lease: &Lease,
        result: Result<ProviderDone, ProviderError>,
        now: u64,
    ) -> Result<Finished, CloudError> {
        self.service_tx(
            participant,
            &lease.job_id,
            now,
            true,
            |job, gh, uh, usage, period| {
                if job.fence != lease.fence || is_final(&job.state) {
                    return Err(CloudError::Conflict);
                }
                let tool = tool_name(tool_of(&job.units));
                match result {
                    Ok(done)
                        if done.cost_usd_micros <= job.maximum_usd_micros
                            && job.period == period.id =>
                    {
                        let (g, a) = usage.ok_or(CloudError::Unavailable)?;
                        settle(job, gh, uh, g, a, done.cost_usd_micros)?;
                        gh.quarantined
                            .retain(|q| *q != format!("{tool}:{}", job.id));
                        Ok(Finished::Settled(done))
                    }
                    Err(ProviderError::Rejected) => {
                        release(job, gh, uh)?;
                        job.state = "failed".into();
                        gh.quarantined
                            .retain(|q| *q != format!("{tool}:{}", job.id));
                        Ok(Finished::Failed)
                    }
                    _ => {
                        job.state = "needs_reconciliation".into();
                        job.unknown_since.get_or_insert(now);
                        Ok(Finished::Reconcile)
                    }
                }
            },
        )
    }

    /// Fluxo completo de um worker: claim já feito; marca, chama o provedor sem lock e registra.
    pub fn execute(
        &self,
        participant: &str,
        lease: &Lease,
        provider: &dyn Provider,
        now: u64,
    ) -> Result<ProviderDone, CloudError> {
        self.begin_external(participant, lease, now)?;
        let stored = self
            .store
            .get(&format!("reservations/{}", lease.job_id))?
            .ok_or(CloudError::InvalidRequest)?;
        let job: Reservation =
            serde_json::from_value(stored).map_err(|_| CloudError::Unavailable)?;
        let tool = tool_of(&job.units);
        let result = provider.invoke(&lease.job_id, tool);
        match self.finish_external(participant, lease, result, now)? {
            Finished::Settled(done) => Ok(done),
            Finished::Failed => Err(CloudError::Unavailable),
            Finished::Reconcile => Err(CloudError::ReconciliationRequired),
        }
    }

    /// Estado do job para o próprio participante; de outro dono, responde como inexistente.
    pub fn job_state(&self, participant: &str, id: &str) -> Result<String, CloudError> {
        valid_id(id)?;
        let stored = self
            .store
            .get(&format!("reservations/{id}"))?
            .ok_or(CloudError::InvalidRequest)?;
        let job: Reservation =
            serde_json::from_value(stored).map_err(|_| CloudError::Unavailable)?;
        if job.participant_id != participant {
            return Err(CloudError::InvalidRequest);
        }
        Ok(job.state)
    }

    pub fn cancel_job(&self, participant: &str, id: &str, now: u64) -> Result<(), CloudError> {
        self.service_tx(participant, id, now, false, |job, gh, uh, _, _| {
            match job.state.as_str() {
                "cancelled" => Ok(()),
                "queued" => {
                    release(job, gh, uh)?;
                    job.state = "cancelled".into();
                    job.dispatch_pending = false;
                    Ok(())
                }
                "running" if !job.external_started => {
                    release(job, gh, uh)?;
                    job.state = "cancelled".into();
                    job.fence = add(job.fence, 1)?; // invalida quem ainda segura o lease
                    Ok(())
                }
                // Depois da chamada externa o custo é mantido até haver prova.
                _ => Err(CloudError::Conflict),
            }
        })
    }

    pub fn reconcile_job(
        &self,
        participant: &str,
        id: &str,
        proof: Option<Proof>,
        now: u64,
    ) -> Result<Reconciliation, CloudError> {
        self.service_tx(participant, id, now, true, |job, gh, uh, usage, period| {
            if is_final(&job.state) {
                return Ok(Reconciliation::AlreadyFinal);
            }
            if job.state == "running" && job.external_started && now >= job.lease_until {
                job.state = "needs_reconciliation".into();
                job.unknown_since.get_or_insert(now);
            }
            if job.state != "needs_reconciliation" {
                return Err(CloudError::Conflict);
            }
            let entry = format!("{}:{}", tool_name(tool_of(&job.units)), job.id);
            match proof {
                Some(Proof::Completed(cost)) => {
                    if cost > job.maximum_usd_micros {
                        return Err(CloudError::InvalidRequest);
                    }
                    if job.period != period.id {
                        return Err(CloudError::Conflict);
                    }
                    let (g, a) = usage.ok_or(CloudError::Unavailable)?;
                    settle(job, gh, uh, g, a, cost)?;
                }
                Some(Proof::NotConsumed) => {
                    release(job, gh, uh)?;
                    job.state = "failed".into();
                }
                None => {
                    let since = job.unknown_since.unwrap_or(now);
                    if now.saturating_sub(since)
                        >= self.policy.timing.unknown_provider_quarantine_seconds
                    {
                        if !gh.quarantined.contains(&entry) {
                            gh.quarantined.push(entry);
                        }
                        return Ok(Reconciliation::Quarantined);
                    }
                    return Ok(Reconciliation::Pending);
                }
            }
            gh.quarantined.retain(|q| *q != entry);
            Ok(Reconciliation::Resolved)
        })
    }
}

fn settle(
    job: &mut Reservation,
    gh: &mut Holds,
    uh: &mut Holds,
    global: &mut Account,
    account: &mut Account,
    cost: u64,
) -> Result<(), CloudError> {
    release(job, gh, uh)?;
    global.used_usd_micros = add(global.used_usd_micros, cost)?;
    account.used_usd_micros = add(account.used_usd_micros, cost)?;
    global.used = global.used.add(&job.units)?;
    account.used = account.used.add(&job.units)?;
    job.state = "settled".into();
    job.actual_usd_micros = Some(cost);
    job.dispatch_pending = false;
    Ok(())
}
