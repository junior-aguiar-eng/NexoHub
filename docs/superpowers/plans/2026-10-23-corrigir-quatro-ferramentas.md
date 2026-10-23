# Correção das quatro ferramentas auditadas

> Execução: superpowers:executing-plans, nesta sessão. Plano autorizado pelo pedido de corrigir todos os achados da auditoria do commit a44c5ec.

**Objetivo:** corrigir privacidade, captura, preservação de conteúdo, seleções e integração das ferramentas HTML, scanner, remover e extrair páginas.

**Arquitetura:** manter processamento local com React, PDF.js e pdf-lib existentes. HTML usa leitura inerte e composição documental paginada; a prévia precisa bloquear recursos remotos. Operações de páginas preservam o documento e a estrutura de formulário restante.

**Limites:** somente website; sem dependências novas, commit, push ou deploy nesta etapa. Originais imutáveis. Textos novos em pt-BR no catálogo de i18n.

## 1. Regressões

- [x] Cobrir no Chromium: recursos HTML externos, conteúdo integral de tabelas/parágrafos/textos mistos/Unicode, câmera e troca/encerramento, WebP, limpeza de imagens, seleção vazia, reinício, rotas e larguras móveis.
- [x] Cobrir no motor: formulários após remover/extrair, incluindo campos em páginas descartadas e ZIP.
- [x] Observar falhas antes de alterar os respectivos comportamentos.

## 2. HTML

- [x] Isolar prévia com CSP sem rede e sandbox sem origem compartilhada; remover recursos ativos do documento analisado.
- [x] Preservar nós de texto e quebras; paginar dentro de blocos, quebrar palavras longas e células, sem truncar código ou tabela.
- [x] Suportar Unicode com representação fiel dos caracteres que as fontes padrão não codificam, preservando o texto restante selecionável.
- [x] Verificar saída com PDF.js, marcadores no fim dos conteúdos e limites físicos das páginas.

## 3. Scanner

- [x] Conectar fluxo ao vídeo montado, passar facingMode explicitamente e invalidar solicitações tardias; parar tracks em falhas, troca e saída.
- [x] Normalizar WebP no Canvas; liberar ImageBitmap e URLs no ciclo de vida apropriado.
- [x] Verificar captura, exportação e liberação de recursos.

## 4. Páginas e integração

- [x] Validar intervalos integralmente; limpar seleção vazia e impedir execução de intervalo inválido.
- [x] Limpar estado por novo arquivo/reinício; registrar as quatro rotas e ajustar controles para 390px.
- [x] Preservar campos restantes ao remover e extrair; validar campos e valores em PDF combinado e ZIP.
- [x] Executar lint, tipagem, testes unitários, E2E e build; documentar limitações reais de conversão HTML.

## Atenção na revisão

Pedidos de câmera resolvidos após sair da tela; formulários com campos em várias páginas; HTML malformado e recursos CSS externos; conteúdos maiores que uma página/célula; caracteres Unicode e nomes de arquivos longos. As regressões devem cobrir essas classes.

## Evidências e decisões de execução

- Regressões iniciais: 14 falhas no Chromium e três falhas de preservação de formulário, observadas antes das correções. Reproduções complementares da auditoria cobriram seleção vazia, estado entre arquivos e URLs não liberadas.
- Formulários: um copiador compartilhado preserva referências de páginas, campos e widgets; os widgets de páginas descartadas são removidos da árvore antes da cópia. Evita regravar diretamente o contexto completo do original.
- Unicode: somente linhas fora da codificação padrão são renderizadas com Canvas; a camada selecionável é inserida junto a cada linha, com fonte reutilizada por documento. A aparência depende das fontes disponíveis no navegador.
- Revisão independente identificou reordenação do Unicode na extração. O teste `HTML mantém a ordem de linhas Unicode entre linhas vetoriais` falhou antes da correção e passou depois. O caminho padrão de OCR continua acrescentando stream separado para preservar documentos já serializados.
- Verificação final: `pnpm check`, `pnpm test` (541 testes) e build do website aprovados; Playwright completo com 113 testes aprovados. Captura adicional com câmera de teste do Chromium: vídeo 1920×1080 e PDF de uma página.
- Sem novas dependências, commit, push ou deploy nesta entrega.
