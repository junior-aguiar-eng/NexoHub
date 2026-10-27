/** Corpus sintético autoral MPL-2.0. Não é avaliação jurídica ou benchmark amplo. */
export const translationCases = [
  {
    id: "negacao-nome-data",
    pt: "Maria Silva não autorizou o pagamento de 125 euros em 14/03/2026.",
    en: "Maria Silva did not authorize the payment of 125 euros on 14/03/2026.",
    es: "Maria Silva no autorizó el pago de 125 euros el 14/03/2026.",
    names: ["Maria Silva"],
    numbers: ["125", "14", "03", "2026"],
    negation: true,
  },
  {
    id: "condicao-prazo",
    pt: "O fornecedor não poderá encerrar o contrato sem aviso prévio de 30 dias.",
    en: "The supplier may not terminate the contract without 30 days of prior notice.",
    es: "El proveedor no podrá terminar el contrato sin un aviso previo de 30 días.",
    names: [],
    numbers: ["30"],
    negation: true,
  },
  {
    id: "nome-quantidade",
    pt: "João Costa entregou os 12 documentos em 20 de maio de 2026.",
    en: "João Costa delivered the 12 documents on 20 May 2026.",
    es: "João Costa entregó los 12 documentos el 20 de mayo de 2026.",
    names: ["João Costa"],
    numbers: ["12", "20", "2026"],
    negation: false,
  },
  {
    id: "obrigacao-negativa",
    pt: "A empresa deve guardar os registros por 5 anos e não pode divulgar a senha.",
    en: "The company must keep the records for 5 years and must not disclose the password.",
    es: "La empresa debe conservar los registros durante 5 años y no puede divulgar la contraseña.",
    names: [],
    numbers: ["5"],
    negation: true,
  },
] as const;

export const longText = {
  pt: "Relatório de acompanhamento. Maria Silva confirmou que os 12 documentos foram recebidos. O pagamento de 125 euros ainda não foi autorizado. O fornecedor deve guardar os registros por 5 anos. A senha não pode ser compartilhada. A reunião ocorrerá em 20 de maio de 2026. O prazo para resposta é de 30 dias. Esta conclusão depende da revisão de todos os documentos, e não apenas do primeiro registro.",
  en: "Monitoring report. Maria Silva confirmed that the 12 documents were received. The payment of 125 euros has not yet been authorized. The supplier must keep the records for 5 years. The password must not be shared. The meeting will take place on 20 May 2026. The response deadline is 30 days. This conclusion depends on reviewing all documents, not just the first record.",
  es: "Informe de seguimiento. Maria Silva confirmó que se recibieron los 12 documentos. El pago de 125 euros aún no fue autorizado. El proveedor debe conservar los registros durante 5 años. No se puede compartir la contraseña. La reunión tendrá lugar el 20 de mayo de 2026. El plazo de respuesta es de 30 días. Esta conclusión depende de la revisión de todos los documentos, y no solo del primer registro.",
} as const;
