use std::env;

#[derive(Clone, Debug)]
pub struct AppConfig {
    pub host: String,
    pub port: u16,
    pub database_url: String,
    pub llm_base_url: String,
    pub llm_model: String,
    pub llm_timeout_seconds: u64,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
            port: env::var("PORT")
                .ok()
                .and_then(|p| p.parse().ok())
                .unwrap_or(3001),
            database_url: env::var("DATABASE_URL")
                .unwrap_or_else(|_| "./data/focusreader.db".to_string()),
            llm_base_url: env::var("LLM_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:8080".to_string()),
            llm_model: env::var("LLM_MODEL")
                .unwrap_or_else(|_| "Meta-Llama-3.1-8B-Instruct-Q8_0".to_string()),
            llm_timeout_seconds: env::var("LLM_TIMEOUT_SECONDS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(30),
        }
    }
}
