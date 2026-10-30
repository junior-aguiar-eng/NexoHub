//! Firestore REST transacional, acessível somente pelo servidor.
//! HTTP bloqueante: invocar pela threadpool do servidor, nunca no reator Tokio.
use super::CloudError;
use reqwest::{blocking::Client, redirect::Policy};
use serde_json::{Value, json};
use std::{collections::BTreeMap, io::Read, net::SocketAddr, sync::Arc, time::Duration};

pub trait AccessTokenSource: Send + Sync {
    fn token(&self) -> Result<String, CloudError>;
}

/// Identidade de serviço do Cloud Run; nenhuma credencial de usuário ou arquivo é procurado.
pub struct MetadataAccessToken;
impl AccessTokenSource for MetadataAccessToken {
    fn token(&self) -> Result<String, CloudError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(3))
            .redirect(Policy::none())
            .no_proxy()
            .build()
            .map_err(|_| CloudError::Unavailable)?;
        let response = client.get("http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token")
            .header("Metadata-Flavor", "Google").send().map_err(|_| CloudError::Unavailable)?;
        if !response.status().is_success()
            || response
                .headers()
                .get("Metadata-Flavor")
                .and_then(|v| v.to_str().ok())
                != Some("Google")
        {
            return Err(CloudError::Unavailable);
        }
        let data = limited_json(response)?;
        data["access_token"]
            .as_str()
            .filter(|v| !v.is_empty())
            .map(str::to_owned)
            .ok_or(CloudError::Unavailable)
    }
}

pub(crate) fn limited_json(response: reqwest::blocking::Response) -> Result<Value, CloudError> {
    let mut bytes = Vec::new();
    response
        .take(6 * 1024 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| CloudError::Unavailable)?;
    if bytes.len() > 6 * 1024 * 1024 {
        return Err(CloudError::Unavailable);
    }
    serde_json::from_slice(&bytes).map_err(|_| CloudError::Unavailable)
}

#[derive(Clone)]
pub struct FirestoreStore {
    client: Client,
    base: String,
    documents: String,
    access: Option<Arc<dyn AccessTokenSource>>,
}

