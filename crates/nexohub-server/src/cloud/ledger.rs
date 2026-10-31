//! Reservas de metadados persistentes. Não executa motores nem admite chamadas por HTTP.
use super::{
    CloudError,
    admission::{AdmissionService, Participant, hash, read, write},
    auth::VerifiedIdentity,
    firestore::FirestoreStore,
    policy::CloudPolicy,
};
use chrono::{Datelike, TimeZone, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::BTreeMap, sync::Arc};

#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Units {
    pub ocr_pages: u64,
    pub characters: u64,
    pub office_files: u64,
}
impl Units {
    fn add(&self, other: &Self) -> Result<Self, CloudError> {
        Ok(Self {
            ocr_pages: add(self.ocr_pages, other.ocr_pages)?,
            characters: add(self.characters, other.characters)?,
            office_files: add(self.office_files, other.office_files)?,
        })
    }
    fn sub(&self, other: &Self) -> Result<Self, CloudError> {
        Ok(Self {
            ocr_pages: sub(self.ocr_pages, other.ocr_pages)?,
            characters: sub(self.characters, other.characters)?,
            office_files: sub(self.office_files, other.office_files)?,
        })
    }
    pub fn validate(&self, policy: &CloudPolicy) -> Result<(), CloudError> {
        if [self.ocr_pages, self.characters, self.office_files]
            .iter()
            .filter(|n| **n > 0)
            .count()
            != 1
            || self.ocr_pages > policy.ocr.max_pages
            || self.characters > policy.translation.max_characters
            || self.office_files > 1
        {
            return Err(CloudError::InvalidRequest);
        }
        Ok(())
    }
}
fn add(a: u64, b: u64) -> Result<u64, CloudError> {
    a.checked_add(b).ok_or(CloudError::Unavailable)
}
fn sub(a: u64, b: u64) -> Result<u64, CloudError> {
    a.checked_sub(b).ok_or(CloudError::Unavailable)
}

