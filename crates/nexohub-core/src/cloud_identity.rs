//! Login nativo opcional. Nenhum código deste módulo é chamado pelo processamento local.
use crate::{CoreError, CoreResult, ErrorCode};
use aws_lc_rs::{
    aead::{self, Aad, LessSafeKey, Nonce, UnboundKey},
    encoding::AsDer,
    rsa::{KeySize, OAEP_SHA256_MGF1SHA256, OaepPrivateDecryptingKey, PrivateDecryptingKey},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::{
    io::{Read, Write},
    net::TcpListener,
    time::{Duration, Instant},
};
// Prazo para o usuário escolher a conta e abrir o e-mail. O código emitido pelo servidor
// continua com TTL independente de 60 s e só pode ser consumido uma vez.
const LOGIN_INTERACTION_TIMEOUT: Duration = Duration::from_secs(600);
fn error() -> CoreError {
    CoreError::new(ErrorCode::PermissionDenied, "AUTH_INVALID_CALLBACK")
}
pub fn encode(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}
fn decode(value: &str, max: usize) -> CoreResult<Vec<u8>> {
    if value.len() > max * 2
        || !value.len().is_multiple_of(2)
        || !value.bytes().all(|b| b.is_ascii_hexdigit())
    {
        return Err(error());
    }
    (0..value.len())
        .step_by(2)
        .map(|i| u8::from_str_radix(&value[i..i + 2], 16).map_err(|_| error()))
        .collect()
}
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SessionSecrets {
    pub id_token: String,
    pub refresh_token: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginDescriptor {
    pub state: String,
    pub challenge: String,
    pub public_key: String,
    pub port: u16,
}
pub struct NativeLogin {
    listener: TcpListener,
    state: String,
    verifier: String,
    public_key: String,
    key: OaepPrivateDecryptingKey,
    started: Instant,
}
impl NativeLogin {
    pub fn begin() -> CoreResult<Self> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|_| error())?;
        listener.set_nonblocking(true).map_err(|_| error())?;
        let key = PrivateDecryptingKey::generate(KeySize::Rsa2048).map_err(|_| error())?;
        let public_key = encode(key.public_key().as_der().map_err(|_| error())?.as_ref());
        let random = || {
            format!(
                "{}{}",
                uuid::Uuid::new_v4().simple(),
                uuid::Uuid::new_v4().simple()
            )
        };
        Ok(Self {
            listener,
            state: random(),
            verifier: random(),
            public_key,
            key: OaepPrivateDecryptingKey::new(key).map_err(|_| error())?,
            started: Instant::now(),
        })
    }
    pub fn descriptor(&self) -> LoginDescriptor {
        LoginDescriptor {
            state: self.state.clone(),
            challenge: format!("{:x}", Sha256::digest(self.verifier.as_bytes())),
            public_key: self.public_key.clone(),
            port: self.listener.local_addr().expect("Listener válido").port(),
        }
    }
    pub fn browser_url(&self, method: &str) -> CoreResult<String> {
        if !matches!(method, "google" | "emailLink") {
            return Err(error());
        }
        let d = self.descriptor();
        let mut url = url::Url::parse(&format!("{}/hub/cloud/login", identity_origin()))
            .map_err(|_| error())?;
        url.query_pairs_mut().extend_pairs([
            ("state", d.state),
            ("challenge", d.challenge),
            ("publicKey", d.public_key),
            ("port", d.port.to_string()),
            ("method", method.into()),
        ]);
        Ok(url.into())
    }
    pub fn validate_callback(&self, request: &str) -> CoreResult<String> {
        if self.started.elapsed() >= LOGIN_INTERACTION_TIMEOUT || request.len() > 4096 {
            return Err(error());
        }
        let mut lines = request.split("\r\n");
        let first = lines.next().ok_or_else(error)?;
        let parts: Vec<_> = first.split(' ').collect();
        if parts.len() != 3 || parts[0] != "GET" || parts[2] != "HTTP/1.1" {
            return Err(error());
        }
        let expected = format!("127.0.0.1:{}", self.descriptor().port);
        let hosts: Vec<_> = lines
            .filter_map(|line| line.split_once(':'))
            .filter(|(key, _)| key.eq_ignore_ascii_case("host"))
            .collect();
        if hosts.len() != 1 || hosts[0].1.trim() != expected {
            return Err(error());
        }
        let url = url::Url::parse(&format!("http://127.0.0.1{}", parts[1])).map_err(|_| error())?;
        let pairs: Vec<_> = url.query_pairs().collect();
        if url.path() != "/callback" || pairs.len() != 2 || url.fragment().is_some() {
            return Err(error());
        }
        let code = pairs
            .iter()
            .find(|(k, _)| k == "code")
            .map(|(_, v)| v.to_string())
            .ok_or_else(error)?;
        let state = pairs
            .iter()
            .find(|(k, _)| k == "state")
            .map(|(_, v)| v.as_ref())
            .ok_or_else(error)?;
        if state != self.state || code.len() != 64 || !code.bytes().all(|b| b.is_ascii_hexdigit()) {
            return Err(error());
        }
        Ok(code)
    }
    pub fn receive(&self) -> CoreResult<String> {
        while self.started.elapsed() < LOGIN_INTERACTION_TIMEOUT {
            match self.listener.accept() {
                Ok((mut socket, peer)) => {
                    if !peer.ip().is_loopback() {
                        continue;
                    }
                    socket
                        .set_read_timeout(Some(Duration::from_millis(100)))
                        .map_err(|_| error())?;
                    socket
                        .set_write_timeout(Some(Duration::from_millis(100)))
                        .map_err(|_| error())?;
                    let mut buffer = Vec::new();
                    let mut chunk = [0; 512];
                    while self.started.elapsed() < LOGIN_INTERACTION_TIMEOUT
                        && buffer.len() <= 4096
                        && !buffer.windows(4).any(|v| v == b"\r\n\r\n")
                    {
                        match socket.read(&mut chunk) {
                            Ok(0) | Err(_) => break,
                            Ok(n) => buffer.extend_from_slice(&chunk[..n]),
                        }
                    }
                    let code = std::str::from_utf8(&buffer)
                        .map_err(|_| error())
                        .and_then(|request| self.validate_callback(request));
                    let response = if code.is_ok() {
                        "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n"
                    } else {
                        "HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
                    };
                    let _ = socket.write_all(response.as_bytes());
                    if code.is_ok() {
                        return code;
                    }
                }
                Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                    std::thread::sleep(Duration::from_millis(20))
                }
                Err(_) => return Err(error()),
            }
        }
        Err(CoreError::new(ErrorCode::SidecarTimeout, "AUTH_TIMEOUT"))
    }
    pub fn exchange_request(&self, code: &str) -> Value {
        serde_json::json!({"code":code,"verifier":self.verifier,"state":self.state})
    }
    pub fn decrypt(&self, envelope: &Value) -> CoreResult<SessionSecrets> {
        let field = |name: &str| max_field(envelope, name);
        let wrapped = decode(field("wrappedKey")?, 256)?;
        let mut key = vec![0; self.key.min_output_size()];
        let key = self
            .key
            .decrypt(&OAEP_SHA256_MGF1SHA256, &wrapped, &mut key, None)
            .map_err(|_| error())?;
        let key = LessSafeKey::new(UnboundKey::new(&aead::AES_256_GCM, key).map_err(|_| error())?);
        let nonce: [u8; 12] = decode(field("nonce")?, 12)?
            .try_into()
            .map_err(|_| error())?;
        let mut bytes = decode(field("ciphertext")?, 32_768)?;
        let d = self.descriptor();
        let binding = format!("{}:{}", d.state, d.challenge);
        let plain = key
            .open_in_place(
                Nonce::assume_unique_for_key(nonce),
                Aad::from(binding.as_bytes()),
                &mut bytes,
            )
            .map_err(|_| error())?;
        let session: SessionSecrets = serde_json::from_slice(plain).map_err(|_| error())?;
        if session.id_token.is_empty()
            || session.id_token.len() > 16_384
            || session.refresh_token.len() > 4096
        {
            return Err(error());
        }
        Ok(session)
    }
}
fn max_field<'a>(value: &'a Value, key: &str) -> CoreResult<&'a str> {
    value[key].as_str().ok_or_else(error)
}
#[cfg(windows)]
pub fn protect(bytes: &[u8]) -> CoreResult<Vec<u8>> {
    crypt(bytes, true)
}
#[cfg(windows)]
pub fn unprotect(bytes: &[u8]) -> CoreResult<Vec<u8>> {
    crypt(bytes, false)
}
#[cfg(windows)]
fn crypt(bytes: &[u8], encrypt: bool) -> CoreResult<Vec<u8>> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CRYPT_INTEGER_BLOB, CRYPTPROTECT_UI_FORBIDDEN, CryptProtectData, CryptUnprotectData,
        },
    };
    if bytes.is_empty() || bytes.len() > 65_536 {
        return Err(error());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr().cast_mut(),
    };
    let mut output = CRYPT_INTEGER_BLOB {
        cbData: 0,
        pbData: std::ptr::null_mut(),
    };
    // SAFETY: os buffers de entrada vivem durante a chamada; DPAPI aloca a saída com LocalAlloc.
    let ok = unsafe {
        if encrypt {
            CryptProtectData(
                &input,
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        } else {
            CryptUnprotectData(
                &input,
                std::ptr::null_mut(),
                std::ptr::null(),
                std::ptr::null(),
                std::ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut output,
            )
        }
    };
    if ok == 0 {
        return Err(error());
    }
    if output.pbData.is_null() || output.cbData == 0 || output.cbData > 65_536 {
        if !output.pbData.is_null() {
            // SAFETY: saída alocada pelo DPAPI; nenhum buffer externo é liberado.
            unsafe {
                LocalFree(output.pbData.cast());
            }
        }
        return Err(error());
    }
    // SAFETY: DPAPI informou o tamanho/alocação; a cópia ocorre antes de LocalFree, uma única vez.
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe {
        LocalFree(output.pbData.cast());
    }
    Ok(result)
}
#[cfg(not(windows))]
pub fn protect(_: &[u8]) -> CoreResult<Vec<u8>> {
    Err(error())
}
#[cfg(not(windows))]
pub fn unprotect(_: &[u8]) -> CoreResult<Vec<u8>> {
    Err(error())
}
#[cfg(windows)]
pub fn open_browser(url: &str) -> CoreResult<()> {
    use windows_sys::Win32::UI::Shell::ShellExecuteW;
    if !url.starts_with(&format!("{}/hub/cloud/login?", identity_origin())) || url.contains('\0') {
        return Err(error());
    }
    let wide: Vec<u16> = url.encode_utf16().chain(Some(0)).collect();
    let verb: Vec<u16> = "open".encode_utf16().chain(Some(0)).collect();
    // SAFETY: ponteiros UTF-16 terminados em NUL válidos durante ShellExecuteW, URL fixa HTTPS.
    let result = unsafe {
        ShellExecuteW(
            std::ptr::null_mut(),
            verb.as_ptr(),
            wide.as_ptr(),
            std::ptr::null(),
            std::ptr::null(),
            1,
        )
    };
    if result as isize <= 32 {
        return Err(error());
    }
    Ok(())
}

