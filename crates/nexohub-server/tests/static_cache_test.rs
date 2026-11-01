use axum::{
    body::Body,
    http::{Request, StatusCode, header},
};
use nexohub_server::create_app;
use tower::ServiceExt;

fn site() -> tempfile::TempDir {
    let dir = tempfile::tempdir().unwrap();
    std::fs::write(dir.path().join("index.html"), "<html>NexoHub</html>").unwrap();
    std::fs::create_dir_all(dir.path().join("assets")).unwrap();
    std::fs::write(dir.path().join("assets/app-abc123.js"), "console.log(1)").unwrap();
    std::fs::create_dir_all(dir.path().join("dictionaries")).unwrap();
    std::fs::write(dir.path().join("dictionaries/pt.txt"), "palavra").unwrap();
    dir
}

async fn get(app: &axum::Router, path: &str) -> (StatusCode, Option<String>) {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(path).body(Body::empty()).unwrap())
        .await
        .unwrap();
    let cache = response
        .headers()
        .get(header::CACHE_CONTROL)
        .map(|value| value.to_str().unwrap().to_owned());
    (response.status(), cache)
}

#[tokio::test]
async fn pages_and_unhashed_files_always_revalidate() {
    let dir = site();
    let app = create_app(Some(dir.path().to_path_buf()));
    for path in [
        "/",
        "/hub/",
        "/pdf",
        "/hub/pdf",
        "/hub/conta",
        "/hub/dictionaries/pt.txt",
        "/dictionaries/pt.txt",
    ] {
        let (status, cache) = get(&app, path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        assert_eq!(cache.as_deref(), Some("no-cache"), "{path}");
    }
}

#[tokio::test]
async fn hashed_assets_are_cached_for_a_year() {
    let dir = site();
    let app = create_app(Some(dir.path().to_path_buf()));
    for path in ["/assets/app-abc123.js", "/hub/assets/app-abc123.js"] {
        let (status, cache) = get(&app, path).await;
        assert_eq!(status, StatusCode::OK, "{path}");
        assert_eq!(
            cache.as_deref(),
            Some("public, max-age=31536000, immutable"),
            "{path}"
        );
    }
}

#[tokio::test]
async fn missing_asset_is_a_404_and_never_cached_as_immutable() {
    let dir = site();
    let app = create_app(Some(dir.path().to_path_buf()));
    for path in ["/assets/removido-9f9f.js", "/hub/assets/removido-9f9f.js"] {
        let (status, cache) = get(&app, path).await;
        assert_eq!(status, StatusCode::NOT_FOUND, "{path}");
        assert!(!cache.unwrap_or_default().contains("immutable"), "{path}");
    }
}

#[tokio::test]
async fn api_routes_keep_their_own_cache_policy() {
    let dir = site();
    let app = create_app(Some(dir.path().to_path_buf()));
    let (status, cache) = get(&app, "/api/v1/health").await;
    assert_eq!(status, StatusCode::OK);
    assert!(!cache.unwrap_or_default().contains("immutable"));
}
