import { type Dispatch, lazy, type RefObject, Suspense } from "react";
import { translate } from "@/i18n";
import type { compositionReducer, ImageCompositionState } from "@/platform/image-composition-state";
import type { ImageCompressionLevel, WatermarkPosition } from "@/platform/image-engine";
import type { ScannedPageItem } from "@/platform/scan-to-pdf-engine";
import { ImageCompressPanel } from "../ImageCompressPanel";
import { ImageConvertPanel, type ImageTargetFormat } from "../ImageConvertPanel";
import { type CropRatioPreset, ImageCropPanel } from "../ImageCropPanel";
import { ImageResizePanel } from "../ImageResizePanel";
import { ImageRotatePanel } from "../ImageRotatePanel";
import { ImagesToPdfPanel } from "../ImagesToPdfPanel";
import { ImageWatermarkPanel } from "../ImageWatermarkPanel";
import { ScanToPdfPanel } from "../ScanToPdfPanel";
import type { useImageBatch } from "../useImageBatch";

const ImageCompositionPanel = lazy(() =>
  import("../ImageCompositionPanel").then((module) => ({ default: module.ImageCompositionPanel })),
);

export type ImageToolPanelProps = {
  toolId: string;
  files: File[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  fileThumbnails: ReadonlyMap<File, string>;
  status: "idle" | "running" | "success" | "error";
  handleRemoveFile: (index: number) => void;
  handleReorderFiles: (fromIndex: number, toIndex: number) => void;
  // Images to PDF
  imageOrientation: "portrait" | "landscape" | "auto";
  setImageOrientation: (v: "portrait" | "landscape" | "auto") => void;
  imageMargin: "none" | "small" | "big";
  setImageMargin: (v: "none" | "small" | "big") => void;
  imagePageSize: "A4" | "fit";
  setImagePageSize: (v: "A4" | "fit") => void;
  // Scan to PDF
  scannedPages: ScannedPageItem[];
  setScannedPages: (v: ScannedPageItem[]) => void;
  scanPageSize: "A4" | "Letter" | "fit";
  setScanPageSize: (v: "A4" | "Letter" | "fit") => void;
  scanOrientation: "portrait" | "landscape" | "auto";
  setScanOrientation: (v: "portrait" | "landscape" | "auto") => void;
  scanMargin: "none" | "small" | "normal";
  setScanMargin: (v: "none" | "small" | "normal") => void;
  // Shared image preview
  imagePreviewFile: File | undefined;
  imagePreviewUrl: string | undefined;
  imageOriginalDimensions: { width: number; height: number } | undefined;
  imageBatch: ReturnType<typeof useImageBatch>;
  // Compress
  imageCompressionLevel: ImageCompressionLevel;
  setImageCompressionLevel: (v: ImageCompressionLevel) => void;
  // Resize
  imageResizeMode: "percentage" | "pixels";
  setImageResizeMode: (v: "percentage" | "pixels") => void;
  imageResizePercentage: number;
  setImageResizePercentage: (v: number) => void;
  imageResizeWidth: number;
  setImageResizeWidth: (v: number) => void;
  imageResizeHeight: number;
  setImageResizeHeight: (v: number) => void;
  imageMaintainAspect: boolean;
  setImageMaintainAspect: (v: boolean) => void;
  imageDoNotEnlarge: boolean;
  setImageDoNotEnlarge: (v: boolean) => void;
  // Crop
  imageCropPreset: CropRatioPreset;
  setImageCropPreset: (v: CropRatioPreset) => void;
  imageCropX: number;
  setImageCropX: (v: number) => void;
  imageCropY: number;
  setImageCropY: (v: number) => void;
  imageCropWidth: number;
  setImageCropWidth: (v: number) => void;
  imageCropHeight: number;
  setImageCropHeight: (v: number) => void;
  // Convert
  imageTargetFormat: ImageTargetFormat;
  setImageTargetFormat: (v: ImageTargetFormat) => void;
  imageConvertQuality: number;
  setImageConvertQuality: (v: number) => void;
  // Rotate
  imageRotateAngle: 0 | 90 | 180 | 270;
  setImageRotateAngle: (v: 0 | 90 | 180 | 270) => void;
  imageFlipHorizontal: boolean;
  setImageFlipHorizontal: (v: boolean) => void;
  imageFlipVertical: boolean;
  setImageFlipVertical: (v: boolean) => void;
  // Watermark & Composition
  compositionMode: boolean;
  setCompositionMode: (v: boolean) => void;
  compositionValid: boolean;
  compositionState: ImageCompositionState;
  compositionDispatch: Dispatch<Parameters<typeof compositionReducer>[1]>;
  setCompositionAssetPending: (v: boolean) => void;
  imageWatermarkFile: File | null;
  setImageWatermarkFile: (v: File | null) => void;
  imageWatermarkType: "text" | "image";
  setImageWatermarkType: (v: "text" | "image") => void;
  imageWatermarkText: string;
  setImageWatermarkText: (v: string) => void;
  imageWatermarkColor: string;
  setImageWatermarkColor: (v: string) => void;
  imageWatermarkOpacity: number;
  setImageWatermarkOpacity: (v: number) => void;
  imageWatermarkRotation: number;
  setImageWatermarkRotation: (v: number) => void;
  imageWatermarkPosition: WatermarkPosition;
  setImageWatermarkPosition: (v: WatermarkPosition) => void;
};

export function renderImageToolPanel(p: ImageToolPanelProps): React.ReactNode | undefined {
  if (p.toolId === "images-to-pdf") {
    return (
      <ImagesToPdfPanel
        files={p.files}
        thumbnails={p.fileThumbnails}
        orientation={p.imageOrientation}
        margin={p.imageMargin}
        pageSize={p.imagePageSize}
        onOrientationChange={p.setImageOrientation}
        onMarginChange={p.setImageMargin}
        onPageSizeChange={p.setImagePageSize}
        onRemoveFile={p.handleRemoveFile}
        onReorderFiles={p.handleReorderFiles}
        onAddMoreFiles={() => p.fileInputRef.current?.click()}
      />
    );
  }

  if (p.toolId === "scan-to-pdf") {
    return (
      <ScanToPdfPanel
        pages={p.scannedPages}
        onPagesChange={p.setScannedPages}
        pageSize={p.scanPageSize}
        onPageSizeChange={p.setScanPageSize}
        orientation={p.scanOrientation}
        onOrientationChange={p.setScanOrientation}
        margin={p.scanMargin}
        onMarginChange={p.setScanMargin}
      />
    );
  }

  if (p.toolId === "image-compress") {
    return (
      <ImageCompressPanel
        fileName={p.imagePreviewFile?.name || "imagem.jpg"}
        fileSizeBytes={p.imagePreviewFile?.size || 0}
        thumbnailUrl={p.imagePreviewUrl ?? undefined}
        dimensions={p.imageOriginalDimensions ?? undefined}
        level={p.imageCompressionLevel}
        losslessOnly={
          p.imageBatch.entries.length > 0 &&
          p.imageBatch.entries.every((entry) => entry.metadata?.mimeType === "image/png")
        }
        onLevelChange={p.setImageCompressionLevel}
      />
    );
  }

  if (p.toolId === "image-resize") {
    return (
      <ImageResizePanel
        fileName={p.imagePreviewFile?.name || "imagem.jpg"}
        fileSizeBytes={p.imagePreviewFile?.size || 0}
        thumbnailUrl={p.imagePreviewUrl ?? undefined}
        originalDimensions={p.imageOriginalDimensions ?? undefined}
        mode={p.imageResizeMode}
        onModeChange={p.setImageResizeMode}
        percentage={p.imageResizePercentage}
        onPercentageChange={p.setImageResizePercentage}
        width={p.imageResizeWidth}
        onWidthChange={p.setImageResizeWidth}
        height={p.imageResizeHeight}
        onHeightChange={p.setImageResizeHeight}
        maintainAspectRatio={p.imageMaintainAspect}
        onMaintainAspectRatioChange={p.setImageMaintainAspect}
        doNotEnlarge={p.imageDoNotEnlarge}
        onDoNotEnlargeChange={p.setImageDoNotEnlarge}
      />
    );
  }

  if (p.toolId === "image-crop") {
    return (
      <ImageCropPanel
        fileName={p.imagePreviewFile?.name || "imagem.jpg"}
        fileSizeBytes={p.imagePreviewFile?.size || 0}
        thumbnailUrl={p.imagePreviewUrl ?? undefined}
        originalDimensions={p.imageOriginalDimensions ?? undefined}
        ratio={p.imageCropPreset}
        onRatioChange={p.setImageCropPreset}
        cropX={p.imageCropX}
        onCropXChange={p.setImageCropX}
        cropY={p.imageCropY}
        onCropYChange={p.setImageCropY}
        cropWidth={p.imageCropWidth}
        onCropWidthChange={p.setImageCropWidth}
        cropHeight={p.imageCropHeight}
        onCropHeightChange={p.setImageCropHeight}
      />
    );
  }

  if (p.toolId === "image-convert") {
    return (
      <ImageConvertPanel
        fileName={p.imagePreviewFile?.name || "imagem.jpg"}
        fileSizeBytes={p.imagePreviewFile?.size || 0}
        thumbnailUrl={p.imagePreviewUrl ?? undefined}
        originalDimensions={p.imageOriginalDimensions ?? undefined}
        targetFormat={p.imageTargetFormat}
        onTargetFormatChange={p.setImageTargetFormat}
        quality={p.imageConvertQuality}
        onQualityChange={p.setImageConvertQuality}
      />
    );
  }

  if (p.toolId === "image-rotate") {
    return (
      <ImageRotatePanel
        fileName={p.imagePreviewFile?.name || "imagem.jpg"}
        fileSizeBytes={p.imagePreviewFile?.size || 0}
        thumbnailUrl={p.imagePreviewUrl ?? undefined}
        originalDimensions={p.imageOriginalDimensions ?? undefined}
        angle={p.imageRotateAngle}
        onAngleChange={p.setImageRotateAngle}
        flipHorizontal={p.imageFlipHorizontal}
        onFlipHorizontalChange={p.setImageFlipHorizontal}
        flipVertical={p.imageFlipVertical}
        onFlipVerticalChange={p.setImageFlipVertical}
      />
    );
  }

  if (p.toolId === "image-watermark") {
    return (
      <>
        <fieldset className="image-composition-mode" aria-label={translate("composition.advanced")}>
          <button
            type="button"
            disabled={p.status === "running"}
            aria-pressed={!p.compositionMode}
            onClick={() => p.setCompositionMode(false)}
          >
            {translate("composition.quick")}
          </button>
          <button
            type="button"
            disabled={p.status === "running"}
            aria-pressed={p.compositionMode}
            onClick={() => p.setCompositionMode(true)}
          >
            {translate("composition.advanced")}
          </button>
        </fieldset>
        {p.compositionMode &&
        p.imagePreviewFile &&
        p.imagePreviewUrl &&
        p.imageOriginalDimensions ? (
          <>
            {!p.compositionValid && p.compositionState.objects.length > 0 && (
              <p role="alert">{translate("composition.invalid")}</p>
            )}
            <Suspense fallback={<p role="status">{translate("composition.pending")}</p>}>
              <ImageCompositionPanel
                file={p.imagePreviewFile}
                source={p.imagePreviewUrl}
                width={p.imageOriginalDimensions.width}
                height={p.imageOriginalDimensions.height}
                onAssetPendingChange={p.setCompositionAssetPending}
                state={p.compositionState}
                dispatch={p.compositionDispatch}
                disabled={p.status === "running"}
              />
            </Suspense>
          </>
        ) : (
          <ImageWatermarkPanel
            isProcessing={p.status === "running"}
            fileName={p.imagePreviewFile?.name || "imagem.jpg"}
            fileSizeBytes={p.imagePreviewFile?.size || 0}
            thumbnailUrl={p.imagePreviewUrl ?? undefined}
            originalDimensions={p.imageOriginalDimensions ?? undefined}
            watermarkFile={p.imageWatermarkFile}
            onWatermarkFileChange={p.setImageWatermarkFile}
            watermarkType={p.imageWatermarkType}
            onWatermarkTypeChange={p.setImageWatermarkType}
            text={p.imageWatermarkText}
            onTextChange={p.setImageWatermarkText}
            color={p.imageWatermarkColor}
            onColorChange={p.setImageWatermarkColor}
            opacity={p.imageWatermarkOpacity}
            onOpacityChange={p.setImageWatermarkOpacity}
            rotation={p.imageWatermarkRotation}
            onRotationChange={p.setImageWatermarkRotation}
            position={p.imageWatermarkPosition}
            onPositionChange={p.setImageWatermarkPosition}
          />
        )}
      </>
    );
  }

  return undefined;
}