/// Identidade opcional; o processamento local nunca depende deste gate.
pub const IDENTITY_ENABLED: bool = true;
const FIREBASE_PUBLIC: &str = include_str!("../../../scripts/cloud/firebase-public.json");
fn identity_origin() -> &'static str {
    // Perfil de homologação fixado na compilação, nunca recebido por IPC ou documento.
    if option_env!("NEXOHUB_IDENTITY_PREVIEW") == Some("true") {
        "https://login-hml---nexohub-hub-r4m4ltvj3a-rj.a.run.app"
    } else {
        "https://nexojuris.ia.br"
    }
}
fn transport() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .redirects(0)
        .timeout(Duration::from_secs(10))
        .build()
}
fn response_json(response: ureq::Response) -> CoreResult<Value> {
    let mut bytes = Vec::new();
    response
        .into_reader()
        .take(70 * 1024 + 1)
        .read_to_end(&mut bytes)
        .map_err(|_| error())?;
    if bytes.len() > 70 * 1024 {
        return Err(error());
    }
    serde_json::from_slice(&bytes).map_err(|_| error())
}
pub fn finish_login(login: NativeLogin) -> CoreResult<SessionSecrets> {
    let code = login.receive()?;
    let value = response_json(
        transport()
            .post(&format!(
                "{}/hub/api/v1/cloud/auth/desktop/exchange",
                identity_origin()
            ))
            .set("Content-Type", "application/json")
            .send_string(&login.exchange_request(&code).to_string())
            .map_err(|_| error())?,
    )?;
    login.decrypt(&value)
}
pub fn token_needs_refresh(id_token: &str, now: u64) -> bool {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    id_token
        .split('.')
        .nth(1)
        .and_then(|p| URL_SAFE_NO_PAD.decode(p).ok())
        .and_then(|p| serde_json::from_slice::<Value>(&p).ok())
        .and_then(|v| v["exp"].as_u64())
        .is_none_or(|exp| exp <= now.saturating_add(120))
}
const TOKEN_ENDPOINT: &str = "https://securetoken.googleapis.com/v1/token";

