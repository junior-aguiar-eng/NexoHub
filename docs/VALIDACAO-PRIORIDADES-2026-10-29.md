# Validação das prioridades — 29/10/2026

Escopo: checkout principal, base `460cf4546ecdbe88308f16f8f6c9a346ea4b48ea`; aplicativo Windows instalado 0.2.2. As alterações nesta avaliação permanecem locais.

## Exportação no Windows e reparo

Os testes de exportação com arquivo sintético abriram o seletor nativo de gravação e reabriram os resultados PNG, JPG e XLSX; a planilha preservou o identificador `00123`. O PDF foi conferido em ensaio anterior pelo mesmo fluxo. Esses casos não cobrem todos os formatos ou cancelamento e substituição de arquivo. O teste de reparo anterior usou o arquivo sintético `prefixo.pdf`; não comprova recuperação de todos os perfis de corrupção. A matriz e as recusas intencionais de R-C1 estão em [R-C1](R-C1-VALIDACAO.md).

## Fotografia e OCR

A fotografia de livro fornecida anteriormente permanece privada. O aplicativo instalado produziu 250 caracteres normalizados e nenhuma das quatro referências visuais exatas anteriormente registradas. O teste documenta extração, não aprovação de qualidade. Em ensaio isolado em Node, duas metades ampliadas por interpolação Lanczos e processadas pelo Tesseract com segmentação automática ou texto esparso também apresentaram 0/4 referências; diferenças no runtime e no processamento impedem comparar diretamente as contagens com o aplicativo. A fotografia contém duas páginas pequenas, curvas e inclinadas; esses fatores são hipóteses plausíveis, sem prova de causa individual. Não houve base para integrar o recorte experimental nem homologar o OCR nessa amostra. É necessário um corpus autorizado com transcrição de referência e avaliação de alternativas, incluindo regressões em outras imagens.

## Tradução e revisão independente

A evidência anterior do corpus autoral está em [TR-C1](TR-C1-VALIDACAO.md), [matriz](evidencias/tr-c1/qualidade.csv) e [saídas segmentadas](evidencias/tr-c1/m2m100-segmented.json). Nas seis linhas de texto longo segmentado, a revisão anterior registrou números, negações e conteúdo preservados no corpus, mas nomes literais ausentes em duas linhas. A revisão foi feita pelo implementador, não por avaliador bilíngue independente; não demonstra fidelidade geral nem qualidade jurídica.

Para avaliação independente, o revisor humano deve confrontar cada saída com a fonte correspondente em `apps/client/src/platform/__fixtures__/tr-c1/corpus.ts`, nas seis direções pt/en/es. As saídas estão em `passes[].samples` nos arquivos JSON. Registrar por caso e par: nome preservado literalmente, números e datas, negação, obrigação, omissão ou adição, gravidade e correção sugerida. Revisar também as frases curtas em [saídas da baseline](evidencias/tr-c1/m2m100.json), identificando a segmentação usada. Qualquer aprovação deve citar o conjunto examinado, o revisor e suas limitações; a revisão ainda não havia sido realizada nessa etapa. Em 29/10/2026, o usuário revisou a ficha e aprovou os 30 casos; a [investigação posterior](INVESTIGACAO-OCR-TRADUCAO-2026-10-29.md) registra o resultado e as diferenças literais de nomes.


Em nova tentativa no aplicativo instalado, com perfil WebView2 temporário, o download dos dois arquivos grandes do modelo terminou em `ERR_CONNECTION_RESET` no CDN e a interface informou falha de rede; não houve tradução a avaliar nessa tentativa. Consultas HEAD seguindo redirecionamentos aos dois arquivos do modelo retornaram HTTP 200, o que não comprova download integral. A causa da interrupção não foi isolada. O ensaio automatizado real permanece reexecutável com `NEXOHUB_TRANSLATION_REAL=1`; sua falha neste ambiente não deve ser interpretada como aprovação de qualidade ou como prova de defeito no serviço de origem. Uma prova HTTP de faixa recebeu 1.048.576 bytes do encoder; não comprova a transferência completa.

## Documentação

Produto e arquitetura foram reconciliados com o catálogo de 36 ferramentas implementadas e com o modelo web M2M100. O roadmap distingue assinatura do instalador pendente e limites de reparo. Os 35 perfis do fechamento histórico Q-C0 continuam correspondendo àquele recorte e não foram reclassificados.
