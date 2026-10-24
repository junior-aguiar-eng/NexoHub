# Auditoria de Proteger PDF, Ocultar PDF e PDF para Excel — website

Escopo: processamento local no navegador, resultados exportados, interface e integração.
Arquivos de teste sintéticos; nenhum documento do usuário ou upload externo.

## Achados e correções

| Prioridade | Ferramenta | Problema reproduzido | Correção |
| --- | --- | --- | --- |
| P1 | Ocultar PDF | Retângulo vetorial cobria a informação, mantendo texto e objetos recuperáveis. | Documento novo recebe somente imagens com as áreas já ocultadas; não copia streams, anexos ou metadados do original. |
| P1 | Ocultar PDF | Posição ignorava rotação e CropBox. | Coordenadas percentuais seguem a página visual; verificação de pixels em 0°, 90°, 180° e 270°. |
| P1 | PDF para Excel | Prévia inventava linhas de exemplo, sem relação com o arquivo enviado. | Análise real fornece amostra; carregamento, ausência de texto/tabelas e erros têm estados explícitos. |
| P2 | Proteger PDF | `trim()` alterava as credenciais; senha de abertura também era a senha titular por padrão. | Senhas exatas; titular aleatório quando não informado, separado da senha de abertura. |
| P2 | Proteger PDF | Flags de montagem/impressão de alta qualidade permaneciam habilitadas apesar das restrições. | Flags vinculadas às opções de alteração e impressão. |
| P2 | Proteger PDF | Erro RC4 para Unicode expunha caracteres da senha; abrir Desbloquear usava hash sem trocar ferramenta. | Erro estruturado orienta usar AES-256; navegação SPA preserva o arquivo. |
| P2 | PDF para Excel | Células vazias deslocavam dados; códigos perdiam zeros ou precisão; CSV aceitava fórmulas. | Alinhamento usa colunas compartilhadas; identificadores ficam em texto; CSV neutraliza fórmulas e mantém negativos numéricos. |
| P2 | PDF para Excel | Exportação consolidada inseria rótulos artificiais como linhas; pontuação era alterada. | Dados sem linhas auxiliares, pontuação original preservada; PDF sem texto/tabela não gera falso sucesso vazio. |
| P2 | Interface | Tarjas só por mouse; miniatura de outra página podia aparecer; campos sem rótulos. | Ponteiros com captura/cancelamento e coordenadas editáveis por teclado; miniaturas sob demanda e rótulos acessíveis. |

## Limites reais

- **Ocultação:** rasteriza todas as páginas, até 216 DPI, com limites de 24 MP/página,
  8192 px por dimensão e 96 MP/documento. Remove seleção/busca textual, links, campos de formulário,
  anexos e metadados. Esse custo aparece na interface antes de executar. O original permanece intacto.
  As tarjas precisam cobrir integralmente o conteúdo a remover; nenhum detector automático de dados pessoais é prometido.
- **Proteção:** AES-256 é o padrão; RC4 permanece como opção legada. Permissões dependem do leitor
  de PDF e não impedem capturas de tela nem substituem controles de acesso. RC4 rejeita caracteres
  incompatíveis; AES-256 segue o limite de 127 bytes do padrão PDF.
- **Excel:** reconstrução é heurística por posição de texto. Não reconhece automaticamente tabelas
  de digitalizações, células mescladas, estilos ou toda estrutura de tabelas complexas. Recomenda-se
  conferir a amostra e a planilha antes de usar os dados. No XLSX, códigos e números longos ficam como texto;
  o CSV pode incluir apóstrofo protetor em valores que programas de planilha interpretariam como fórmula.
  CSV não armazena tipos: importe identificadores como texto no editor para evitar conversão automática.
- A amostra de Excel mostra até 15 linhas do documento inteiro. A paginação muda somente a miniatura.
  O CSV é uma sequência única de linhas; XLSX permite abas por página ou consolidação.

## Evidências

- PDFs sintéticos reais para criptografia, senha exata, permissões, conteúdo textual e pixel da tarja.
- Validação criptográfica da separação de senha titular, Unicode AES, RC4 com acentos e erros seguros.
- Arquivos XLSX descompactados e células OpenXML conferidas, CSV analisado e identificação de resultados vazios.
- Navegador real: arquivo exportado protegido reaberto com parser; tarja sem camada textual/anotações/anexos;
  amostra e XLSX do arquivo efetivo; navegação para desbloqueio; quatro larguras de tela.
- Testes de teclado, ponteiro, ausência de miniatura, estado de opções e limpeza ao trocar documento.

Validação final: 427 testes unitários e 74 E2E aprovados, além de lint, tipagem e build do website.

Nenhuma publicação faz parte desta auditoria. A entrega fica local até solicitação de commit/push/deploy.


## Complementação SEC-C1 — 24/10/2026

A auditoria acima permanece como registro do modo imagem. Foi acrescentado um modo **opcional
para preservar conteúdo em PDFs simples**, sem substituir o padrão e sem fallback automático.

### Motor e decisão de dependências

A inspeção do código publicado de `@embedpdf/plugin-redaction@2.15.1` e
`@embedpdf/engines@2.15.1` confirmou o uso de `EPDFPage_ApplyRedactions` e geração posterior do
conteúdo. O projeto usa diretamente essas funções no `@embedpdf/pdfium@2.15.1` já instalado,
em worker descartável, mantendo a versão e os avisos MIT/BSD existentes. Nenhum pacote novo
foi instalado; o plugin exigiria outros plugins de interface e a camada engines acrescentaria
pacotes de fontes desnecessários para o perfil atual.

