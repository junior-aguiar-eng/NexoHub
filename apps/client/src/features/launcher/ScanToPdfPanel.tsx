import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Filter,
  RefreshCw,
  RotateCw,
  ScanLine,
  Trash2,
  UploadCloud,
  VideoOff,
} from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { ScanFilterType, ScannedPageItem } from "@/platform/scan-to-pdf-engine";

export interface ScanToPdfPanelProps {
  readonly pages: readonly ScannedPageItem[];
  readonly onPagesChange: (pages: ScannedPageItem[]) => void;
  readonly pageSize: "A4" | "Letter" | "fit";
  readonly onPageSizeChange: (size: "A4" | "Letter" | "fit") => void;
  readonly orientation: "portrait" | "landscape" | "auto";
  readonly onOrientationChange: (orientation: "portrait" | "landscape" | "auto") => void;
  readonly margin: "none" | "small" | "normal";
  readonly onMarginChange: (margin: "none" | "small" | "normal") => void;
}

export function ScanToPdfPanel({
  pages,
  onPagesChange,
  pageSize,
  onPageSizeChange,
  orientation,
  onOrientationChange,
  margin,
  onMarginChange,
}: ScanToPdfPanelProps) {
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const requestId = useRef(0);
  const mounted = useRef(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    requestId.current++;
    for (const track of streamRef.current?.getTracks() ?? []) track.stop();
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setIsCameraActive(false);
    setIsStarting(false);
  }, []);

  async function startCamera(mode: "environment" | "user" = facingMode) {
    stopCamera();
    const request = ++requestId.current;
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(translate("scanToPdf.cameraUnavailable"));
      return;
    }
    setIsStarting(true);
    let acquired: MediaStream | undefined;
    try {
      acquired = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (!mounted.current || request !== requestId.current) {
        for (const track of acquired.getTracks()) track.stop();
        return;
      }
      const video = videoRef.current;
      if (!video) throw new Error("VIDEO_UNAVAILABLE");
      streamRef.current = acquired;
      video.srcObject = acquired;
      await video.play();
      if (mounted.current && request === requestId.current) setIsCameraActive(true);
    } catch {
      if (request === requestId.current && mounted.current) {
        for (const track of acquired?.getTracks() ?? []) track.stop();
        streamRef.current = null;
        if (videoRef.current) videoRef.current.srcObject = null;
        setCameraError(translate("scanToPdf.cameraUnavailable"));
        setIsCameraActive(false);
      }
    } finally {
      if (request === requestId.current && mounted.current) setIsStarting(false);
    }
  }

  function handleSwitchCamera() {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    void startCamera(nextFacing);
  }

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current++;
      for (const track of streamRef.current?.getTracks() ?? []) track.stop();
      streamRef.current = null;
    };
  }, []);

  // Capturar frame da câmera
  async function handleCaptureFrame() {
    if (!videoRef.current) return;
    setIsCapturing(true);

    try {
      const video = videoRef.current;
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) return;

      const bytes = new Uint8Array(await blob.arrayBuffer());
      const newPage: ScannedPageItem = {
        id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        imageBytes: bytes,
        mimeType: "image/jpeg",
        rotation: 0,
        filter: "original",
      };

      onPagesChange([...pages, newPage]);
    } finally {
      setTimeout(() => setIsCapturing(false), 200);
    }
  }

  const [previewUrls, setPreviewUrls] = useState(new Map<string, string>());
  useEffect(() => {
    const urls = new Map(
      pages.map((item) => [
        item.id,
        URL.createObjectURL(
          new Blob([item.imageBytes as BlobPart], { type: item.mimeType || "image/jpeg" }),
        ),
      ]),
    );
    setPreviewUrls(urls);
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [pages]);

  // Upload alternativo de imagens
  async function handleImageUpload(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const newPages: ScannedPageItem[] = await Promise.all(
      files.map(async (file, idx) => ({
        id: `upload-${Date.now()}-${idx}`,
        imageBytes: new Uint8Array(await file.arrayBuffer()),
        mimeType: file.type || "image/jpeg",
        rotation: 0,
        filter: "original" as const,
      })),
    );

    onPagesChange([...pages, ...newPages]);
  }

  function handleRotatePage(pageId: string) {
    onPagesChange(
      pages.map((p) => (p.id === pageId ? { ...p, rotation: ((p.rotation || 0) + 90) % 360 } : p)),
    );
  }

  function handleFilterChange(pageId: string, filter: ScanFilterType) {
    onPagesChange(pages.map((p) => (p.id === pageId ? { ...p, filter } : p)));
  }

  function handleRemovePage(pageId: string) {
    onPagesChange(pages.filter((p) => p.id !== pageId));
  }

  function handleMove(index: number, direction: "left" | "right") {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const next = [...pages];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    onPagesChange(next);
  }

  return (
    <div
      className="flex flex-col gap-6 w-full max-w-6xl mx-auto p-4 sm:p-6"
      data-testid="scan-to-pdf-panel"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-surface border border-border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-sky-500/10 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
            <Camera className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">
              {translate("scanToPdf.title")}
            </h2>
            <p className="text-xs text-text-tertiary">
              {translate("scanToPdf.capturedPages").replace("{count}", String(pages.length))}
            </p>
          </div>
        </div>

        {/* Actions buttons */}
        <div className="flex items-center gap-2">
          {!isCameraActive ? (
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => void startCamera()}
              disabled={isStarting}
              className="text-xs h-9"
            >
              <Camera className="w-4 h-4 mr-1.5" />
              {translate("scanToPdf.startCamera")}
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={handleSwitchCamera}
                className="text-xs h-9"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1" />
                {translate("scanToPdf.switchCamera")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="compact"
                onClick={stopCamera}
                className="text-xs h-9 text-red-600 hover:text-red-700"
              >
                <VideoOff className="w-3.5 h-3.5 mr-1" />
                {translate("scanToPdf.stopCamera")}
              </Button>
            </div>
          )}

          <label className="cursor-pointer">
            <span className="px-3 py-2 rounded-xl border border-border bg-surface text-xs font-medium text-text-primary hover:bg-surface-secondary transition-colors inline-flex items-center shadow-xs">
              <UploadCloud className="w-3.5 h-3.5 mr-1.5" />
              {translate("scanToPdf.uploadFiles")}
            </span>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageUpload}
            />
          </label>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-surface-secondary/40 border border-border">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scan-page-size" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.pageSize")}
          </label>
          <select
            id="scan-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(e.target.value as "A4" | "Letter" | "fit")}
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="A4">A4 (210 × 297 mm)</option>
            <option value="Letter">Carta / Letter</option>
            <option value="fit">Ajustar ao tamanho da foto</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="scan-orientation" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.orientation")}
          </label>
          <select
            id="scan-orientation"
            value={orientation}
            onChange={(e) =>
              onOrientationChange(e.target.value as "portrait" | "landscape" | "auto")
            }
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="auto">Automática (baseada na foto)</option>
            <option value="portrait">{translate("htmlToPdf.orientationPortrait")}</option>
            <option value="landscape">{translate("htmlToPdf.orientationLandscape")}</option>
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="scan-margins" className="text-xs font-medium text-text-secondary">
            {translate("htmlToPdf.margins")}
          </label>
          <select
            id="scan-margins"
            value={margin}
            onChange={(e) => onMarginChange(e.target.value as "none" | "small" | "normal")}
            className="w-full px-3 py-2 text-xs rounded-xl border border-border bg-surface text-text-primary focus:outline-hidden focus:ring-2 focus:ring-sky-500/40"
          >
            <option value="none">{translate("htmlToPdf.marginsNone")}</option>
            <option value="small">{translate("htmlToPdf.marginsSmall")}</option>
            <option value="normal">{translate("htmlToPdf.marginsNormal")}</option>
          </select>
        </div>
      </div>

      {cameraError && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-300 text-xs">
          {cameraError}
        </div>
      )}

      {/* Live Camera Viewfinder (if active) */}
      {
        <div
          style={{ display: isCameraActive ? undefined : "none" }}
          className="relative w-full aspect-video max-h-96 rounded-2xl overflow-hidden bg-black border border-border shadow-md flex items-center justify-center"
        >
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />

          {/* Framing Guide Overlay */}
          <div className="absolute inset-8 border-2 border-dashed border-white/60 rounded-xl pointer-events-none flex items-center justify-center">
            <span className="text-[11px] font-semibold text-white/80 bg-black/50 px-2.5 py-1 rounded-full uppercase tracking-wider">
              Enquadre o documento aqui
            </span>
          </div>

          {/* Capture Trigger Button */}
          <div className="absolute bottom-4 inset-x-0 flex items-center justify-center">
            <button
              type="button"
              onClick={handleCaptureFrame}
              disabled={isCapturing}
              className={`w-16 h-16 rounded-full bg-white text-sky-600 flex items-center justify-center shadow-lg transition-transform active:scale-90 ${
                isCapturing ? "ring-4 ring-sky-400 opacity-80" : "hover:scale-105"
              }`}
              aria-label={translate("scanToPdf.capture")}
            >
              <div className="w-12 h-12 rounded-full border-4 border-sky-600 bg-white" />
            </button>
          </div>
        </div>
      }

      {/* Captured Pages Gallery */}
      {pages.length === 0 && !isCameraActive ? (
        <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-border rounded-2xl bg-surface text-center">
          <ScanLine className="w-12 h-12 text-sky-500 mb-4" />
          <h3 className="text-base font-semibold text-text-primary mb-1">
            Nenhuma página digitalizada ainda
          </h3>
          <p className="text-xs text-text-tertiary mb-6 max-w-sm">
            Clique em "Iniciar Câmera" para fotografar páginas de documentos ou carregue fotos do
            seu dispositivo.
          </p>
          <Button
            type="button"
            variant="secondary"
            size="compact"
            onClick={() => void startCamera()}
            disabled={isStarting}
            className="text-xs"
          >
            <Camera className="w-4 h-4 mr-1.5" />
            Iniciar Câmera
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            {translate("scanToPdf.capturedPages").replace("{count}", String(pages.length))}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {pages.map((item, idx) => {
              return (
                <div
                  key={item.id}
                  data-testid={`scanned-item-${idx + 1}`}
                  className="flex flex-col gap-3 p-3 rounded-2xl border border-border bg-surface shadow-xs"
                >
                  {/* Top Bar with Number and Actions */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary">
                      Pág. {idx + 1}
                    </span>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={idx === 0}
                        onClick={() => handleMove(idx, "left")}
                        aria-label={translate("scanToPdf.moveLeft")}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary disabled:opacity-30"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={idx === pages.length - 1}
                        onClick={() => handleMove(idx, "right")}
                        aria-label={translate("scanToPdf.moveRight")}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary disabled:opacity-30"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRotatePage(item.id)}
                        aria-label={translate("scanToPdf.rotatePage")}
                        className="w-6 h-6 rounded flex items-center justify-center text-text-tertiary hover:text-text-primary"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemovePage(item.id)}
                        aria-label={translate("scanToPdf.removePage")}
                        className="w-6 h-6 rounded flex items-center justify-center text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Image */}
                  <div className="relative w-full aspect-[1/1.414] rounded-lg overflow-hidden border border-border bg-black/5 flex items-center justify-center">
                    <img
                      src={previewUrls.get(item.id)}
                      alt={`Página digitalizada ${idx + 1}`}
                      style={{
                        transform: `rotate(${item.rotation || 0}deg)`,
                      }}
                      className="w-full h-full object-contain"
                    />
                  </div>

                  {/* Filter Selector */}
                  <div className="flex flex-col gap-1">
                    <label
                      htmlFor={`filter-${item.id}`}
                      className="text-[11px] font-medium text-text-secondary flex items-center gap-1"
                    >
                      <Filter className="w-3 h-3 text-sky-500" />
                      {translate("scanToPdf.filter")}
                    </label>
                    <select
                      id={`filter-${item.id}`}
                      value={item.filter || "original"}
                      onChange={(e) =>
                        handleFilterChange(item.id, e.target.value as ScanFilterType)
                      }
                      className="w-full px-2 py-1 text-xs rounded-lg border border-border bg-surface text-text-primary"
                    >
                      <option value="original">{translate("scanToPdf.filterOriginal")}</option>
                      <option value="bw">{translate("scanToPdf.filterBw")}</option>
                      <option value="grayscale">{translate("scanToPdf.filterGrayscale")}</option>
                      <option value="contrast">{translate("scanToPdf.filterContrast")}</option>
                    </select>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
