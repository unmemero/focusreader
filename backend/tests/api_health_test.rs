use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use focusreader_backend::{create_router, db::DbManager, models::HealthResponse};
use http_body_util::BodyExt;
use tower::ServiceExt;

#[tokio::test]
async fn test_api_health_endpoint() {
    let db = DbManager::init(":memory:")
        .await
        .expect("Failed to initialize in-memory database");

    let app = create_router(db);

    let request = Request::builder()
        .uri("/api/health")
        .method("GET")
        .body(Body::empty())
        .expect("Failed to build request");

    let response = app
        .oneshot(request)
        .await
        .expect("Failed to execute request");

    assert_eq!(response.status(), StatusCode::OK);

    let body_bytes = response
        .into_body()
        .collect()
        .await
        .expect("Failed to read response body")
        .to_bytes();

    let health: HealthResponse =
        serde_json::from_slice(&body_bytes).expect("Failed to parse HealthResponse JSON");

    assert_eq!(health.status, "ok");
    assert_eq!(health.database, "connected");
    assert!(!health.version.is_empty());
}
