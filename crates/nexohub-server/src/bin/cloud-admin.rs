use nexohub_server::cloud::admin::AdminCommand;
fn main() {
    let result = (|| {
        let command = AdminCommand::parse(&std::env::args().skip(1).collect::<Vec<_>>())?;
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|_| nexohub_server::cloud::CloudError::Unavailable)?
            .as_secs();
        command.execute(now)?;
        println!(
            "{}",
            serde_json::json!({"dryRun":!command.apply,"operation":command.operation(),"project":command.project})
        );
        Ok::<(), nexohub_server::cloud::CloudError>(())
    })();
    if result.is_err() {
        eprintln!(
            "Operação administrativa recusada. Use [--apply] --project PROJETO --service-account CONTA invite|suspend|resume|revoke DESTINO. É necessária impersonação IAM para aplicar."
        );
        std::process::exit(2);
    }
}