/// Chave web restrita por referrer só aceita chamadas que declarem a origem autorizada; o cliente
/// nativo não tem página de origem, então declara a origem pública do próprio serviço.
fn refresh_referer() -> String {
    format!("{}/", identity_origin())
}

pub fn refresh_session(session: &SessionSecrets) -> CoreResult<SessionSecrets> {
    refresh_session_at(TOKEN_ENDPOINT, session)
}

fn refresh_session_at(endpoint: &str, session: &SessionSecrets) -> CoreResult<SessionSecrets> {
    let config: Value = serde_json::from_str(FIREBASE_PUBLIC).map_err(|_| error())?;
    let api_key = config["apiKey"]
        .as_str()
        .filter(|key| !key.is_empty())
        .ok_or_else(error)?;
    let mut url = url::Url::parse(endpoint).map_err(|_| error())?;
    url.query_pairs_mut().append_pair("key", api_key);
    let body = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("grant_type", "refresh_token")
        .append_pair("refresh_token", &session.refresh_token)
        .finish();
    let value = response_json(
        transport()
            .post(url.as_str())
            .set("Content-Type", "application/x-www-form-urlencoded")
            .set("Referer", &refresh_referer())
            .send_string(&body)
            .map_err(|_| error())?,
    )?;
    Ok(SessionSecrets {
        id_token: value["id_token"].as_str().ok_or_else(error)?.into(),
        refresh_token: value["refresh_token"].as_str().ok_or_else(error)?.into(),
    })
}

