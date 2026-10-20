use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use focusreader_backend::{
    create_router,
    db::DbManager,
    models::{CorpusPassage, IngestRequest, IngestResponse, SuggestPassageRequest, SuggestPassageResponse},
    services::{corpus::calculate_difficulty_tier, seed::seed_corpus_if_needed},
};
use http_body_util::BodyExt;
use tower::ServiceExt;

async fn setup_app() -> (axum::Router, DbManager) {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize test DB");
    seed_corpus_if_needed(&db)
        .await
        .expect("Failed to seed initial corpus");
    let app = create_router(db.clone());
    (app, db)
}

#[tokio::test]
async fn test_get_corpus_list_and_domain_filter() {
    let (app, _) = setup_app().await;

    // Test list all
    let req = Request::builder()
        .uri("/api/corpus")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let passages: Vec<CorpusPassage> = serde_json::from_slice(&body).unwrap();
    assert_eq!(passages.len(), 26);

    // Test list with domain filter
    let req_filter = Request::builder()
        .uri("/api/corpus?domain=computer_science")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res_filter = app.oneshot(req_filter).await.unwrap();
    assert_eq!(res_filter.status(), StatusCode::OK);

    let body_filter = res_filter.into_body().collect().await.unwrap().to_bytes();
    let cs_passages: Vec<CorpusPassage> = serde_json::from_slice(&body_filter).unwrap();
    assert!(!cs_passages.is_empty());
    for p in cs_passages {
        assert_eq!(p.domain, "computer_science");
    }
}

#[tokio::test]
async fn test_get_random_passage() {
    let (app, _) = setup_app().await;

    let req = Request::builder()
        .uri("/api/corpus/random?domain=physics")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let passage: CorpusPassage = serde_json::from_slice(&body).unwrap();
    assert_eq!(passage.domain, "physics");
    assert!(passage.word_count > 0);
    assert!(passage.lexical_density_score.unwrap() > 0.0);
}

#[tokio::test]
async fn test_get_passage_by_id() {
    let (app, _) = setup_app().await;

    let req = Request::builder()
        .uri("/api/corpus/seed_cs_rfc9110")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let passage: CorpusPassage = serde_json::from_slice(&body).unwrap();
    assert_eq!(passage.id, "seed_cs_rfc9110");
    assert_eq!(passage.domain, "computer_science");
}

#[tokio::test]
async fn test_ingest_custom_passage_and_sql_injection_defense() {
    let (app, _) = setup_app().await;

    // Normal ingestion with explicit difficulty calibration
    let ingest_payload = IngestRequest {
        title: "Test Ingestion Article".to_string(),
        domain: "computer_science".to_string(),
        source_attribution: "RFC 0000 Test Specification".to_string(),
        text: "This is a custom technical passage ingested for testing purposes. It contains sufficient words to form a valid reading exercise.".to_string(),
        difficulty: Some("Hard".to_string()),
    };

    let req = Request::builder()
        .uri("/api/corpus/ingest")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&ingest_payload).unwrap()))
        .unwrap();

    let res = app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::CREATED);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let ingest_res: IngestResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(ingest_res.passages_created, 1);
    assert_eq!(ingest_res.passages[0].title, "Test Ingestion Article");
    assert_eq!(
        calculate_difficulty_tier(
            &ingest_res.passages[0].passage_text,
            ingest_res.passages[0].lexical_density_score.unwrap()
        ),
        "Hard"
    );

    // SQL Injection resilience test: attack payload in title and source attribution
    let attack_payload = IngestRequest {
        title: "Malicious '; DROP TABLE reading_corpus; --".to_string(),
        domain: "biology".to_string(),
        source_attribution: "' OR 1=1; --".to_string(),
        text: "Safe text content despite malicious title characters.".to_string(),
        difficulty: None,
    };

    let attack_req = Request::builder()
        .uri("/api/corpus/ingest")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&attack_payload).unwrap()))
        .unwrap();

    let attack_res = app.clone().oneshot(attack_req).await.unwrap();
    assert_eq!(attack_res.status(), StatusCode::CREATED);

    // Verify reading_corpus table still exists and contains the verbatim escaped string
    let verify_req = Request::builder()
        .uri("/api/corpus?domain=biology")
        .method("GET")
        .body(Body::empty())
        .unwrap();

    let verify_res = app.oneshot(verify_req).await.unwrap();
    assert_eq!(verify_res.status(), StatusCode::OK);

    let verify_body = verify_res.into_body().collect().await.unwrap().to_bytes();
    let passages: Vec<CorpusPassage> = serde_json::from_slice(&verify_body).unwrap();
    assert!(passages.iter().any(|p| p.title == "Malicious '; DROP TABLE reading_corpus; --"));
}

