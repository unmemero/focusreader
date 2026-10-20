use focusreader_backend::{
    db::DbManager,
    services::seed::{seed_corpus_if_needed, SEED_PASSAGES},
};

#[tokio::test]
async fn test_seed_corpus_and_idempotency() {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize test DB");

    // First seed run
    let first_seeded = seed_corpus_if_needed(&db)
        .await
        .expect("First seeding failed");

    assert_eq!(
        first_seeded,
        SEED_PASSAGES.len(),
        "Expected all seed passages to be inserted"
    );

    // Verify all 5 domains are represented in the seeded passages
    let conn = db.connect().expect("Failed to connect");
    let mut domain_rows = conn
        .query(
            "SELECT DISTINCT domain FROM reading_corpus ORDER BY domain",
            (),
        )
        .await
        .expect("Failed to query distinct domains");

    let mut domains = Vec::new();
    while let Some(row) = domain_rows.next().await.unwrap() {
        let d: String = row.get(0).unwrap();
        domains.push(d);
    }

    let expected_domains = vec![
        "biology",
        "chemistry",
        "computer_science",
        "general_humanities",
        "physics",
    ];
    assert_eq!(domains, expected_domains);

    // Second seed run must be idempotent (insert 0 records)
    let second_seeded = seed_corpus_if_needed(&db)
        .await
        .expect("Second seeding failed");

    assert_eq!(
        second_seeded, 0,
        "Idempotent seed run should insert 0 additional passages"
    );

    // Total count remains equal to initial seed count
    let count: i64 = {
        let mut count_rows = conn
            .query("SELECT COUNT(*) FROM reading_corpus", ())
            .await
            .expect("Failed to count rows");
        count_rows.next().await.unwrap().unwrap().get(0).unwrap()
    };
    assert_eq!(count as usize, SEED_PASSAGES.len());

    // Verify all seeded passages are expanded (>= 300 words) and multi-paragraph
    {
        let mut word_rows = conn
            .query("SELECT id, word_count, passage_text FROM reading_corpus", ())
            .await
            .expect("Failed to query passage word counts");
        while let Some(row) = word_rows.next().await.unwrap() {
            let id: String = row.get(0).unwrap();
            let word_count: i64 = row.get(1).unwrap();
            let text: String = row.get(2).unwrap();
            assert!(
                word_count >= 300,
                "Expected seed passage {id} to have at least 300 words, got {word_count}"
            );
            assert!(
                text.contains("\n\n"),
                "Expected seed passage {id} to contain multiple paragraphs"
            );
        }
    }

    // Verify that if an existing database has an older/truncated version of a seed passage,
    // seed_corpus_if_needed refreshes it in place without duplicating rows
    conn.execute(
        "UPDATE reading_corpus SET passage_text = 'short outdated text', word_count = 3 WHERE id = 'seed_cs_shannon1948'",
        (),
    )
    .await
    .expect("Failed to simulate outdated passage");

    let refreshed_inserted = seed_corpus_if_needed(&db)
        .await
        .expect("Refresh seeding failed");
    assert_eq!(refreshed_inserted, 0);

    let mut check_shannon = conn
        .query(
            "SELECT word_count, passage_text FROM reading_corpus WHERE id = 'seed_cs_shannon1948'",
            (),
        )
        .await
        .expect("Failed to query refreshed Shannon passage");
    let shannon_row = check_shannon.next().await.unwrap().unwrap();
    let refreshed_words: i64 = shannon_row.get(0).unwrap();
    let refreshed_text: String = shannon_row.get(1).unwrap();
    assert!(refreshed_words >= 300);
    assert!(refreshed_text.contains("five essential parts"));
}
