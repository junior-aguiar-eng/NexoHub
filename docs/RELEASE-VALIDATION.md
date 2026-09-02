# Validação local da release engineering

Data: 2 de setembro de 2026. Plataforma: Windows x64.

## Gates executados

- Biome nos arquivos JavaScript/JSON alterados e `cargo fmt --all --check`.
- Clippy dos crates `nexohub-core` e `nexohub-desktop` com warnings negados.
- Testes afetados do adapter LanguageTool e compilação de teste do shell desktop.
- `pnpm audit --audit-level=high` e `uv audit --locked`: nenhuma vulnerabilidade conhecida.
- Verificação de versões, lockfiles, manifesto, hashes, tamanho, componentes e licenças dos sidecars.
- Build frontend produtivo e bundles Tauri NSIS/MSI no Windows.

## Artifacts locais

| Artifact | Tamanho | SHA-256 |
| --- | ---: | --- |
| `NexoHub_0.1.0-alpha.1_x64-setup.exe` | 263,8 MiB | `4b09c9a20d5ae1c642b98142a1e8422b98b157cf35b1739117e8778daa4fb2a1` |
| `NexoHub_0.1.0-alpha.1_x64_en-US.msi` | 301,8 MiB | `3d6a679f045741db778599e8cc8255235949061f990ef3b09909b31cd96387da` |

Os artifacts foram produzidos em staging temporário e não são versionados. Os workflows de release
reproduzem o processo e publicam `SHA256SUMS.txt` junto aos installers.

## Medição aplicada

O primeiro bundle continha 545,1 MiB de runtime extraído e mais 297,7 MiB dos ZIPs usados para
download. Como os ZIPs não são usados em execução, foram removidos após a validação. O NSIS caiu de
561,7 para 263,8 MiB; o MSI caiu de 598,2 para 301,8 MiB.

## Gates ainda externos

- Execução verde dos workflows no GitHub Actions.
- Instalação, abertura e desinstalação dos artifacts em máquina Windows limpa.

Esses gates impedem declarar release candidate ou suporte geral neste momento.
