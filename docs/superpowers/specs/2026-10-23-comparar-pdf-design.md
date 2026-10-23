# Comparar PDF no website

Implementa a proposta apresentada na conversa e aprovada com “vamos implementar”.
Dois PDFs locais são comparados em texto e imagem; originais permanecem imutáveis.
PDF.js renderiza/extrai, o motor Myers/Hirschberg existente compara palavras,
pixelmatch identifica alterações visuais e pdf-lib gera relatório em PDF.

A interface mostra dois documentos, zoom, rolagem sincronizada opcional, modo sobreposição,
busca textual, lista de alterações e relatório. A lista referencia pares de páginas alinhados;
página inserida ou removida não deve gerar uma cascata artificial nos pares seguintes.
Digitalizações recebem comparação visual e aviso de indisponibilidade textual, sem OCR automático.

Abordagens consideradas: apenas texto (não cobre imagens/layout), apenas pixels (não isola texto),
separação texto/visual (escolhida na proposta). Não se promete interpretação semântica com IA.

Processamento pesado em worker cancelável; renderização e memória limitadas, erros explícitos,
limpeza de recursos e nenhum upload. Interface em pt-BR, teclado/foco e responsividade.
Não altera processamento nativo, não instala modelos, não faz commit/push/deploy.

Decisões de implementação: pixelmatch versionado e auditado; limites explícitos de páginas/bytes/pixels;
correspondência heurística com texto e assinatura visual. Mudanças extensas de paginação podem exigir
conferência humana. Relatório lista resultados e amostras visuais; JSON preserva texto Unicode integral.