pub struct BillingPeriod {
    pub id: String,
    pub ends_at: u64,
}
impl BillingPeriod {
    pub fn at(now: u64) -> Result<Self, CloudError> {
        let timestamp = i64::try_from(now).map_err(|_| CloudError::InvalidRequest)?;
        let local = chrono::DateTime::<Utc>::from_timestamp(timestamp, 0)
            .ok_or(CloudError::InvalidRequest)?
            .with_timezone(&chrono_tz::America::Los_Angeles);
        let (year, month) = if local.month() == 12 {
            (
                local
                    .year()
                    .checked_add(1)
                    .ok_or(CloudError::InvalidRequest)?,
                1,
            )
        } else {
            (local.year(), local.month() + 1)
        };
        let next = chrono_tz::America::Los_Angeles
            .with_ymd_and_hms(year, month, 1, 0, 0, 0)
            .single()
            .ok_or(CloudError::InvalidRequest)?;
        Ok(Self {
            id: local.format("%Y-%m").to_string(),
            ends_at: u64::try_from(next.timestamp()).map_err(|_| CloudError::InvalidRequest)?,
        })
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Reservation {
    pub id: String,
    pub participant_id: String,
    pub period: String,
    pub units: Units,
    pub maximum_usd_micros: u64,
    pub state: String,
    pub dispatch_pending: bool,
    fingerprint: String,
    actual_usd_micros: Option<u64>,
}
/// Entrada interna do servidor: o custo é calculado por pricing/quotes, nunca aceito do cliente.
#[derive(Clone)]
pub struct ReservationRequest {
    pub key: String,
    pub input_digest: String,
    pub units: Units,
    pub maximum_usd_micros: u64,
}

#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Account {
    used_usd_micros: u64,
    used: Units,
}
#[derive(Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Holds {
    reserved_usd_micros: u64,
    units: Units,
    queued: u64,
    running: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Usage {
    pub used_usd_micros: u64,
    pub reserved_usd_micros: u64,
    pub remaining_usd_micros: u64,
    pub used: Units,
    pub reserved: Units,
    pub reset_at: u64,
}

fn default_doc<T: serde::de::DeserializeOwned + Default>(
    docs: &BTreeMap<String, Value>,
    path: &str,
) -> Result<T, CloudError> {
    if docs.contains_key(path) {
        read(docs, path)
    } else {
        Ok(T::default())
    }
}

pub struct Ledger {
    store: Arc<FirestoreStore>,
    policy: CloudPolicy,
}
struct Paths {
    global: String,
    account: String,
    member: String,
    binding: String,
    holds: String,
}
impl Paths {
    fn new(id: &str, identity: &VerifiedIdentity, period: &BillingPeriod) -> Self {
        Self {
            global: format!("periods/{}", period.id),
            account: format!("periods/{}/participants/{id}", period.id),
            member: format!("participants/{id}"),
            binding: format!("identities/{}", hash(identity.uid())),
            holds: format!("participants/{id}/state/holds"),
        }
    }
    fn all(&self) -> Vec<String> {
        vec![
            self.global.clone(),
            self.account.clone(),
            self.member.clone(),
            self.binding.clone(),
            self.holds.clone(),
            "pilot/holds".into(),
        ]
    }
    fn authorize(
        &self,
        docs: &BTreeMap<String, Value>,
        identity: &VerifiedIdentity,
        id: &str,
    ) -> Result<(), CloudError> {
        if docs
            .get(&self.binding)
            .and_then(|v| v["participantId"].as_str())
            != Some(id)
        {
            return Err(CloudError::NotAdmitted);
        }
        let member: Participant = read(docs, &self.member)?;
        member.check(identity)
    }
}

impl Ledger {
    pub fn new(store: Arc<FirestoreStore>, policy: CloudPolicy) -> Self {
        Self { store, policy }
    }
    fn context(
        &self,
        identity: &VerifiedIdentity,
        now: u64,
    ) -> Result<(Participant, BillingPeriod, Paths), CloudError> {
        identity.check_at(now)?;
        self.policy
            .validate()
            .map_err(|_| CloudError::Unavailable)?;
        let member =
            AdmissionService::new(self.store.clone(), self.policy.clone()).member(identity)?;
        let period = BillingPeriod::at(now)?;
        let paths = Paths::new(&member.id, identity, &period);
        Ok((member, period, paths))
    }
    pub fn usage(&self, identity: &VerifiedIdentity, now: u64) -> Result<Usage, CloudError> {
        let (member, period, p) = self.context(identity, now)?;
        self.store.transact(&p.all(), |docs| {
            p.authorize(docs, identity, &member.id)?;
            let account: Account = default_doc(docs, &p.account)?;
            let holds: Holds = default_doc(docs, &p.holds)?;
            if !docs.contains_key(&p.global) {
                write(docs, &p.global, &Account::default())?;
            }
            Ok(Usage {
                used_usd_micros: account.used_usd_micros,
                reserved_usd_micros: holds.reserved_usd_micros,
                remaining_usd_micros: self
                    .policy
                    .budget
                    .participant_usd_micros
                    .saturating_sub(add(account.used_usd_micros, holds.reserved_usd_micros)?),
                used: account.used,
                reserved: holds.units,
                reset_at: period.ends_at,
            })
        })
    }
    pub fn reserve(
        &self,
        identity: &VerifiedIdentity,
        input: &ReservationRequest,
        now: u64,
    ) -> Result<Reservation, CloudError> {
        input.units.validate(&self.policy)?;
        if input.key.is_empty()
            || input.key.len() > 128
            || input.input_digest.len() != 64
            || !input.input_digest.bytes().all(|c| c.is_ascii_hexdigit())
            || input.maximum_usd_micros == 0
        {
            return Err(CloudError::InvalidRequest);
        }
        let (member, period, p) = self.context(identity, now)?;
        let id = hash(&format!("{}/{}", member.id, input.key));
        let reservation_path = format!("reservations/{id}");
        let fingerprint = hash(
            &serde_json::to_string(&(
                input.input_digest.as_str(),
                &input.units,
                input.maximum_usd_micros,
            ))
            .map_err(|_| CloudError::InvalidRequest)?,
        );
        let mut paths = p.all();
        paths.push(reservation_path.clone());
        paths.push(format!("audit/{id}"));
        self.store.transact(&paths, |docs| {
            p.authorize(docs, identity, &member.id)?;
            if docs.contains_key(&reservation_path) {
                let old: Reservation = read(docs, &reservation_path)?;
                if old.fingerprint != fingerprint { return Err(CloudError::Conflict); }
                return Ok(old);
            }
            if period.ends_at.saturating_sub(now) <= self.policy.timing.month_guard_seconds {
                return Err(CloudError::Busy);
            }
            let global: Account = default_doc(docs, &p.global)?;
            let account: Account = default_doc(docs, &p.account)?;
            let mut gh: Holds = default_doc(docs, "pilot/holds")?;
            let mut uh: Holds = default_doc(docs, &p.holds)?;
            if add(add(global.used_usd_micros, gh.reserved_usd_micros)?, input.maximum_usd_micros)? > self.policy.budget.tasks_usd_micros {
                return Err(CloudError::BudgetExceeded);
            }
            if add(add(account.used_usd_micros, uh.reserved_usd_micros)?, input.maximum_usd_micros)? > self.policy.budget.participant_usd_micros {
                return Err(CloudError::QuotaExceeded);
            }
            let units = account.used.add(&uh.units)?.add(&input.units)?;
            if units.ocr_pages > self.policy.ocr.monthly_pages || units.characters > self.policy.translation.monthly_characters || units.office_files > self.policy.office.monthly_files {
                return Err(CloudError::QuotaExceeded);
            }
            if gh.queued >= self.policy.concurrency.global_queued || uh.queued >= self.policy.concurrency.participant_queued {
                return Err(CloudError::Busy);
            }
            gh.queued = add(gh.queued, 1)?;
            uh.queued = add(uh.queued, 1)?;
            gh.reserved_usd_micros = add(gh.reserved_usd_micros, input.maximum_usd_micros)?;
            uh.reserved_usd_micros = add(uh.reserved_usd_micros, input.maximum_usd_micros)?;
            gh.units = gh.units.add(&input.units)?;
            uh.units = uh.units.add(&input.units)?;
            let reservation = Reservation {
                id: id.clone(), participant_id: member.id.clone(), period: period.id.clone(),
                units: input.units.clone(), maximum_usd_micros: input.maximum_usd_micros,
                state: "queued".into(), dispatch_pending: true, fingerprint: fingerprint.clone(), actual_usd_micros: None,
            };
            write(docs, &p.global, &global)?;
            write(docs, &p.account, &account)?;
            write(docs, "pilot/holds", &gh)?;
            write(docs, &p.holds, &uh)?;
            write(docs, &reservation_path, &reservation)?;
            docs.insert(format!("audit/{id}"), serde_json::json!({"kind":"reservation","participantId":member.id,"maximumUsdMicros":input.maximum_usd_micros,"at":now}));
            Ok(reservation)
        })
    }

