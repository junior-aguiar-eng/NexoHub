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
