# Hardening

Esta fase estabelece limites finitos, persistência recuperável e erros estruturados. Ela não promete
processar documentos arbitrariamente grandes. Os limites são lidos uma vez no início da operação;
valor ausente usa o padrão e valor inválido interrompe a operação com `INVALID_ARGUMENT`.

## Limites nativos

| Variável | Padrão | Faixa aceita | Aplicação |
| --- | ---: | ---: | --- |
| `NEXOHUB_MAX_IMPORT_BYTES` | 512 MiB | 1 MiB–2 GiB | blob individual importado ou derivado |
| `NEXOHUB_MAX_PROJECT_ARTIFACT_BYTES` | 20 GiB | 512 MiB–2 TiB | soma lógica dos artifacts do projeto |
| `NEXOHUB_MAX_PDF_INPUT_BYTES` | 256 MiB | 1 MiB–1 GiB | entrada do parser PDF |
| `NEXOHUB_MAX_PDF_PAGES` | 1.000 | 1–10.000 | páginas do PDF |
| `NEXOHUB_MAX_PDF_OBJECTS` | 250.000 | 1.000–1.000.000 | objetos do PDF |
| `NEXOHUB_SIDECAR_TIMEOUT_MS` | 120.000 ms | 1 s–1 h | duração do processo local |
| `NEXOHUB_MAX_SIDECAR_OUTPUT_BYTES` | 16 MiB | 64 KiB–64 MiB | stdout do sidecar |

O engine Python possui limites equivalentes por `NEXOHUB_OCR_*`, `NEXOHUB_DOCX_*` e
`NEXOHUB_SIDECAR_MAX_*`. O OCR aceita, por padrão, até 64 MiB, 500 páginas, 50 megapixels por
página, 250 megapixels totais, 100.000 linhas e quatro milhões de caracteres. DOCX aceita até
64 MiB compactados, 256 MiB descompactados, 2.000 membros, razão de compressão 200:1, 10.000
parágrafos, 500 tabelas, 50.000 células e 16 milhões de caracteres.

## Controles auditados

| Superfície | Controle vigente |
| --- | --- |
| Tauri | A janela `main` não recebe permissões `core:*`, filesystem ou shell. Permanecem apenas comandos próprios registrados no host. |
| Caminhos | O renderer usa grants e sessões opacos conforme ADR-014. O host revalida identidade canônica, escopo, expiração, uso único, symlink e reparse point antes de fornecer ao core raiz absoluta terminada em `.nexohub`; caminhos internos de blob derivam exclusivamente de hash BLAKE3. |
| Sidecar | Executável/JAR com SHA-256 e argumentos fixos; diretório temporário privado; stderr descartado; timeout, limite de stdout, `kill` e `wait`. |
| Temporários | Nomes imprevisíveis, criação exclusiva e remoção por RAII. Somente workspaces com prefixo próprio e idade superior a sete dias entram na recuperação. |
| Escrita | Blobs e saídas usam staging no mesmo diretório, `sync_all` e publicação por rename. Marcadores pendentes permitem remover blob órfão após crash sem tocar em blob referenciado. |
| Banco | `PRAGMA quick_check(1)`, migrations transacionais e exatamente um projeto. Corrupção produz `PROJECT_CORRUPTED`; não há reparo destrutivo automático. |
| Cache | `cache`, `previews` e `exports` são reconstruíveis. `blobs` e `project.sqlite3` são persistentes e nunca participam da limpeza de cache. |
| PDF | Criptografia não suportada, limite prévio de bytes, páginas e objetos; entrada inválida não cria artifact derivado. |
| DOCX | Validação ZIP, path traversal, symlink, criptografia, bomba de compressão e contagem XML antes de materializar o documento. |
| OCR | Base64 limitado antes e depois da decodificação; páginas produzidas em streaming e fechadas individualmente; orçamento de pixels e de saída. |
| HTML/Markdown | Não existe sink de HTML bruto ou renderizador Markdown no produto atual; texto React é escapado. Qualquer renderizador futuro exigirá sanitização explícita. |
| Senhas | Não há coleta, persistência nem log de senhas. PDF/DOCX criptografado é rejeitado; não se solicita senha. |
| Rede e logs | Operações documentais e sidecars não usam rede. O core não registra conteúdo, caminhos, argumentos ou stderr de documentos. |

Os comandos Tauri atuais ainda recebem caminhos absolutos tipados e a UI produtiva ainda não
conecta o `DocumentCorePort` ao adapter Tauri. O ADR-014 bloqueia essa ativação até que o host emita
grants de caminho opacos, escopados, de uso único e com cinco minutos de validade. Criar ou abrir
projeto deve trocar o grant por uma sessão nativa opaca; comandos seguintes não aceitam
`projectPath` do renderer. Projetos recentes persistem apenas identidade confiável e são
revalidados antes de nova sessão. Grant ausente, expirado, revogado, consumido, incompatível ou com
alvo alterado falha com código IPC estruturado sem expor caminho.

## Recuperação e testes de falha

- Falta de espaço é injetada na primitiva de escrita atômica: o staging parcial é removido e o
  destino anterior permanece íntegro.
- Exportação abortada usa a mesma primitiva e não publica conteúdo parcial. A exportação de produto
  ainda não existe; o teste cobre a garantia de persistência que ela deverá consumir.
- Crash ou saída excessiva do sidecar encerra e coleta o processo sem devolver saída parcial.
- Cancelamento e timeout deixam de aguardar executor que não coopera; o executor recebe também um
  `AbortSignal` para liberar recursos próprios.
- PDF inválido ou acima de 1.000 páginas falha antes da persistência derivada.
- Banco corrompido é detectado na abertura. Cache ausente é recriado e o blob original continua
  verificável pelo hash.
- Crash entre publicação do blob e commit SQLite deixa marcador. Após uma hora, a abertura remove
  somente blob não referenciado; se houver referência, remove apenas o marcador.

## Perfil medido

Executado em Windows, build Rust `--release`, com fixtures locais sintéticas e o harness
`hardening_profile`:

| Operação | Entrada | Tempo |
| --- | ---: | ---: |
| importação | 10 MiB | 67 ms |
| importação | 100 MiB | 372 ms |
| importação | 500 MiB | 1.986 ms |
| compressão PDF | 1.000 páginas vazias | 62 ms |

A importação cresce aproximadamente com os bytes porque lê para BLAKE3, copia e sincroniza o blob;
o gargalo real dessa fixture é I/O. O PDF de mil páginas vazias mede custo estrutural, não OCR nem
streams gráficos. Não houve evidência para introduzir paralelismo, mmap ou cache adicional. O caso
de 100 MiB fica abaixo do limite padrão; 500 MiB é aceito por pouco; entradas acima de 512 MiB e PDFs
acima de 1.000 páginas recebem mensagem de limite, salvo configuração explícita dentro das faixas.

Reprodução:

```powershell
cargo run --release -p nexohub-core --example hardening_profile
```
