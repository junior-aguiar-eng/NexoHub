// Corpus sintético autoral MPL-2.0, sem dados de usuário.
export const comparisonReference = {
  original: [
    "🙂 Ação e certidão.",
    "Repetida",
    "Código 00123 — valor R$ 1.234,56.",
    "",
    "Repetida",
    "<script>globalThis.__qC0 = 1</script>",
    "Fim.",
  ].join("\r\n"),
  modified: [
    "🙂 Ação e certidão.",
    "Inserida: João.",
    "Repetida",
    "Código 00124 — valor R$ 0,50.",
    "",
    "Repetida",
    "<script>globalThis.__qC0 = 1</script>",
    "Fim.",
  ].join("\n"),
} as const;

export const reviewReference = {
  original:
    "🙂 Eu fasso isso. Este relatóriu está incorreto.\nCPF 123.456.789-00; CNPJ 12.345.678/0001-90.\nhttps://exemplo.invalid/fasso pessoa@fasso.invalid {{fasso}} ${fasso}\nCódigo 00123 — valor R$ 1.234,56.",
  corrected:
    "🙂 Eu faço isso. Este relatório está incorreto.\nCPF 123.456.789-00; CNPJ 12.345.678/0001-90.\nhttps://exemplo.invalid/fasso pessoa@fasso.invalid {{fasso}} ${fasso}\nCódigo 00123 — valor R$ 1.234,56.",
} as const;
