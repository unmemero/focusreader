use focusreader_backend::db::DbManager;

#[tokio::test]
async fn test_db_init_and_migrations_in_memory() {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize in-memory database");

    let conn = db.connect().expect("Failed to connect to database");

    // Verify all expected tables were created by the migration
    let expected_tables = vec![
        "app_config",
        "reading_corpus",
        "drill_sessions",
        "drift_events",
        "session_intents",
        "micro_recaps",
        "session_debriefs",
        "evaluations",
    ];

    let mut all_tables = conn
        .query("SELECT name FROM sqlite_master WHERE type='table'", ())
        .await
        .expect("Query failed");

    let mut found = Vec::new();
    while let Some(row) = all_tables.next().await.unwrap() {
        let name: String = row.get(0).unwrap();
        found.push(name);
    }
    println!("Found tables in DB: {:?}", found);

    for table in expected_tables {
        assert!(
            found.iter().any(|t| t == table),
            "Expected table '{table}' to exist in database, found: {:?}",
            found
        );
    }
}

#[tokio::test]
async fn test_app_config_insert_and_select() {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize in-memory database");

    let conn = db.connect().expect("Failed to connect to database");

    conn.execute(
        "INSERT INTO app_config (key, value) VALUES (?1, ?2)",
        ["llm_model", "gemma-2-9b-it"],
    )
    .await
    .expect("Failed to insert into app_config");

    let mut rows = conn
        .query(
            "SELECT value FROM app_config WHERE key = ?1",
            ["llm_model"],
        )
        .await
        .expect("Failed to select from app_config");

    let row = rows
        .next()
        .await
        .expect("Row fetch error")
        .expect("Expected a row returned");

    let val: String = row.get(0).expect("Failed to get column 0");
    assert_eq!(val, "gemma-2-9b-it");
}