#[tokio::test]
async fn test_ingest_validation_failures() {
    let (app, _) = setup_app().await;

    // Custom topic ("Art History") should succeed and normalize to "art_history"
    let custom_topic = IngestRequest {
        title: "Renaissance Perspective".to_string(),
        domain: "Art History".to_string(),
        source_attribution: "Giorgio Vasari, 1550".to_string(),
        text: "Linear perspective transformed the spatial organization of Renaissance painting.".to_string(),
        difficulty: Some("Medium".to_string()),
    };

    let req_custom = Request::builder()
        .uri("/api/corpus/ingest")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&custom_topic).unwrap()))
        .unwrap();

    let res_custom = app.clone().oneshot(req_custom).await.unwrap();
    assert_eq!(res_custom.status(), StatusCode::CREATED);
    let custom_body = res_custom.into_body().collect().await.unwrap().to_bytes();
    let custom_res: IngestResponse = serde_json::from_slice(&custom_body).unwrap();
    assert_eq!(custom_res.passages[0].domain, "art_history");

    // Invalid domain (unfilled 'other' or unsafe punctuation)
    let bad_domain = IngestRequest {
        title: "Bad Domain".to_string(),
        domain: "other".to_string(),
        source_attribution: "Unknown".to_string(),
        text: "Some valid text.".to_string(),
        difficulty: None,
    };

    let req_bad_domain = Request::builder()
        .uri("/api/corpus/ingest")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&bad_domain).unwrap()))
        .unwrap();

    let res_bad = app.clone().oneshot(req_bad_domain).await.unwrap();
    assert_eq!(res_bad.status(), StatusCode::BAD_REQUEST);

    // Empty text
    let empty_text = IngestRequest {
        title: "Empty".to_string(),
        domain: "physics".to_string(),
        source_attribution: "Unknown".to_string(),
        text: "   ".to_string(),
        difficulty: None,
    };

    let req_empty = Request::builder()
        .uri("/api/corpus/ingest")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&empty_text).unwrap()))
        .unwrap();

    let res_empty = app.oneshot(req_empty).await.unwrap();
    assert_eq!(res_empty.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_suggest_and_extract_passage_endpoint() {
    let (app, _) = setup_app().await;

    let suggest_req = SuggestPassageRequest {
        domain: Some("general_humanities".to_string()),
        difficulty: Some("Easy".to_string()),
        prompt_parameters: Some("Stoic philosophy and Marcus Aurelius".to_string()),
        exclude_titles: vec![],
    };

    let req = Request::builder()
        .uri("/api/corpus/suggest-passage")
        .method("POST")
        .header("Content-Type", "application/json")
        .body(Body::from(serde_json::to_vec(&suggest_req).unwrap()))
        .unwrap();

    let res = app.oneshot(req).await.unwrap();
    assert_eq!(res.status(), StatusCode::OK);

    let body = res.into_body().collect().await.unwrap().to_bytes();
    let suggestion: SuggestPassageResponse = serde_json::from_slice(&body).unwrap();
    assert_eq!(suggestion.domain, "general_humanities");
    assert_eq!(suggestion.difficulty, "Easy");
    assert!(!suggestion.classified_topics.is_empty());
    assert!(!suggestion.text.is_empty());
    assert!(!suggestion.selected_sections.is_empty());
}
