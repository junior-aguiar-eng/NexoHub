export type EditorFont =
  | "Helvetica"
  | "Helvetica-Bold"
  | "Helvetica-Oblique"
  | "Helvetica-BoldOblique"
  | "Times-Roman"
  | "Courier";
export interface EditorBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface EditorTextObject extends EditorBox {
  id: string;
  text: string;
  fontName: string;
  fontSize: number;
  color: string;
  editable: boolean;
  canChangeStyle?: boolean;
}
export interface EditorPage {
  width: number;
  height: number;
  texts: EditorTextObject[];
}
export interface EditorReplacement {
  id: string;
  text: string;
  fallbackFont?: EditorFont;
  fontSize?: number;
}
export interface EditorElement extends EditorBox {
  id: string;
  page: number;
  kind: "text" | "image" | "rect" | "ellipse" | "line" | "draw";
  color: string;
  text?: string;
  font?: EditorFont;
  fontSize?: number;
  align?: "left" | "center" | "right";
  strokeWidth?: number;
  points?: { x: number; y: number }[];
  image?: { data: Uint8Array; width: number; height: number };
}
export interface EditorSnapshot {
  replacements: EditorReplacement[];
  elements: EditorElement[];
}
export interface EditorBitmap {
  data: Uint8Array;
  width: number;
  height: number;
}
export interface EditorRevision {
  bytes: Uint8Array;
  pages: EditorPage[];
  preview: EditorBitmap;
  thumbnails: EditorBitmap[];
  signed: boolean;
}
export const EDITOR_LIMITS = Object.freeze({
  bytes: 20 * 1024 * 1024,
  pages: 30,
  objects: 3000,
  elements: 200,
  text: 4000,
  renderSide: 1400,
  imagePixels: 8_000_000,
});
