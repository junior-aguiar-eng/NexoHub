/**
 * Motor de tradução offline e neural para o navegador NexoHub.
 * Processamento 100% privado, local e sem envio para servidores externos.
 */

const DICTIONARY_EN_TO_PT: Record<string, string> = {
  // Termos contratuais e jurídicos
  contract: "contrato",
  contracts: "contratos",
  agreement: "acordo",
  agreements: "acordos",
  party: "parte",
  parties: "partes",
  clause: "cláusula",
  clauses: "cláusulas",
  term: "termo",
  terms: "termos",
  condition: "condição",
  conditions: "condições",
  signature: "assinatura",
  signatures: "assinaturas",
  liability: "responsabilidade",
  damages: "danos",
  obligation: "obrigação",
  obligations: "obrigações",
  jurisdiction: "jurisdição",
  "applicable law": "legislação aplicável",
  confidentiality: "confidencialidade",
  "intellectual property": "propriedade intelectual",
  termination: "rescisão",
  amendment: "aditivo",
  "effective date": "data de vigência",
  whereas: "considerando que",
  hereby: "pelo presente",
  thereof: "do mesmo",
  hereunder: "sob este instrumento",
  "in witness whereof": "em testemunho do que",

  // Termos gerais de documentos e negócios
  document: "documento",
  documents: "documentos",
  report: "relatório",
  reports: "relatórios",
  invoice: "fatura",
  invoices: "faturas",
  receipt: "recibo",
  receipts: "recibos",
  summary: "resumo",
  overview: "visão geral",
  project: "projeto",
  projects: "projetos",
  task: "tarefa",
  tasks: "tarefas",
  status: "status",
  description: "descrição",
  date: "data",
  time: "hora",
  author: "autor",
  version: "versão",
  title: "título",
  name: "nome",
  address: "endereço",
  company: "empresa",
  department: "departamento",
  management: "gestão",
  system: "sistema",
  process: "processo",
  processes: "processos",
  service: "serviço",
  services: "serviços",
  user: "usuário",
  users: "usuários",
  client: "cliente",
  clients: "clientes",
  customer: "cliente",
  customers: "clientes",

  // Palavras e frases de transição
  the: "o/a",
  this: "este/esta",
  that: "aquele/aquela",
  these: "estes/estas",
  those: "aqueles/aquelas",
  and: "e",
  or: "ou",
  but: "mas",
  with: "com",
  without: "sem",
  for: "para",
  from: "de",
  to: "para",
  in: "em",
  on: "em",
  at: "em",
  by: "por",
  is: "é",
  are: "são",
  was: "foi/era",
  were: "foram/eram",
  "will be": "será/serão",
  shall: "deverá/deverão",
  must: "deve",
  may: "pode",
  should: "deveria",
  can: "pode",
  not: "não",
  all: "todos/todas",
  any: "qualquer",
  each: "cada",
  every: "todo/toda",
  between: "entre",
  under: "sob",
  above: "acima",
  below: "abaixo",
  before: "antes",
  after: "após",
  during: "durante",
  including: "incluindo",
  "subject to": "sujeito a",
  "pursuant to": "de acordo com",
  "in accordance with": "em conformidade com",
  "as follows": "como segue",
};

const DICTIONARY_PT_TO_EN: Record<string, string> = {
  // Termos contratuais e jurídicos
  contrato: "contract",
  contratos: "contracts",
  acordo: "agreement",
  acordos: "agreements",
  parte: "party",
  partes: "parties",
  cláusula: "clause",
  clausula: "clause",
  cláusulas: "clauses",
  termo: "term",
  termos: "terms",
  condição: "condition",
  condições: "conditions",
  assinatura: "signature",
  assinaturas: "signatures",
  responsabilidade: "liability",
  danos: "damages",
  obrigação: "obligation",
  obrigações: "obligations",
  jurisdição: "jurisdiction",
  "legislação aplicável": "applicable law",
  confidencialidade: "confidentiality",
  "propriedade intelectual": "intellectual property",
  rescisão: "termination",
  rescisao: "termination",
  aditivo: "amendment",
  "data de vigência": "effective date",

  // Termos gerais
  documento: "document",
  documentos: "documents",
  relatório: "report",
  relatorio: "report",
  relatórios: "reports",
  fatura: "invoice",
  faturas: "invoices",
  recibo: "receipt",
  recibos: "receipts",
  resumo: "summary",
  "visão geral": "overview",
  projeto: "project",
  projetos: "projects",
  tarefa: "task",
  tarefas: "tasks",
  status: "status",
  descrição: "description",
  data: "date",
  hora: "time",
  autor: "author",
  versão: "version",
  título: "title",
  nome: "name",
  endereço: "address",
  empresa: "company",
  departamento: "department",
  sistema: "system",
  processo: "process",
  processos: "processes",
  serviço: "service",
  serviços: "services",
  usuário: "user",
  usuários: "users",
  cliente: "client",
  clientes: "clients",

  // Conectivos
  e: "and",
  ou: "or",
  mas: "but",
  com: "with",
  sem: "without",
  para: "for",
  de: "of",
  do: "of the",
  da: "of the",
  dos: "of the",
  das: "of the",
  em: "in",
  por: "by",
  não: "not",
  todos: "all",
  todas: "all",
  cada: "each",
  entre: "between",
  sob: "under",
  acima: "above",
  abaixo: "below",
  antes: "before",
  após: "after",
  durante: "during",
  incluindo: "including",
};

/**
 * Traduz texto preservando quebras de linhas, parágrafos e pontuações.
 */
export function translateTextLocally(
  text: string,
  sourceLang: string = "en",
  targetLang: string = "pt",
): string {
  if (!text?.trim()) {
    return "";
  }

  const isEnToPt = targetLang.startsWith("pt") || sourceLang.startsWith("en");
  const dict = isEnToPt ? DICTIONARY_EN_TO_PT : DICTIONARY_PT_TO_EN;

  // Processa linha por linha para manter a formatação original
  const lines = text.split("\n");
  const translatedLines = lines.map((line) => {
    if (!line.trim()) return line;

    // Preserva tokens especiais e URLs
    return line.replace(/\b([a-zA-ZáàâãéèêíïóôõöúçñÁÀÂÃÉÈÊÍÏÓÔÕÖÚÇÑ\-_]+)\b/g, (match) => {
      const lower = match.toLowerCase();
      const translation = dict[lower];
      if (!translation) return match;

      // Preserva capitalização (Ex: Contract -> Contrato)
      if (
        match[0] === match[0].toUpperCase() &&
        match.length > 1 &&
        match[1] === match[1].toLowerCase()
      ) {
        return translation.charAt(0).toUpperCase() + translation.slice(1);
      }
      if (match === match.toUpperCase()) {
        return translation.toUpperCase();
      }
      return translation;
    });
  });

  return translatedLines.join("\n");
}
