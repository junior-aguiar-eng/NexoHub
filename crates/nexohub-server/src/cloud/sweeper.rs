//! Varredor periódico: libera reservas que ficaram na fila além do prazo. Interno ao servidor,
//! sem rota HTTP nem token: só roda quando o runtime de identidade foi configurado.
use super::routes::CloudIdentityServices;
use std::{sync::Arc, time::Duration};

const INTERVAL_SECONDS: u64 = 60;

pub fn spawn(services: Arc<CloudIdentityServices>) {
    // Fora de um runtime Tokio (alguns testes síncronos) simplesmente não inicia.
    let Ok(handle) = tokio::runtime::Handle::try_current() else {
        return;
    };
    handle.spawn(async move {
        let mut tick = tokio::time::interval(Duration::from_secs(INTERVAL_SECONDS));
        loop {
            tick.tick().await;
            let s = services.clone();
            let outcome = tokio::task::spawn_blocking(move || {
                let now = (s.clock)()?;
                s.ledger.sweep_expired(now)
            })
            .await;
            match outcome {
                Ok(Ok(report)) if report.expired > 0 || report.cleaned > 0 => {
                    tracing::info!(
                        expired = report.expired,
                        cleaned = report.cleaned,
                        "Fila de nuvem varrida"
                    );
                }
                Ok(Err(error)) => tracing::warn!(code = ?error, "Falha ao varrer a fila de nuvem"),
                _ => {}
            }
        }
    });
}
