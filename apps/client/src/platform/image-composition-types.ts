interface ImageCompositionGeometry {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly opacity: number;
}
export type ImageCompositionObject = ImageCompositionGeometry &
  (
    | { readonly kind: "text"; readonly text: string; readonly color: string }
    | { readonly kind: "rectangle"; readonly color: string }
    | { readonly kind: "ellipse"; readonly color: string }
    | { readonly kind: "image"; readonly blob: Blob }
  );
export interface ImageCompositionSnapshot {
  readonly objects: readonly ImageCompositionObject[];
}
export type CompositionCommand =
  | { readonly type: "add"; readonly object: ImageCompositionObject; readonly index?: number }
  | { readonly type: "replace"; readonly object: ImageCompositionObject }
  | { readonly type: "remove"; readonly id: string }
  | { readonly type: "reorder"; readonly id: string; readonly index: number };
export type CompositionAction =
  | CompositionCommand
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "reset" };
