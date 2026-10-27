# Dependências de terceiros da interface

Dependências introduzidas na Fase 1 e licenças declaradas pelos respectivos pacotes instalados:

| Pacote | Licença | Finalidade |
| --- | --- | --- |
| `@base-ui/react` | MIT | Primitivos acessíveis |
| `class-variance-authority` | Apache-2.0 | Variantes tipadas de componentes |
| `clsx` | MIT | Composição condicional de classes |
| `fflate` 0.8.3 | MIT | Extração local e limitada do XML de DOCX, sem upload |
| `tailwind-merge` | MIT | Consolidação de classes utilitárias |
| `tailwindcss` e `@tailwindcss/vite` | MIT | Tokens e pipeline de estilos |
| `lucide-react` | ISC | Ícones de interface |
| `motion` | MIT | Movimento com redução de animação |
| `cropperjs` 2.3.1 e componentes `@cropper/*` 2.3.1 | MIT | Interação local de recorte com alças, sem substituir o motor de exportação |
| `fabric` 7.4.0 | MIT | Interação geométrica no modo avançado de composição; sem canvas/jsdom Node |
| Plus Jakarta Sans | OFL-1.1 | Tipografia local de interface |
| Playfair Display | OFL-1.1 | Tipografia local editorial |

As fontes são distribuídas no bundle por pacotes Fontsource; nenhuma fonte ou biblioteca é carregada
por CDN em tempo de execução.

Cropper é carregado sob demanda na ferramenta de recorte. Os avisos dos 12 pacotes instalados
estão em `apps/client/public/licenses/image-cropper/`; a conferência de licenças e a limitação
da auditoria global neste ambiente estão registradas em [IMAGE-WEB-QUALITY.md](IMAGE-WEB-QUALITY.md).

A leitura de DOCX usa a implementação ZIP em JavaScript do `fflate`, sem dependências transitivas,
e o parser XML nativo do navegador. A versão é fixada no lockfile; a extração limita a entrada a
64 MiB e o XML principal a 16 MiB, inclusive quando o tamanho declarado no ZIP está incorreto.

## Processamento de imagens no website

Pica 10.0.3 e os pacotes jSquash JPEG 1.6.0, WebP 1.5.0 e OxiPNG 2.3.0 são carregados
sob demanda. Pica declara MIT; os wrappers jSquash declaram Apache-2.0. Avisos dos wrappers
e licenças upstream de MozJPEG, libwebp e OxiPNG estão distribuídos em
`apps/client/public/licenses/image-codecs/`. Avaliação de necessidade, tamanho, limites e
medição: [IMAGE-WEB-QUALITY.md](IMAGE-WEB-QUALITY.md).

Fabric.js é importado somente no modo avançado da marca d’água. Avisos MIT e OFL da fonte local
Inter acompanham o build em `apps/client/public/licenses/image-composition/`. O renderizador
de prévia e download usa Canvas no worker existente; sem dependência de Fabric no worker.

O relatório de comparação incorpora Source Sans 3 3.052R (OFL-1.1), com licença e hash em
`apps/client/public/fonts/pdf-comparison/`. A incorporação usa `@pdf-lib/fontkit` 1.1.1
(MIT declarado; README upstream acompanha os arquivos). Fonte, necessidade, manutenção,
tamanho e validação estão registrados em [COMPARAR-PDF-WEB.md](COMPARAR-PDF-WEB.md).

OCR-C1 (26/10/2026) mantém Tesseract.js/core 7.0.0 já instalados, sem dependência nova.
O binário `@techstark/opencv-js@4.12.0-release.1` (Apache-2.0 declarado) foi medido em
prova isolada e reprovado para integração; não integra o bundle nem o lockfile. Tamanho,
SHA-256, origem, custo dos recursos existentes e limites da avaliação estão em
[OCR-C1.md](OCR-C1.md) e seu JSON de medições. Não há aprovação de redistribuição desse candidato.

## Alcance do inventário e do Q-C0

O arquivo `THIRD_PARTY_LICENSES.md` na raiz é o inventário gerado por
`pnpm licenses:generate`; este documento registra decisões e avisos específicos da interface.
`pnpm licenses:check` avalia o inventário e as famílias de licença configuradas, sem conferir
automaticamente se o texto gerado da raiz está atualizado. Nenhum desses comandos equivale
à aprovação de todos os binários, WASM, fontes ou pesos de modelos distribuídos.

O [índice Q-C0](quality/README.md) preserva origem/licença declaradas e hashes dos materiais
referenciados. Não relicencia material de terceiros nem substitui verificação de manutenção,
advisories ou obrigações de distribuição. A licença dos geradores autorais não se estende
automaticamente a bibliotecas, fontes ou modelos usados na geração.

Para tradução, consultar [TRADUCAO-WEB.md](TRADUCAO-WEB.md) e o
[NOTICE M2M100](evidencias/tr-c1/M2M100-NOTICE.md). qpdf, OpenCV, Camelot/Docling e AVIF
continuam avaliações isoladas, sem adoção pelo índice; seus limites permanecem nos relatórios
[R-C1](R-C1-VALIDACAO.md), [OCR-C1](OCR-C1.md), [XL-C1](XL-C1.md) e
[IM-C4](IM-C4-AVIF.md). DOC-C2 permanece fora do escopo.

## Revisão Q-C0 — 27/10/2026

Vitest foi atualizado de 4.1.11 para 4.1.12 nos quatro pacotes que o declaram. O piso de
undici passou a 8.12.2, resolvido como 8.12.3, e setuptools foi atualizado de 84.0.0 para
84.1.0 no lock Python. A auditoria npm passou de cinco advisories (um alto) para zero;
`uv audit --locked --project engines/python` passou de um advisory para zero em 34 pacotes.
Os componentes atualizados declaram MIT; não há novo motor ou serviço de runtime.

O inventário JavaScript agora inclui dependências de desenvolvimento: o gerador removia
essas entradas com `--prod` apesar do cabeçalho declarar cobertura de build e teste.
O arquivo da raiz foi regenerado com 796 componentes neste Windows, incluindo as versões
de Vitest/mocker/undici. Dependências opcionais refletem a plataforma instalada.

Validação: 887 testes JavaScript do monorepo e 35 testes Python aprovados após a atualização,
`pnpm check`, `pnpm quality:check` (7 testes) e `pnpm licenses:check` aprovados. Permanecem
dois avisos de lint preexistentes no corpus de texto e avisos de depreciação Swig no Python.
Essas auditorias não representam uma auditoria criptográfica ou de todos os binários nativos.
