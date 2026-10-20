use anyhow::{Context, Result};
use focusreader_backend::{
    config::AppConfig, create_router, db::DbManager, services::seed::seed_corpus_if_needed,
};
use std::net::SocketAddr;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "focusreader_backend=info,tower_http=info".into()),
        )
        .init();

    let config = AppConfig::default();
    info!("Starting FocusReader backend with config: {:?}", config);

    let db = DbManager::init(&config.database_url)
        .await
        .context("Failed to initialize database")?;

    // Seed authentic reading passages if not already present
    seed_corpus_if_needed(&db)
        .await
        .context("Failed to seed initial corpus")?;

    let app = create_router(db);

    let addr: SocketAddr = format!("{}:{}", config.host, config.port)
        .parse()
        .context("Failed to parse host/port address")?;

    info!("FocusReader backend listening on http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .context("Failed to bind TCP listener")?;

    axum::serve(listener, app)
        .await
        .context("Server execution failure")?;

    Ok(())
}