    fn transition(
        &self,
        identity: &VerifiedIdentity,
        id: &str,
        now: u64,
        action: &str,
        actual: Option<u64>,
    ) -> Result<(), CloudError> {
        if id.len() != 64 || !id.bytes().all(|c| c.is_ascii_hexdigit()) {
            return Err(CloudError::InvalidRequest);
        }
        let (member, period, p) = self.context(identity, now)?;
        let path = format!("reservations/{id}");
        let mut paths = p.all();
        paths.push(path.clone());
        paths.push(format!("audit/{id}-{action}"));
        self.store.transact(&paths, |docs| {
            p.authorize(docs, identity, &member.id)?;
            let mut job: Reservation = read(docs, &path)?;
            if job.participant_id != member.id {
                return Err(CloudError::NotAdmitted);
            }
            if action == "settle" && job.state == "settled" {
                return if job.actual_usd_micros == actual {
                    Ok(())
                } else {
                    Err(CloudError::Conflict)
                };
            }
            if action == "cancel" && job.state == "cancelled" {
                return Ok(());
            }
            let mut gh: Holds = read(docs, "pilot/holds")?;
            let mut uh: Holds = read(docs, &p.holds)?;
            match action {
                "running" => {
                    if job.state == "running" {
                        return Ok(());
                    }
                    if job.state != "queued"
                        || job.period != period.id
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
                }
                "unknown" => {
                    if job.state != "running" && job.state != "needs_reconciliation" {
                        return Err(CloudError::Conflict);
                    }
                    job.state = "needs_reconciliation".into();
                }
                "cancel" | "settle" => {
                    if action == "cancel" && job.state != "queued" {
                        return Err(CloudError::Conflict);
                    }
                    if action == "settle"
                        && !matches!(job.state.as_str(), "running" | "needs_reconciliation")
                    {
                        return Err(CloudError::Conflict);
                    }
                    // Sem prova da competência faturada, liquidação que atravessa o mês mantém o saldo reservado.
                    if action == "settle" && job.period != period.id {
                        return Err(CloudError::Conflict);
                    }
                    let cost = actual.unwrap_or(0);
                    if cost > job.maximum_usd_micros {
                        return Err(CloudError::InvalidRequest);
                    }
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
                    if action == "settle" {
                        let mut global: Account = default_doc(docs, &p.global)?;
                        let mut account: Account = default_doc(docs, &p.account)?;
                        global.used_usd_micros = add(global.used_usd_micros, cost)?;
                        account.used_usd_micros = add(account.used_usd_micros, cost)?;
                        global.used = global.used.add(&job.units)?;
                        account.used = account.used.add(&job.units)?;
                        write(docs, &p.global, &global)?;
                        write(docs, &p.account, &account)?;
                        job.state = "settled".into();
                        job.actual_usd_micros = Some(cost);
                    } else {
                        job.state = "cancelled".into();
                    }
                    job.dispatch_pending = false;
                }
                _ => return Err(CloudError::InvalidRequest),
            }
            write(docs, "pilot/holds", &gh)?;
            write(docs, &p.holds, &uh)?;
            write(docs, &path, &job)?;
            docs.insert(
                format!("audit/{id}-{action}"),
                serde_json::json!({"kind":action,"participantId":member.id,"at":now}),
            );
            Ok(())
        })
    }
    pub fn mark_running(&self, i: &VerifiedIdentity, id: &str, now: u64) -> Result<(), CloudError> {
        self.transition(i, id, now, "running", None)
    }
    pub fn mark_unknown(&self, i: &VerifiedIdentity, id: &str, now: u64) -> Result<(), CloudError> {
        self.transition(i, id, now, "unknown", None)
    }
    pub fn cancel_before_start(
        &self,
        i: &VerifiedIdentity,
        id: &str,
        now: u64,
    ) -> Result<(), CloudError> {
        self.transition(i, id, now, "cancel", None)
    }
    /// Somente confirmação de provedor/reconciliador, não expor ao participante por HTTP.
    pub fn settle_confirmed(
        &self,
        i: &VerifiedIdentity,
        id: &str,
        cost: u64,
        now: u64,
    ) -> Result<(), CloudError> {
        self.transition(i, id, now, "settle", Some(cost))
    }
}
