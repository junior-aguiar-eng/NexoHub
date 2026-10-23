# Especificação Técnica: Reparar PDF (`pdf-repair`)

- **Identificador de Ferramenta:** `pdf-repair`
- **Categoria:** Otimizar PDF
- **Superfícies:** Quick e Studio
- **Entrada:** `application/pdf`
- **Saída:** `application/pdf`
- **Capacidades Exigidas:** `documents.read`, `documents.write`, `pdf.transform`
- **Executor Previsto:** `browser` (com fallback nativo de alta velocidade)

---

## 1. Objetivo e Princípio de Honestidade Funcional

A ferramenta **Reparar PDF** tem como objetivo recuperar a legibilidade e a estrutura sintática de arquivos PDF danificados, malformados ou corrompidos durante download, transferência ou salvamento incompleto.

Em estrita consonância com o princípio de honestidade técnica do NexoHub:
- Não gera falsas promessas de recuperação quando dados essenciais de páginas foram destruídos.
- Não substitui nem sobrescreve o arquivo original: produz um novo artifact recuperado imutável.
- Em caso de impossibilidade de reconstrução, retorna erros estruturados e explicativos, orientando o usuário.

---

## 2. Cenários Recuperáveis

1. **Tabela de Referências Cruzadas (`xref`) Danificada ou Dessincronizada:**
   - Sintoma: Erros de parser ("Invalid xref table", "Missing xref table").
   - Ação: Varredura sequencial dos objetos indiretos (`\d+ \d+ obj`) para reconstruir a tabela xref do zero com os offsets exatos no arquivo.
2. **Trailer e Dicionário de Catálogo (`Root`) Ausentes ou Incompletos:**
   - Sintoma: Final do arquivo truncado (ausência de `startxref` ou `%%EOF`).
   - Ação: Localização heurística do objeto de Catálogo (`/Type /Catalog`) e da árvore de páginas (`/Pages`), sintetizando um trailer canônico apontando para o Catálogo e re-emitindo a marca de fim de arquivo.
3. **Streams de Objetos com Tamanho Declarado Incorreto (`/Length`):**
   - Sintoma: Erro de leitura de streams antes de atingir `endstream`.
   - Ação: Identificação do marcador delimitador `endstream` real e correção do atributo `/Length`.
4. **Objetos Indiretos Órfãos e Referências Circulares:**
   - Ação: Purga de nós órfãos que causam laços infinitos em leitores convencionais e reconstrução do grafo acíclico de páginas.

---

## 3. Cenários Não Recuperáveis (Falha Explícita)

- Arquivos criptografados cuja senha/chave de descriptografia é desconhecida.
- Arquivos severamente truncados em que a árvore de páginas (`/Pages`) ou os fluxos de conteúdo das páginas foram totalmente destruídos ou preenchidos por bytes nulos (`0x00`).
- Arquivos que não são do formato PDF (ausência de cabeçalho `%PDF-` e sem objetos válidos identificáveis).

Nestes casos, a ferramenta rejeita a operação com o código estruturado `CORRUPTED_DOCUMENT` e mensagem amigável em português explicando a impossibilidade de recuperação dos dados físicos.

---

## 4. Estratégia de Implementação Técnica

- **Ambiente Web:** Mecanismo resiliente local baseado em leitura tolerante a falhas (via parser permissivo do `pdf-lib` em modo de reparo ou worker de reconstrução binária de objetos sem dependência externa adicional).
- **Ambiente Desktop:** Reconstrução equivalente acionável via Document Core Port ou módulo nativo Rust.
