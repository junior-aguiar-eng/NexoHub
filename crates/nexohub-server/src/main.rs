use nexohub_server::{cloud::runtime, create_app_with_identity};
use std::env;
use std::net::SocketAddr;
use std::path::PathBuf;
use tokio::signal;
use tracing::info;
use tracing_subscriber::{EnvFilter, fmt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|p| p.parse().ok())
        .unwrap_or(8080);

    let host = env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;

    let static_dir_path = env::var("STATIC_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| {
            let candidate = PathBuf::from("dist");
            if candidate.exists() {
                candidate
            } else {
                PathBuf::from("apps/client/dist")
            }
        });

    let static_dir = if static_dir_path.exists() {
        info!("Servindo arquivos estáticos de: {:?}", static_dir_path);
        Some(static_dir_path)
    } else {
        info!(
            "Diretório estático não encontrado ({:?}). Operando somente em modo API.",
            static_dir_path
        );
        None
    };

    let identity = tokio::task::spawn_blocking(runtime::from_environment).await??;
    let app = create_app_with_identity(static_dir, identity);

    info!("Iniciando NexoHub Server em http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("Servidor NexoHub finalizado.");
    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("falha ao registrar tratador de sinal Ctrl+C");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("falha ao registrar tratador de sinal SIGTERM")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Sinal de interrupção (Ctrl+C) recebido.");
        },
        _ = terminate => {
            info!("Sinal de término (SIGTERM) recebido.");
        },
    }
}
