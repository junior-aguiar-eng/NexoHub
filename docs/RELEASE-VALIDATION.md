# Validação de release

## Estado atual — 0.2.4, publicada em 30/10/2026

A [release Windows 0.2.4](https://github.com/junior-aguiar-eng/NexoHub/releases/tag/v0.2.4) incorpora a remoção dos arquivos do logo antigo. Os gates e o instalador passaram na [execução oficial](https://github.com/junior-aguiar-eng/NexoHub/actions/runs/41077574266).

- Instalador: `NexoHub_0.2.4_x64-setup.exe`, 21.259.832 bytes; SHA-256 `3c7676ce03a82fab11c67c0142e9f8118806376d6eac0e772c547470b44e935b`.
- Windows Sandbox com rede desabilitada: instalação limpa, abertura, atualização de 0.2.3 para 0.2.4, preservação de documento sintético, atalho com o camaleão e desinstalação aprovados.
- Neste computador, executável e registro confirmaram 0.2.4; hash do executável igual ao da VM. Atualização sem reiniciar o Windows.
- Camaleão conferido visualmente no ícone extraído do executável instalado e na interface PDF/Imagens; favicons atuais confirmados. O arquivo do ícone instalado corresponde ao aprovado no repositório.
- ZIP com integridade verificada, três `NOTICE.txt` e sem os assets antigos. A [evidência versionada](evidencias/releases/windows-0.2.4.json) também está anexada à release.

O instalador permanece `NotSigned`. LanguageTool/Java são opcionais e não foram reinstalados. Esta validação trata do instalador, da atualização e da marca; não repete todos os testes de ferramentas e não altera os limites de OCR e tradução registrados abaixo.

## Registro anterior — 0.2.3, publicada em 29/10/2026

A [release Windows 0.2.3](https://github.com/junior-aguiar-eng/NexoHub/releases/tag/v0.2.3) foi publicada como versão normal e latest, com instalador Inno Setup x64, ZIP web/Python, `SHA256SUMS.txt` e evidência JSON. O build e os gates da tag terminaram com sucesso na [execução oficial](https://github.com/junior-aguiar-eng/NexoHub/actions/runs/40925060477).

- Instalador: `NexoHub_0.2.3_x64-setup.exe`, 21.282.873 bytes; SHA-256 `68e41c57ff06894278219bd3e960747927e3ab225a6835a46dd121c7ff5a869c`.
- Windows Sandbox com 4 GiB e rede desabilitada: instalação limpa, abertura, atualização de 0.2.2 para 0.2.3, atalho/ícone, preservação de documento sintético e desinstalação aprovados.
- Instalação local atualizada; arquivo executável e registro do Windows confirmaram 0.2.3. O executável respondeu e seu hash coincidiu com o do Sandbox. Não foi necessário reiniciar o Windows.
- Na versão instalada, campo de nomes e tradução real foram verificados. Após encerrar e reabrir a instância de teste com WebView2 offline, a tradução terminou sem solicitar o modelo novamente.
- Os quatro arquivos publicados foram baixados novamente e comparados com os validados. A [evidência versionada](evidencias/releases/windows-0.2.3.json) corresponde ao JSON anexado à release.

O instalador permanece `NotSigned`, sem assinatura Authenticode. LanguageTool/Java são opcionais e não foram reinstalados neste ensaio. A condição offline da tradução foi emulada no contexto WebView2; o host permaneceu conectado. Os testes usam amostras sintéticas e não certificam todas as ferramentas, formatos ou documentos. A fotografia investigada no OCR continua reprovada e os resets intermitentes de download não tiveram causa final comprovada.

## Registro histórico — release engineering de setembro de 2026

O registro abaixo descreve os artefatos e os gates daquela execução. NSIS/MSI e runtimes incorporados pertencem ao empacotamento antigo; não representam a composição ou o estado da release 0.2.3. Os gates listados como pendentes são históricos.

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