**PDFium sozinho não basta:** a prova inicial manteve título/assunto confidenciais e uma
propriedade privada de página. Por isso, a implementação valida o perfil, remove metadados de
página e recria o grafo de páginas/formulários antes e depois da operação. A gravação nativa é
completa, sem modo incremental. A cor e o rótulo são desenhados somente depois da remoção dos
objetos: cobertura visual não é usada como substituta da remoção.

### Perfil de preservação e recusas

- Fontes Type1 padrão de 14 famílias/variantes, com codificação simples. Fontes incorporadas,
  ToUnicode e codificações personalizadas são recusadas.
- Imagens opacas DeviceRGB/DeviceGray, 8 bits, cruas ou Flate; máscaras, transparência, JPEG,
  ICC e preditores não estão homologados neste perfil.
- Form XObjects simples e reutilizados; links URI sem aparências personalizadas e campos simples fora das tarjas. Interseção
  com link/widget é recusada explicitamente. Metadados do documento, XMP, miniaturas e
  marcadores de navegação não são preservados; valores dos campos externos são preservados.
- Documentos assinados, criptografados, XFA, estruturas marcadas, camadas, scripts, anexos e
  extensões privadas/desconhecidas do perfil são recusados. A classificação é conservadora;
  até strings com sintaxe semelhante a comentários ou conteúdo marcado podem causar recusa.
- Limites: entrada de 20 MiB, 30 páginas e 200 áreas; saída nativa de 80 MiB; imagem de até
  24 MP, 8192 px por dimensão e 96 MP acumulados; stream de conteúdo de até 2 MiB decodificados.
  Worker com timeout configurado de 60 s, encerrado ao cancelar ou invalidar a sessão. Limites de aceitação não são
  uma medição de desempenho em celulares ou documentos próximos desses tetos.
- Caixas de página devem ser finitas, ordenadas e limitadas a ±14400 pontos; rotações devem
  ser múltiplas de 90°. Caixas invertidas são recusadas antes de calcular áreas.
- Rótulos usam a fonte padrão; caracteres não representáveis são recusados, sem saída parcial.

O modo imagem continua disponível mediante escolha explícita e conserva suas perdas já
registradas. O usuário precisa marcar todas as ocorrências que deseja remover, inclusive
instâncias repetidas. Conteúdo externo às áreas não é uma busca global de dados confidenciais.
Este incremento **não homologa preservação universal** para documentos Office, digitalizações
JPEG, PDFs etiquetados ou fontes arbitrárias.

### Evidências posteriores

Corpus sintético real, processado pelo WASM instalado: texto removido com texto externo
selecionável; imagem com metade privada eliminada dos dados e pixels públicos idênticos;
Form XObject reutilizado com duas instâncias removidas e conteúdo externo mantido; CropBox e
rotações 0/90/180/270; campos preenchidos e links URI externos; streams órfãos e recursos sem
uso descartados; título/assunto e metadados de página removidos; extensões privadas, máscaras,
fontes fora do perfil e retângulos inválidos recusados. Os testes inspecionam extração textual,
streams descomprimidos, valores de campos, links e pixels, além da imutabilidade da entrada.

Na interface, as marcações do original são identificadas como tal. Após aplicar, a revisão é
renderizada a partir do **mesmo Blob disponibilizado para download**, com navegação e zoom.
Há recuperação de falha de prévia, retorno às marcações, cancelamento e descarte de resultados
obsoletos. Proteger/Desbloquear mantêm seus motores e regressões anteriores.

A revisão independente encontrou três falhas no candidato inicial: recursos não utilizados em
aparências de campos preservadas, dicionários privados de anotações e MediaBox invertido. Foram
acrescentadas regressões e correções: poda de XObjects sem operador `Do` efetivo em cada grafo
preservado (página/Form/aparência), sem confundir strings/hex/arrays com operadores; clonagem
por proprietário para não apagar recursos compartilhados usados em outra página; whitelist
por tipo de anotação, validação de aparências e dicionários auxiliares/campos; e recusa de caixas
invertidas, não finitas ou fora dos limites e rotações não suportadas. A validação também
confere os tipos de posições como Border, ProcSet e FirstChar e as referências Parent/P,
recusando grafos privados nesses locais. Instruções de aparência padrão dos formulários têm
sintaxe restrita a fontes/cor/estado de texto, até 4096 caracteres; literais e operadores
ignorados não são aceitos como depósitos de dados.

Validação posterior às correções: 659 testes unitários (596 client, 44 domain, 16 SDK e
3 registry), 32 E2E focados na raiz e 107 E2E em `/hub/`, todos aprovados. Antes da revisão,
a suíte ampla da raiz registrou 228 aprovados e cinco skips existentes. Lint, tipagem de todo
o workspace, build do website na raiz e em `/hub/` e `git diff --check` aprovados. Capturas em
390, 768, 1024 e 1440 px conferidas; ações sem rolagem horizontal e controles separados da mesa.
A revisão independente teve três achados Important corrigidos, sem pendências Critical/Important
ou Minor. Não houve homologação em outros navegadores/dispositivos nem medição perto dos tetos.

Sem novas dependências. O build em `/hub/` tem entrada de 1067,60 kB (293,80 kB gzip), worker
adicional carregado sob demanda de 598,06 kB e o mesmo WASM PDFium de 4646,93 kB já existente.
O alerta de chunk principal acima de 1000 kB permanece; não é uma medição de latência.
Sem commit, push ou deploy nesta complementação.