/// Caminho escolhido pelo host nativo, nunca por parâmetro da interface.
pub struct SessionVault {
    path: std::path::PathBuf,
}
impl SessionVault {
    pub fn new(path: std::path::PathBuf) -> Self {
        Self { path }
    }
    pub fn save(&self, session: &SessionSecrets) -> CoreResult<()> {
        let mut plain = serde_json::to_vec(session).map_err(|_| error())?;
        let encrypted = protect(&plain);
        plain.fill(0);
        let encrypted = encrypted?;
        std::fs::create_dir_all(self.path.parent().ok_or_else(error)?).map_err(|_| error())?;
        std::fs::write(&self.path, encrypted).map_err(|_| error())
    }
    pub fn load(&self) -> CoreResult<Option<SessionSecrets>> {
        let file = match std::fs::File::open(&self.path) {
            Ok(file) => file,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
            Err(_) => return Err(error()),
        };
        let mut bytes = Vec::new();
        file.take(65_537)
            .read_to_end(&mut bytes)
            .map_err(|_| error())?;
        let mut plain = unprotect(&bytes)?;
        let session = serde_json::from_slice(&plain).map_err(|_| error());
        plain.fill(0);
        session.map(Some)
    }
    pub fn clear(&self) -> CoreResult<()> {
        match std::fs::remove_file(&self.path) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            Err(_) => Err(error()),
        }
    }
}
pub fn account_request(operation: &str, token: Option<&str>) -> CoreResult<Value> {
    account_request_gated(IDENTITY_ENABLED, operation, token)
}

