# Política técnica de privacidade

## Modelo local-first

O NexoHub Community processa documentos, projetos, originals, artifacts, cache e bancos de dados
no dispositivo do usuário. Nenhuma função local depende de servidor do NexoHub. O aplicativo não
possui telemetria própria, conta obrigatória, sincronização ou upload automático.

## Rede

A aplicação instalada não precisa acessar a rede para as funções locais. O processo de build pode
baixar dependências e sidecars das fontes fixadas nos lockfiles e em
`runtime/languagetool-community.json`; checksums são validados antes do empacotamento. Uma Tool que
venha a usar rede deverá declarar capability própria, finalidade, dados transmitidos e alternativa
local quando existente.

## Dados e logs

Originals e blobs persistentes são imutáveis e não integram a limpeza de cache. Temporários têm
permissões restritas e são removidos após a operação. Logs não devem conter conteúdo documental,
senhas, tokens ou caminhos sensíveis. Relatos de defeito devem usar dados sintéticos e logs
sanitizados.

## Responsabilidade do usuário

Backups do diretório de projetos e proteção do dispositivo permanecem sob controle do usuário. A
remoção manual desses dados fora do aplicativo pode impedir a recuperação do projeto.
