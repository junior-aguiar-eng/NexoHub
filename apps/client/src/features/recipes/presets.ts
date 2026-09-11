import type { RecipeSnapshot } from "@nexohub/domain";

export const recipePresets = [
  {
    id: "digitalizacao-limpa",
    name: "Digitalização Limpa",
    parameters: [],
    steps: [
      { id: "ocr", toolId: "pdf-ocr", parameters: {}, dependsOn: [], position: { x: 20, y: 24 } },
      {
        id: "organizar",
        toolId: "pdf-organize",
        parameters: { removeBlankPages: true },
        dependsOn: ["ocr"],
        position: { x: 255, y: 24 },
      },
      {
        id: "comprimir",
        toolId: "pdf-compress",
        parameters: { compressionLevel: 6 },
        dependsOn: ["organizar"],
        position: { x: 490, y: 24 },
      },
    ],
  },
  {
    id: "higienizacao-rapida",
    name: "Higienização Rápida",
    parameters: [],
    steps: [
      {
        id: "organizar",
        toolId: "pdf-organize",
        parameters: { normalizeRotation: true },
        dependsOn: [],
        position: { x: 20, y: 24 },
      },
      {
        id: "comprimir",
        toolId: "pdf-compress",
        parameters: { compressionLevel: 4 },
        dependsOn: ["organizar"],
        position: { x: 255, y: 24 },
      },
    ],
  },
  {
    id: "extracao-editorial",
    name: "Extração Editorial",
    parameters: [],
    steps: [
      { id: "ocr", toolId: "pdf-ocr", parameters: {}, dependsOn: [], position: { x: 20, y: 24 } },
      {
        id: "extrair",
        toolId: "intelligence-extract",
        parameters: { format: "editorial" },
        dependsOn: ["ocr"],
        position: { x: 255, y: 24 },
      },
      {
        id: "revisar",
        toolId: "text-review",
        parameters: {},
        dependsOn: ["extrair"],
        position: { x: 490, y: 24 },
      },
    ],
  },
] as const satisfies readonly RecipeSnapshot[];
