use nexohub_core::cloud_identity::{NativeLogin, SessionSecrets, protect, unprotect};
#[test]
fn callback_rejects_wrong_state_host_path_and_token_in_url() {
    let login = NativeLogin::begin().unwrap();
    let descriptor = login.descriptor();
    let valid = format!(
        "GET /callback?code={}&state={} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n",
        "a".repeat(64),
        descriptor.state,
        descriptor.port
    );
    assert_eq!(login.validate_callback(&valid).unwrap(), "a".repeat(64));
    for request in [
        valid.replace(&descriptor.state, &"b".repeat(64)),
        valid.replace("127.0.0.1:", "evil.invalid:"),
        valid.replace("/callback?", "/other?"),
        valid.replace("code=", "idToken="),
    ] {
        assert!(login.validate_callback(&request).is_err());
    }
}
#[test]
fn webcrypto_envelope_decrypts_only_in_the_requesting_instance() {
    let login = NativeLogin::begin().unwrap();
    let descriptor = serde_json::to_string(&login.descriptor()).unwrap();
    let output = std::process::Command::new("node")
        .args(["scripts/cloud/encrypt-desktop-fixture.mjs", &descriptor])
        .current_dir("../..")
        .output()
        .unwrap();
    assert!(
        output.status.success(),
        "{}",
        String::from_utf8_lossy(&output.stderr)
    );
    let envelope = serde_json::from_slice(&output.stdout).unwrap();
    let session = login.decrypt(&envelope).unwrap();
    assert_eq!(session.id_token, "synthetic-id-token");
    assert_eq!(session.refresh_token, "synthetic-refresh-token");
    assert!(NativeLogin::begin().unwrap().decrypt(&envelope).is_err());
}
#[test]
#[cfg(windows)]
fn windows_data_protection_roundtrip_rejects_tampering() {
    let value = SessionSecrets {
        id_token: "synthetic-id-token".into(),
        refresh_token: "synthetic-refresh-token".into(),
    };
    let bytes = serde_json::to_vec(&value).unwrap();
    let protected = protect(&bytes).unwrap();
    assert!(!protected.windows(bytes.len()).any(|v| v == bytes));
    assert_eq!(unprotect(&protected).unwrap(), bytes);
    let mut changed = protected;
    let index = changed.len() / 2;
    changed[index] ^= 1;
    assert!(unprotect(&changed).is_err());
}

#[test]
#[cfg(windows)]
fn session_survives_vault_reopen_and_logout_removes_only_its_file() {
    use nexohub_core::cloud_identity::SessionVault;
    let folder =
        std::env::temp_dir().join(format!("nexohub-session-{}", uuid::Uuid::new_v4().simple()));
    let path = folder.join("session.dpapi");
    let value = SessionSecrets {
        id_token: "synthetic-id-token".into(),
        refresh_token: "synthetic-refresh-token".into(),
    };
    let vault = SessionVault::new(path.clone());
    vault.save(&value).unwrap();
    drop(vault);
    assert!(!String::from_utf8_lossy(&std::fs::read(&path).unwrap()).contains("synthetic"));
    let reopened = SessionVault::new(path);
    assert_eq!(
        reopened.load().unwrap().unwrap().refresh_token,
        "synthetic-refresh-token"
    );
    reopened.clear().unwrap();
    assert!(reopened.load().unwrap().is_none());
    reopened.clear().unwrap();
    std::fs::remove_dir(folder).unwrap();
}

#[test]
fn disabled_native_routes_do_not_connect_or_read_credentials() {
    use nexohub_core::cloud_identity::account_request;
    assert_eq!(
        account_request("status", None).unwrap()["identityAvailable"],
        false
    );
    assert!(account_request("usage", None).is_err());
    assert!(account_request("../tools/ocr", Some("not-a-token")).is_err());
}
#[test]
fn loopback_accepts_only_the_bound_callback_on_a_real_socket() {
    use std::{io::Write, net::TcpStream};
    let login = NativeLogin::begin().unwrap();
    let d = login.descriptor();
    let callback = format!(
        "GET /callback?code={}&state={} HTTP/1.1\r\nHost: 127.0.0.1:{}\r\n\r\n",
        "a".repeat(64),
        d.state,
        d.port
    );
    let sender = std::thread::spawn(move || {
        let mut stream = TcpStream::connect(("127.0.0.1", d.port)).unwrap();
        stream.write_all(callback.as_bytes()).unwrap();
    });
    assert_eq!(login.receive().unwrap(), "a".repeat(64));
    sender.join().unwrap();
}
