# Instalação opcional do revisor — ADR-019

Este ensaio complementa o fechamento Q-C0 com a composição de distribuição aprovada
em 27/10/2026. O instalador NexoHub exclui LanguageTool/Java e oferece a instalação
opcional do mesmo snapshot/JRE, por download dos fornecedores oficiais. DOC-C2 excluído.

## Composição e integridade

O pacote Inno tem 20.182.712 bytes, SHA-256
`a8108d7aa4e1ad8b2182fa1139747442fdedadd91e781396604ff2da8fa5ef61`.
O executável tem 27.348.480 bytes, SHA-256
`8167363d4b02dd16f020ee4c733bd0297d25d5481fb665a6cf39e8ab69b7e425`.
A lista explícita de arquivos é conferida pelo empacotador e por `release:verify`.
Mesmo com o runtime de desenvolvimento presente, somente README, script e três
manifestos de preparo são copiados para `runtime`; WebView2 é um bootstrapper
Microsoft separado, preservado como pré-requisito existente.

O preparo fixa 312.224.836 bytes de download. Confere os dois ZIPs por tamanho/SHA,
155 JARs e os 315 arquivos do JRE antes de publicar o destino. O inventário Java foi
confrontado entrada por entrada com novo download do ZIP oficial, cujo SHA coincide
com o manifesto: 315 correspondências, sem arquivo faltante ou adicional. Isso não
é uma auditoria de integridade universal de todos os dados LanguageTool.

O destino novo é publicado por movimentação atômica de um staging no mesmo volume.
Instalação existente verificada não baixa arquivos; conflito é recusado e preservado.
Falha da tarefa deixa o aplicativo básico instalado, informa o erro e retorna código
20 no instalador. O log em `runtime/setup/languagetool-install.log` identifica a causa.

## Verificações automatizadas

- `pnpm test`: 894 JS/TS aprovados (44 domain, 16 SDK, 10 registry, 824 client).
- Testes de scripts: política de payload, instalação nova, repetição sem arquivos de
  download, corrupção de ZIP, JAR conflitante e `jvm.dll` ausente aprovados.
- A ausência de `jvm.dll` reproduziu sucesso indevido antes da correção. Depois,
  todos os arquivos Java passaram a ser verificados antes da idempotência.
- 39 testes do executor aprovados, incluindo mensagem de preparo nativo ausente.
- `pnpm check`, `quality:check` (7), `licenses:check` e `release:verify` aprovados.
  Dois avisos Biome preexistentes de placeholders sintéticos continuam documentados.
- Build Tauri em 6 min 19 s e Inno em 5,906 s. Mensagem informativa do linker sobre
  biblioteca/objeto de importação permanece sem falha de compilação.
- Revisão independente estática: achado Java corrigido e reexaminado sem outros
  achados materiais. O runtime local completo também passou pela nova idempotência.

## Ensaio instalado concluído

Windows Sandbox limpo, Windows 11 Enterprise 10.0.26100, 4.193.220 KiB visíveis,
configuração 4 GB, sem entrada de áudio/vídeo. A instalação base retornou zero e
abriu o NexoHub. Enumeração instalada confirmou somente os cinco arquivos de
preparo em `runtime`, sem LanguageTool/Java. Ao revisar o corpus autoral, a UI exibiu
a orientação de executar o instalador e selecionar **Instalar revisor local**,
com requisito de internet inicial e processamento local posterior.

A tarefa opcional baixou os arquivos oficiais e terminou com código zero em 56,3 s.
A revisão real encontrou os três achados esperados. Aplicar todas as correções e
baixar o resultado produziu exatamente 61 bytes/59 caracteres, SHA-256
`e843332970a9a373556a712900232a9c9b43c5652684789b94b8b16218aeb60c`.
Nenhum processo Java permaneceu após a revisão.

A repetição/atualização retornou zero, conferiu os arquivos e registrou explicitamente
que não houve download. Foram mantidos 155 JARs, um atalho e um registro de desinstalação
`NexoHub 0.1.0`. O primeiro contador procurava nome exato sem versão e foi corrigido
na coleta de evidência; não houve alteração do produto para esse contador.

No controle negativo, somente a JVM do Sandbox foi corrompida. O instalador retornou
20, preservou o arquivo e registrou `LT_INSTALL_CONFLICT` para `bin/server/jvm.dll`.
O log Inno registrou a mensagem explícita de falha do revisor, mantendo a instalação
básica. Não houve processo Java remanescente.

O primeiro ensaio real detectou ausência dos recursos pt-BR de `Expand-Archive` no
Windows limpo. A falha retornou 20 e não publicou runtime incompleto. A extração foi
trocada pela API .NET nativa, após conferência dos ZIPs. Testes de script, Inno,
download real e revisão foram repetidos com sucesso; a alteração foi reexaminada
independentemente sem achados materiais. Nenhuma configuração do Windows foi alterada.
O Sandbox de ensaio foi encerrado após as verificações.

## Limites

As lacunas de fontes do pacote LanguageTool completo continuam na
[issue #12247](https://github.com/languagetool-org/languagetool/issues/12247).
O ADR-019 muda a composição do instalador NexoHub; não afirma que a distribuição
do fornecedor esteja juridicamente certificada. Os 35 perfis continuam restritos.
Não houve push, release ou deploy; o checkout principal foi preservado.
