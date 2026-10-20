use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use nexohub_core::{CoreError, ErrorCode};
use serde_json::json;

#[derive(Debug)]
pub struct ApiError(pub CoreError);

impl From<CoreError> for ApiError {
    fn from(err: CoreError) -> Self {
        ApiError(err)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self.0.code {
            ErrorCode::InvalidArgument => StatusCode::BAD_REQUEST,
            ErrorCode::ProjectNotFound
            | ErrorCode::DocumentNotFound
            | ErrorCode::ArtifactNotFound => StatusCode::NOT_FOUND,
            ErrorCode::ProjectAlreadyExists => StatusCode::CONFLICT,
            ErrorCode::ResourceLimit => StatusCode::PAYLOAD_TOO_LARGE,
            ErrorCode::PermissionDenied => StatusCode::FORBIDDEN,
            ErrorCode::SidecarTimeout => StatusCode::GATEWAY_TIMEOUT,
            ErrorCode::ReviewUnavailable | ErrorCode::CapabilityNotFound => {
                StatusCode::SERVICE_UNAVAILABLE
            }
            _ => StatusCode::INTERNAL_SERVER_ERROR,
        };

        let body = Json(json!({
            "code": self.0.code,
            "message": self.0.message,
        }));

        (status, body).into_response()
    }
}
