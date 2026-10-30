# Política técnica de privacidade

## Modelo local-first

O NexoHub Community processa documentos, projetos, originals, artifacts, cache e bancos de dados
no dispositivo do usuário. Nenhuma função local depende de servidor do NexoHub. O aplicativo não
possui telemetria própria, conta obrigatória, sincronização ou upload automático.

## Rede

Foi aprovada a implementação de um modo remoto optativo, descrito no [ADR-020](adr/ADR-020-nuvem-opcional-cotas.md). A política inicial permanece desativada; contratos não enviam documentos nem criam contas. Antes de disponibilizar esse modo, será exigida confirmação específica de envio com provedor/localização, unidades, saldo e retenção, além dos controles de identidade/cotas no servidor. Nenhuma falha do motor local deve provocar envio automático. As regras de processamento local abaixo permanecem aplicáveis ao produto disponível.

Os fluxos padrão processam documentos no dispositivo. O primeiro uso de OCR ou tradução pode baixar recursos públicos do motor, idiomas, tokenizer e pesos. A tarefa opcional do instalador baixa LanguageTool/Java e confere os hashes fixados em `runtime/languagetool-community.json`. Esses downloads contatam servidores dos fornecedores e envolvem os metadados usuais de uma requisição HTTP; o documento ou texto a processar não é enviado junto.

O modelo de tradução pode ser reutilizado localmente após o download; a versão Windows 0.2.3 foi testada após reiniciar o processo com WebView2 offline. Cache apagado, outro perfil, restrições de armazenamento ou mudança de modelo podem exigir novo download. O website precisa ser carregado pelo navegador; esse teste não certifica instalação PWA nem acesso inicial sem rede.

Builds também baixam dependências conforme lockfiles e manifestos. O servidor HTTP opcional e os fluxos de publicação são distintos do processamento local padrão. Qualquer nova integração remota precisa declarar finalidade e dados transmitidos.

## Dados e logs

Originals e blobs persistentes são imutáveis e não integram a limpeza de cache. Temporários têm
permissões restritas e são removidos após a operação. Logs não devem conter conteúdo documental,
senhas, tokens ou caminhos sensíveis. Relatos de defeito devem usar dados sintéticos e logs
sanitizados.

## Responsabilidade do usuário

Backups do diretório de projetos e proteção do dispositivo permanecem sob controle do usuário. A
remoção manual desses dados fora do aplicativo pode impedir a recuperação do projeto.
