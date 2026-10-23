import type { TextDiffResult } from "@nexohub/domain";

export type PdfCompareMode = "text" | "visual";
export interface PdfComparisonRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export interface PdfComparisonPair {
  readonly index: number;
  readonly leftPage: number | null;
  readonly rightPage: number | null;
  readonly status: "unchanged" | "modified" | "added" | "removed";
  readonly leftText: string;
  readonly rightText: string;
  readonly textDiff: TextDiffResult;
  readonly textChanged: boolean;
  readonly visualChanged: boolean;
  readonly geometryChanged?: boolean;
  readonly visualDifferenceRatio: number;
  readonly regions: readonly PdfComparisonRegion[];
  readonly leftImage?: string;
  readonly rightImage?: string;
  readonly diffImage?: string;
  readonly width: number;
  readonly height: number;
}
export interface PdfComparisonResult {
  readonly pairs: readonly PdfComparisonPair[];
  readonly leftPageCount: number;
  readonly rightPageCount: number;
  readonly leftHasText: boolean;
  readonly rightHasText: boolean;
}
export interface PdfComparisonProgress {
  readonly progress: number;
  readonly phase: "reading" | "aligning" | "comparing" | "done";
  readonly currentPage?: number;
  readonly totalPages?: number;
}
export interface PdfComparisonOptions {
  readonly signal?: AbortSignal;
  readonly onProgress?: (info: PdfComparisonProgress) => void;
}
