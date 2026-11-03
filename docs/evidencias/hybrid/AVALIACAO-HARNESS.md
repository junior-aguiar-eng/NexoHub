# Harness de avaliação de motores (Tarefa 8) — 03/11/2026

Ferramenta para decidir, com números, se um motor de nuvem (OCR, tradução, Office para PDF) é
melhor que o motor local que ele pretende complementar. **Não chama a nuvem sozinha, não homologa
nada e não substitui revisão humana.** Está pronta para receber motores reais quando houver projeto,
credenciais e autorização; hoje só roda os motores locais já registrados.

## Como usar

```bash
node scripts/cloud/avaliar-motores.mjs                      # relatório na tela
node scripts/cloud/avaliar-motores.mjs --saida <diretório>  # grava avaliacao.json e avaliacao.md
node --test scripts/cloud/avaliacao.test.mjs                # testes (a CI já os executa)
```

Para avaliar um motor novo, basta implementar `{ id, tipo, versao, tipos, aceita?, estimarCustoMicros?,
executar(item) }` e passá-lo a `avaliar()` (`scripts/cloud/avaliacao/executor.mjs`). O motor devolve
`{ texto }` (OCR e tradução) ou `{ office: { paginas, texto, fontes?, tabelas? } }`, e opcionalmente
`custoMicros` e `ms`.

## O que é medido

| Tipo | Métricas |
| --- | --- |
| OCR | CER, WER e números da referência ausentes na saída |
| Tradução | nomes que devem aparecer literalmente, números ausentes, marcador de negação |
| Office → PDF | páginas, CER/WER do texto contra a referência, fontes ausentes, diferença de tabelas |
| Todos | tempo frio e quente (p50/p95), custo e bytes de saída |

Definições (todas testadas):

- **CER/WER**: idênticos a `scripts/medir-ocr-c1.mjs`. NFC, espaços colapsados; distância de edição por
  ponto de código (CER) e por palavra (WER). Acento e caixa contam.
- **Números**: comparados por grupos de dígitos (`1.234,56` e `1,234.56` dão os mesmos grupos), com
  semântica de conjunto, como na revisão do TR-C1.
- **Nomes**: correspondência literal em NFC (`María` não vale por `Maria`).
- **Negação**: heurística por lista de marcadores em pt/en/es. **Só aponta saídas que perderam todo
  marcador para a revisão humana; não prova que o sentido foi preservado.**

## Travas (valem para qualquer motor de nuvem)

1. **Item privado nunca é enviado** sem `permitirPrivados` explícito: o motor nem é chamado.
2. **Sem estimativa de custo, sem chamada** (falha fechada); estimativa inválida também barra.
3. **Teto de US$ 5** (5.000.000 micro-USD, o suborçamento do plano): a chamada que o ultrapassaria é
   barrada antes de acontecer; se o custo real exceder a estimativa, o relatório marca `EXCEDIDO`.
4. **Erros guardam só o código**, nunca a mensagem (pode conter trecho do documento). O relatório e o
   JSON não trazem texto de documentos nem das saídas.
5. Motores locais não têm custo e não sofrem as travas de envio.

## Veredito automático

`comparar()` confronta um motor-base com um candidato nos itens em comum:
- menos de 10 itens em comum → **inconclusivo** (o corpus de OCR de hoje tem 4 imagens: sempre
  inconclusivo até ser ampliado);
- OCR/Office: **melhor** só se o CER cair ao menos 20%, o WER não piorar e não surgirem falhas
  novas; **pior** se o CER subir mais de 10% ou houver mais falhas;
- tradução: conta só defeitos detectáveis (nome, número, negação); não mede fluência nem sentido.

O resultado sempre traz `homologado: false` e `exigeRevisaoHumana: true`. Pelo plano, motor que não
for claramente melhor fica indisponível, e a decisão de trocar de runtime é do usuário.

## Corpus

| Corpus | Itens | Origem | Referência |
| --- | ---: | --- | --- |
| OCR-C1 | 4 imagens sintéticas | `apps/client/src/platform/__fixtures__/ocr-c1/` (SHA-256 conferido) | texto esperado do manifesto |
| TR-C1 | 30 (24 frases + 6 textos longos), pt/en/es | `docs/evidencias/tr-c1/m2m100*.json` | nomes e números dos registros |

A fotografia privada **não** está no corpus: itens privados só entram com a marca `privado: true` e
nunca vão à nuvem sem autorização explícita para cada execução. Falta corpus de Office (documentos
Word/Excel/PowerPoint autorais com PDF de referência) e de OCR em fotografias reais licenciadas.

## Paridade com as medições existentes

Os testes confirmam que as métricas daqui reproduzem o que o projeto já registrou:
- CER/WER iguais (tolerância 1e-12) às 40+ linhas de `docs/ocr-c1/medicoes-2026-10-26.json`;
- nomes e números ausentes iguais, linha a linha, à revisão humana de `docs/evidencias/tr-c1/qualidade.csv`
  para o M2M100 (normal e segmentado);
- a heurística de negação concorda com a revisão humana nas saídas marcadas como preservadas e nas
  fontes sem negação.

## Linha de base local (repetição de registros, não nova medição)

Gerada por `node scripts/cloud/avaliar-motores.mjs`:

| Motor | Tipo | Itens | CER médio | WER médio | Nomes ausentes | Números ausentes | Sem marcador de negação |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| tesseract-registrado | OCR | 4 | 0,65% | 5,00% | 0 | 1 | 0 |
| m2m100-registrado | tradução | 30 | — | — | 5 | 1 | 0 |
| m2m100-segmentado-registrado | tradução | 6 | — | — | 2 | 0 | 0 |

Leitura honesta: em 4 imagens sintéticas o Tesseract erra pouco, e em tradução o M2M100 altera nomes
próprios em 5 de 30 casos (já conhecido e tratado pela lista de nomes a preservar). Isso mostra onde
há espaço para melhorar, mas **não** diz se um motor de nuvem melhoraria: não há comparação enquanto
não houver saída de motor de nuvem sobre o mesmo corpus. Os tempos dos motores registrados são os da
época, sem separação frio/quente.

## O que falta

- Adapters reais de OCR/tradução/Office (dependem de projeto, credenciais e do teste autorizado).
- Corpus maior de OCR (ao menos 10 itens, com fotografias licenciadas) e corpus de Office.
- Extração de texto/fontes/tabelas do PDF convertido para alimentar `compareOffice`.
- Revisão humana das saídas novas de tradução, que este harness só pré-filtra.
