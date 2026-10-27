// SPDX-License-Identifier: MPL-2.0
// Corpus autoral, sem documentos de terceiros ou dados pessoais.
export const longHtmlTable = `<title>Tabela autoral DOC-C3</title><table><thead><tr><th>Identificador</th><th>Descrição</th></tr></thead><tbody>${Array.from({ length: 110 }, (_, i) => `<tr><td>Registro ${i}</td><td>Valor ${i}</td></tr>`).join("")}<tr><td>ULTIMO-REGISTRO</td><td>FIM-TABELA</td></tr></tbody></table>`;

export const wideUnicodeHtmlTable = `<table><thead><tr>${Array.from({ length: 8 }, (_, i) => `<th>Coluna ${i}</th>`).join("")}</tr></thead><tbody>${Array.from({ length: 12 }, (_, row) => `<tr>${Array.from({ length: 8 }, (_, col) => `<td>R${row}C${col} — 中文 ✅ ${"L".repeat(35)}</td>`).join("")}</tr>`).join("")}</tbody></table><p>ULTIMO-UNICODE</p>`;

export const explicitHtmlBreaks =
  '<div style="break-before:page"><p>PRIMEIRO</p></div><p style="page-break-before:always">SEGUNDO</p><div style="break-after:page"><p>TERCEIRO</p></div><p>QUARTO</p><div style="page-break-after:always"></div>';

export const oversizedHtmlHeader = `<table><thead><tr><th>${"CABECALHO ".repeat(2000)}</th></tr></thead><tbody><tr><td>FIM</td></tr></tbody></table>`;