fn project_valid(project: &str) -> bool {
    !project.is_empty()
        && project.len() <= 63
        && project
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn path_valid(path: &str) -> bool {
    let segments: Vec<_> = path.split('/').collect();
    segments.len() >= 2
        && segments.len().is_multiple_of(2)
        && segments.iter().all(|s| {
            !s.is_empty()
                && s.len() <= 128
                && s.bytes()
                    .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_'))
        })
}

impl FirestoreStore {
    pub fn project_id(&self) -> &str {
        self.documents
            .split('/')
            .nth(1)
            .expect("Projeto validado no construtor")
    }
    pub fn emulator(host: &str, project: &str) -> Result<Self, CloudError> {
        let address: SocketAddr = host.parse().map_err(|_| CloudError::InvalidRequest)?;
        if !address.ip().is_loopback() || !project.starts_with("demo-") || !project_valid(project) {
            return Err(CloudError::InvalidRequest);
        }
        Self::build(format!("http://{address}"), project, None)
    }

    pub fn google(project: &str, access: Arc<dyn AccessTokenSource>) -> Result<Self, CloudError> {
        if !project_valid(project) {
            return Err(CloudError::InvalidRequest);
        }
        Self::build(
            "https://firestore.googleapis.com".into(),
            project,
            Some(access),
        )
    }

    fn build(
        endpoint: String,
        project: &str,
        access: Option<Arc<dyn AccessTokenSource>>,
    ) -> Result<Self, CloudError> {
        let client = Client::builder()
            .timeout(Duration::from_secs(15))
            .connect_timeout(Duration::from_secs(3))
            .redirect(Policy::none())
            .retry(reqwest::retry::never())
            .build()
            .map_err(|_| CloudError::Unavailable)?;
        Ok(Self {
            client,
            base: endpoint,
            documents: format!("projects/{project}/databases/(default)/documents"),
            access,
        })
    }

    fn post(&self, method: &str, body: Value, token: Option<&str>) -> Result<Value, CloudError> {
        let url = format!("{}/v1/{}:{method}", self.base, self.documents);
        let mut request = self.client.post(url).json(&body);
        if let Some(token) = token {
            request = request.bearer_auth(token);
        }
        let response = request.send().map_err(|_| CloudError::Unavailable)?;
        if matches!(response.status().as_u16(), 409 | 412) {
            return Err(CloudError::Conflict);
        }
        if !response.status().is_success() {
            tracing::warn!(
                stage = "account_store",
                operation = method,
                status = response.status().as_u16(),
                "Falha no armazenamento da conta"
            );
            let error = limited_json(response)?;
            if method == "commit"
                && error["error"]["status"].as_str() == Some("FAILED_PRECONDITION")
            {
                return Err(CloudError::Conflict);
            }
            return Err(CloudError::Unavailable);
        }
        limited_json(response)
    }

    pub fn get(&self, path: &str) -> Result<Option<Value>, CloudError> {
        self.transact(&[path.to_owned()], |docs| Ok(docs.get(path).cloned()))
    }

    /// O callback pode repetir por conflito; somente leitura/escrita de metadados, sem I/O externo.
    pub fn transact<T, F>(&self, paths: &[String], apply: F) -> Result<T, CloudError>
    where
        F: Fn(&mut BTreeMap<String, Value>) -> Result<T, CloudError>,
    {
        if paths.is_empty() || paths.len() > 20 || paths.iter().any(|p| !path_valid(p)) {
            return Err(CloudError::InvalidRequest);
        }
        let token = self
            .access
            .as_ref()
            .map(|access| access.token())
            .transpose()?;
        for attempt in 0..16 {
            match self.attempt(paths, &apply, token.as_deref()) {
                Err(AttemptError::Retry) if attempt < 15 => {
                    std::thread::sleep(Duration::from_millis(5 * (attempt + 1)))
                }
                Err(AttemptError::Retry) => return Err(CloudError::Unavailable),
                Err(AttemptError::Failure(error)) => return Err(error),
                Ok(value) => return Ok(value),
            }
        }
        Err(CloudError::Unavailable)
    }

    fn attempt<T, F>(
        &self,
        paths: &[String],
        apply: &F,
        token: Option<&str>,
    ) -> Result<T, AttemptError>
    where
        F: Fn(&mut BTreeMap<String, Value>) -> Result<T, CloudError>,
    {
        let names: Vec<_> = paths
            .iter()
            .map(|p| format!("{}/{p}", self.documents))
            .collect();
        let read = self.post("batchGet", json!({"documents": names}), token)?;
        let mut docs = BTreeMap::new();
        let mut versions = BTreeMap::new();
        let prefix = format!("{}/", self.documents);
        for entry in read.as_array().ok_or(CloudError::Unavailable)? {
            let found = entry.get("found");
            let name = if let Some(found) = found {
                found["name"].as_str()
            } else {
                entry["missing"].as_str()
            }
            .ok_or(CloudError::Unavailable)?;
            let key = name.strip_prefix(&prefix).ok_or(CloudError::Unavailable)?;
            if !paths.iter().any(|p| p == key) || versions.contains_key(key) {
                return Err(CloudError::Unavailable.into());
            }
            let precondition = if let Some(found) = found {
                let payload = found["fields"]["payload"]["stringValue"]
                    .as_str()
                    .ok_or(CloudError::Unavailable)?;
                docs.insert(
                    key.to_owned(),
                    serde_json::from_str(payload).map_err(|_| CloudError::Unavailable)?,
                );
                json!({"updateTime":found["updateTime"].as_str().ok_or(CloudError::Unavailable)?})
            } else {
                json!({"exists": false})
            };
            versions.insert(key.to_owned(), precondition);
        }
        if versions.len() != paths.len() {
            return Err(CloudError::Unavailable.into());
        }
        let original = docs.clone();
        let value = apply(&mut docs)?;
        if docs.keys().any(|p| !paths.contains(p)) || original.keys().any(|p| !docs.contains_key(p))
        {
            return Err(CloudError::InvalidRequest.into());
        }
        if docs == original {
            return Ok(value);
        }
        let mut writes = Vec::new();
        for path in paths {
            let name = format!("{}/{path}", self.documents);
            let condition = versions.get(path).ok_or(CloudError::Unavailable)?;
            if original.get(path) != docs.get(path) {
                let data = docs.get(path).ok_or(CloudError::InvalidRequest)?;
                let encoded =
                    serde_json::to_string(data).map_err(|_| CloudError::InvalidRequest)?;
                if encoded.len() > 512 * 1024 {
                    return Err(CloudError::InvalidRequest.into());
                }
                writes.push(json!({"update":{"name":name,"fields":document_fields(path, data, encoded)?},"currentDocument":condition}));
            } else {
                // API pública: regrava o mesmo payload sob precondição, sem Write.verify privado.
                if let Some(data) = docs.get(path) {
                    let encoded =
                        serde_json::to_string(data).map_err(|_| CloudError::InvalidRequest)?;
                    writes.push(json!({"update":{"name":name,"fields":document_fields(path, data, encoded)?},"currentDocument":condition}));
                } else {
                    writes.push(json!({"delete":name,"currentDocument":condition}));
                }
            }
        }
        match self.post("commit", json!({"writes":writes}), token) {
            Err(CloudError::Conflict) => Err(AttemptError::Retry),
            Err(error) => Err(error.into()),
            Ok(_) => Ok(value),
        }
    }
}

enum AttemptError {
    Retry,
    Failure(CloudError),
}
// O TTL físico é independente da recusa lógica após 60 s; não renova a validade do código.
fn document_fields(path: &str, data: &Value, encoded: String) -> Result<Value, CloudError> {
    let mut fields = json!({"payload":{"stringValue":encoded}});
    if path.starts_with("desktopCodes/") {
        let seconds = data["expiresAt"]
            .as_u64()
            .ok_or(CloudError::InvalidRequest)?;
        let seconds = i64::try_from(seconds).map_err(|_| CloudError::InvalidRequest)?;
        let at = chrono::DateTime::from_timestamp(seconds, 0).ok_or(CloudError::InvalidRequest)?;
        fields["expireAt"] = json!({"timestampValue":at.to_rfc3339()});
    }
    Ok(fields)
}
impl From<CloudError> for AttemptError {
    fn from(error: CloudError) -> Self {
        Self::Failure(error)
    }
}