fn account_request_gated(
    identity_enabled: bool,
    operation: &str,
    token: Option<&str>,
) -> CoreResult<Value> {
    if !matches!(operation, "status" | "me" | "usage") {
        return Err(error());
    }
    if !identity_enabled {
        return if operation == "status" {
            Ok(serde_json::json!({"enabled":false,"identityAvailable":false}))
        } else {
            Err(CoreError::new(
                ErrorCode::PermissionDenied,
                "CLOUD_DISABLED",
            ))
        };
    }
    let url = format!("{}/hub/api/v1/cloud/{operation}", identity_origin());
    let mut request = transport().get(&url);
    if operation != "status" {
        let token = token
            .filter(|v| !v.is_empty() && v.len() <= 16_384)
            .ok_or_else(error)?;
        request = request.set("Authorization", &format!("Bearer {token}"));
    }
    response_json(request.call().map_err(|_| error())?)
}

#[cfg(test)]
mod refresh_tests {
    use super::*;
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;

    /// Responde uma única requisição e devolve a linha de requisição e os cabeçalhos recebidos.
    fn serve_once(response_body: &'static str) -> (String, std::thread::JoinHandle<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let endpoint = format!("http://{}/v1/token", listener.local_addr().unwrap());
        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut reader = BufReader::new(stream.try_clone().unwrap());
            let mut head = String::new();
            let mut length = 0usize;
            loop {
                let mut line = String::new();
                reader.read_line(&mut line).unwrap();
                if let Some(value) = line.to_ascii_lowercase().strip_prefix("content-length:") {
                    length = value.trim().parse().unwrap();
                }
                if line == "\r\n" {
                    break;
                }
                head.push_str(&line);
            }
            let mut body = vec![0; length];
            std::io::Read::read_exact(&mut reader, &mut body).unwrap();
            write!(
                stream,
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{response_body}",
                response_body.len()
            )
            .unwrap();
            head
        });
        (endpoint, handle)
    }

    #[test]
    fn refresh_declares_the_public_origin_as_referer_and_sends_the_key() {
        let (endpoint, server) = serve_once(
            r#"{"id_token":"synthetic-id-new","refresh_token":"synthetic-refresh-new"}"#,
        );
        let session = SessionSecrets {
            id_token: "synthetic-id-token".into(),
            refresh_token: "synthetic-refresh-token".into(),
        };
        let renewed = refresh_session_at(&endpoint, &session).unwrap();
        assert_eq!(renewed.id_token, "synthetic-id-new");
        assert_eq!(renewed.refresh_token, "synthetic-refresh-new");
        let head = server.join().unwrap().to_ascii_lowercase();
        assert!(head.starts_with("post /v1/token?key="));
        assert!(head.contains(&format!(
            "referer: {}",
            refresh_referer().to_ascii_lowercase()
        )));
        assert!(
            refresh_referer().ends_with("nexojuris.ia.br/")
                || refresh_referer().ends_with(".run.app/")
        );
    }
}

#[cfg(test)]
mod gate_tests {
    use super::*;

    #[test]
    fn disabled_identity_answers_status_locally_and_refuses_the_rest() {
        let status = account_request_gated(false, "status", None).unwrap();
        assert_eq!(status["identityAvailable"], false);
        let refused = account_request_gated(false, "usage", Some("token")).unwrap_err();
        assert_eq!(refused.message, "CLOUD_DISABLED");
        assert!(account_request_gated(false, "../tools/ocr", Some("token")).is_err());
    }

    #[test]
    fn enabled_identity_validates_operation_and_token_before_any_request() {
        for (operation, token) in [
            ("../tools/ocr", Some("token")),
            ("me", None),
            ("usage", Some("")),
            ("me", Some(&"a".repeat(16_385)[..])),
        ] {
            assert!(account_request_gated(true, operation, token).is_err());
        }
    }
}

#[cfg(test)]
mod deadline_tests {
    use super::*;
    #[test]
    fn expired_login_stops_before_accepting_callback() {
        let mut login = NativeLogin::begin().unwrap();
        login.started = Instant::now() - LOGIN_INTERACTION_TIMEOUT - Duration::from_secs(1);
        assert!(login.receive().is_err());
    }
}
