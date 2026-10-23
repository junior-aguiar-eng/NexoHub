import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  GripHorizontal,
  Image as ImageIcon,
  PenTool,
  RotateCcw,
  Type,
  Upload,
} from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useEffect, useRef, useState } from "react";
import { translate } from "@/i18n";
import type { SignaturePlacement } from "@/platform/pdf-engine";

export interface SignPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly placement: SignaturePlacement;
  readonly onPlacementChange: (placement: SignaturePlacement) => void;
  readonly signatureImageBytes?: Uint8Array;
  readonly onSignatureImageChange: (bytes: Uint8Array | undefined, dataUrl?: string) => void;
  readonly signerName: string;
  readonly onSignerNameChange: (name: string) => void;
  readonly includeDate: boolean;
  readonly onIncludeDateChange: (include: boolean) => void;
}

export function SignPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  placement,
  onPlacementChange,
  signatureImageBytes,
  onSignatureImageChange,
  signerName,
  onSignerNameChange,
  includeDate,
  onIncludeDateChange,
}: SignPdfPanelProps) {
  const [currentPage, setCurrentPage] = useState<number>(
    placement.page === "last" || placement.page === undefined
      ? totalPages
      : typeof placement.page === "number"
        ? placement.page
        : 1,
  );
  const [activeTab, setActiveTab] = useState<"draw" | "type" | "upload">("draw");
  const [typedText, setTypedText] = useState<string>("");
  const [penColor, setPenColor] = useState<string>("#0f172a");
  const [penWidth, setPenWidth] = useState<number>(2.5);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string>("");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const uploadUrlRef = useRef<string | undefined>(undefined);

  // Canvas drawing ref
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewContainerRef = useRef<HTMLDivElement | null>(null);

  // Dragging state
  const isDraggingRef = useRef<boolean>(false);
  const dragStartPosRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
  }>({
    clientX: 0,
    clientY: 0,
    startX: 65,
    startY: 8,
  });

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  // Inicializa o canvas de desenho
  useEffect(() => {
    if (activeTab !== "draw") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = penColor;
    ctx.lineWidth = penWidth;
  }, [penColor, penWidth, activeTab]);

  function startDrawing(e: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    ctx.moveTo(x, y);
  }

  function draw(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing(e: ReactPointerEvent<HTMLCanvasElement>) {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {}

    // Exporta imagem em PNG e atualiza bytes
    canvas.toBlob((blob) => {
      if (!blob) return;
      blob.arrayBuffer().then((buf) => {
        const bytes = new Uint8Array(buf);
        const dataUrl = canvas.toDataURL("image/png");
        setSignaturePreviewUrl(dataUrl);
        onSignatureImageChange(bytes, dataUrl);
      });
    }, "image/png");
  }

  function clearDrawing() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setSignaturePreviewUrl("");
    onSignatureImageChange(undefined, undefined);
  }

  useEffect(
    () => () => {
      if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
    },
    [],
  );

  useEffect(() => {
    if (!signatureImageBytes?.length) return;
    const url = URL.createObjectURL(
      new Blob([new Uint8Array(signatureImageBytes)], {
        type: signatureImageBytes[0] === 0x89 ? "image/png" : "image/jpeg",
      }),
    );
    setSignaturePreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [signatureImageBytes]);

  // Gera imagem a partir da digitação
  useEffect(() => {
    if (activeTab !== "type") return;
    if (!typedText.trim()) {
      setSignaturePreviewUrl("");
      onSignatureImageChange(undefined, undefined);
      return;
    }
    let cancelled = false;

    const offscreen = document.createElement("canvas");
    offscreen.width = 400;
    offscreen.height = 140;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.fillStyle = penColor;
    ctx.font = "italic 44px 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(typedText.trim(), offscreen.width / 2, offscreen.height / 2, offscreen.width - 16);

    offscreen.toBlob((blob) => {
      if (!blob || cancelled) return;
      blob.arrayBuffer().then((buf) => {
        if (cancelled) return;
        const bytes = new Uint8Array(buf);
        const dataUrl = offscreen.toDataURL("image/png");
        setSignaturePreviewUrl(dataUrl);
        onSignatureImageChange(bytes, dataUrl);
      });
    }, "image/png");
    return () => {
      cancelled = true;
    };
  }, [activeTab, typedText, penColor, onSignatureImageChange]);

  // Upload de imagem de assinatura/carimbo
  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    file.arrayBuffer().then((buf) => {
      const bytes = new Uint8Array(buf);
      if (uploadUrlRef.current) URL.revokeObjectURL(uploadUrlRef.current);
      const url = URL.createObjectURL(file);
      uploadUrlRef.current = url;
      setSignaturePreviewUrl(url);
      onSignatureImageChange(bytes, url);
    });
  }

  // Dragging do selo de assinatura sobre a miniatura
  function handlePointerDownDrag(e: ReactPointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    isDraggingRef.current = true;
    dragStartPosRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startX: placement.xPercent,
      startY: placement.yPercent,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMoveDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    const container = previewContainerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const deltaX = ((e.clientX - dragStartPosRef.current.clientX) / rect.width) * 100;
    // Y no PDF é medido de baixo para cima
    const deltaY = -(((e.clientY - dragStartPosRef.current.clientY) / rect.height) * 100);

    const newX = Math.max(
      0,
      Math.min(100 - placement.widthPercent, dragStartPosRef.current.startX + deltaX),
    );
    const newY = Math.max(
      0,
      Math.min(100 - placement.heightPercent, dragStartPosRef.current.startY + deltaY),
    );

    onPlacementChange({
      ...placement,
      xPercent: Math.round(newX),
      yPercent: Math.round(newY),
    });
  }

  function handlePointerUpDrag(e: ReactPointerEvent<HTMLDivElement>) {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {}
  }

  useEffect(() => {
    onPreviewPageChange?.(currentPage);
  }, [onPreviewPageChange, currentPage]);

  const currentThumb =
    pageThumbnails?.[currentPage - 1] || (currentPage === 1 ? thumbnailUrl : undefined);

  const showStamp =
    placement.page === "all" ||
    (placement.page === "first"
      ? currentPage === 1
      : placement.page === "last" || placement.page === undefined
        ? currentPage === totalPages
        : placement.page === currentPage);

  const todayFormatted = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  return (
    <div className="ilovepdf-compress-container">
      {/* Área Central: Pré-visualização com Selo Arrastável */}
      <div className="ilovepdf-compress-preview-area">
        <div className="ilovepdf-file-card-center" style={{ maxWidth: "460px" }}>
          {/* Navegação entre páginas */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label={translate("crop.previousPage")}
                style={{
                  padding: "0.3rem 0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                Página {currentPage} de {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label={translate("crop.nextPage")}
                style={{
                  padding: "0.3rem 0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Folha do Documento com o Selo de Assinatura */}
          <div
            ref={previewContainerRef}
            className="ilovepdf-file-thumb-wrapper"
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "8px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              width: "fit-content",
              maxWidth: "100%",
              marginInline: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              userSelect: "none",
            }}
          >
            {currentThumb ? (
              <img
                src={currentThumb}
                alt={translate("crop.pageAlt")
                  .replace("{page}", String(currentPage))
                  .replace("{name}", fileName)}
                className="ilovepdf-file-thumb-img"
                style={{
                  maxHeight: "380px",
                  maxWidth: "100%",
                  height: "auto",
                  width: "auto",
                  objectFit: "contain",
                  display: "block",
                  pointerEvents: "none",
                }}
              />
            ) : (
              <div className="ilovepdf-file-thumb-placeholder" style={{ minHeight: "380px" }}>
                <PenTool size={42} style={{ color: "#059669", opacity: 0.6 }} />
                <span style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#64748b" }}>
                  Página {currentPage}
                </span>
              </div>
            )}

            {/* Selo Arrastável de Assinatura */}
            {showStamp && (
              <div
                onPointerDown={handlePointerDownDrag}
                onPointerMove={handlePointerMoveDrag}
                onPointerUp={handlePointerUpDrag}
                onPointerCancel={handlePointerUpDrag}
                style={{
                  position: "absolute",
                  left: `${placement.xPercent}%`,
                  bottom: `${placement.yPercent}%`,
                  width: `${placement.widthPercent}%`,
                  height: `${placement.heightPercent}%`,
                  boxSizing: "border-box",
                  padding: "2px",
                  borderRadius: "6px",
                  border: "2px dashed #059669",
                  backgroundColor: "rgba(255, 255, 255, 0.92)",
                  boxShadow: "0 4px 12px rgba(5, 150, 105, 0.25)",
                  cursor: "move",
                  touchAction: "none",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: isDraggingRef.current ? "none" : "box-shadow 0.15s ease",
                  zIndex: 10,
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    bottom: "100%",
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.65rem",
                    color: "#059669",
                    fontWeight: 700,
                    marginBottom: "2px",
                  }}
                >
                  <span>{translate("sign.previewBadge")}</span>
                  <GripHorizontal size={12} />
                </div>

                {signaturePreviewUrl ? (
                  <img
                    src={signaturePreviewUrl}
                    alt={translate("sign.signatureImageAlt")}
                    style={{
                      minHeight: 0,
                      flex: 1,
                      height: "100%",
                      width: "100%",
                      maxWidth: "100%",
                      objectFit: "contain",
                      display: "block",
                      pointerEvents: "none",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: "36px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#94a3b8",
                      fontSize: "0.75rem",
                      fontStyle: "italic",
                    }}
                  >
                    {translate("sign.tabDraw")}...
                  </div>
                )}

                {signerName.trim() && (
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      color: "#1e293b",
                      marginTop: "2px",
                      textAlign: "center",
                      width: "100%",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {signerName}
                  </div>
                )}

                {includeDate && (
                  <div
                    style={{
                      fontSize: "0.62rem",
                      color: "#64748b",
                      textAlign: "center",
                      display: "flex",
                      alignItems: "center",
                      gap: "2px",
                    }}
                  >
                    <Calendar size={10} />
                    <span>{todayFormatted}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ marginTop: "0.6rem", textAlign: "center" }}>
            <span className="ilovepdf-file-card-name" title={fileName}>
              {fileName}
            </span>
            <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
          </div>

          <p
            style={{
              fontSize: "0.75rem",
              color: "#64748b",
              marginTop: "0.35rem",
              textAlign: "center",
            }}
          >
            {translate("sign.dragHint")}
          </p>
        </div>
      </div>

      {/* Barra Lateral: Configurações de Assinatura */}
      <aside className="ilovepdf-compress-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">{translate("sign.optionsTitle")}</h3>

        {/* Abas de Modo de Assinatura */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.35rem",
            marginBottom: "1rem",
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab("draw")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "6px",
              border: `2px solid ${activeTab === "draw" ? "#059669" : "#cbd5e1"}`,
              backgroundColor: activeTab === "draw" ? "#ecfdf5" : "#ffffff",
              color: activeTab === "draw" ? "#065f46" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            <PenTool size={15} />
            <span>{translate("sign.tabDraw")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("type")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "6px",
              border: `2px solid ${activeTab === "type" ? "#059669" : "#cbd5e1"}`,
              backgroundColor: activeTab === "type" ? "#ecfdf5" : "#ffffff",
              color: activeTab === "type" ? "#065f46" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            <Type size={15} />
            <span>{translate("sign.tabType")}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("upload")}
            style={{
              padding: "0.5rem 0.25rem",
              borderRadius: "6px",
              border: `2px solid ${activeTab === "upload" ? "#059669" : "#cbd5e1"}`,
              backgroundColor: activeTab === "upload" ? "#ecfdf5" : "#ffffff",
              color: activeTab === "upload" ? "#065f46" : "#475569",
              fontSize: "0.78rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.2rem",
            }}
          >
            <ImageIcon size={15} />
            <span>{translate("sign.tabUpload")}</span>
          </button>
        </div>

        {/* Painel do Modo Desenho */}
        {activeTab === "draw" && (
          <div style={{ marginBottom: "1rem" }}>
            <div
              style={{
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                backgroundColor: "#ffffff",
                overflow: "hidden",
                touchAction: "none",
              }}
            >
              <canvas
                ref={canvasRef}
                width={320}
                height={120}
                onPointerDown={startDrawing}
                onPointerMove={draw}
                onPointerUp={stopDrawing}
                onPointerCancel={stopDrawing}
                style={{
                  width: "100%",
                  height: "120px",
                  display: "block",
                  cursor: "crosshair",
                  backgroundColor: "#fafafa",
                }}
              />
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "0.4rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setPenColor("#0f172a")}
                  title={translate("sign.colorBlack")}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#0f172a",
                    border: penColor === "#0f172a" ? "2px solid #059669" : "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setPenColor("#1d4ed8")}
                  title={translate("sign.colorBlue")}
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#1d4ed8",
                    border: penColor === "#1d4ed8" ? "2px solid #059669" : "1px solid #cbd5e1",
                    cursor: "pointer",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "0.25rem", alignItems: "center" }}>
                {[1.5, 2.5, 4].map((width) => (
                  <button
                    key={width}
                    type="button"
                    onClick={() => setPenWidth(width)}
                    style={{
                      padding: "2px 6px",
                      borderRadius: "4px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: penWidth === width ? "#ecfdf5" : "#ffffff",
                      color: penWidth === width ? "#065f46" : "#64748b",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    {width}px
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={clearDrawing}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ef4444",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "3px",
                }}
              >
                <RotateCcw size={12} />
                <span>{translate("sign.clearSignature")}</span>
              </button>
            </div>
          </div>
        )}

        {/* Painel do Modo Digitação */}
        {activeTab === "type" && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="sign-typed-input"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              {translate("sign.typePlaceholder")}
            </label>
            <input
              id="sign-typed-input"
              type="text"
              value={typedText}
              onChange={(e) => setTypedText(e.target.value)}
              placeholder={translate("sign.typePlaceholder")}
              style={{
                width: "100%",
                padding: "0.55rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.9rem",
                boxSizing: "border-box",
                outline: "none",
              }}
            />

            <div
              style={{
                marginTop: "0.5rem",
                padding: "0.75rem",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                border: "1px dashed #cbd5e1",
                textAlign: "center",
                fontFamily: "italic 'Dancing Script', 'Brush Script MT', 'Segoe Script', cursive",
                fontSize: "1.5rem",
                color: penColor,
                minHeight: "45px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {typedText || translate("sign.previewPlaceholder")}
            </div>
          </div>
        )}

        {/* Painel do Modo Upload */}
        {activeTab === "upload" && (
          <div style={{ marginBottom: "1rem" }}>
            <label
              htmlFor="sign-upload-file"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.5rem",
                padding: "1.2rem",
                borderRadius: "8px",
                border: "2px dashed #059669",
                backgroundColor: "#ecfdf5",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <Upload size={24} style={{ color: "#059669" }} />
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#065f46" }}>
                {translate("sign.uploadLabel")}
              </span>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>
                {translate("sign.uploadHint")}
              </span>
              <input
                id="sign-upload-file"
                type="file"
                accept="image/png, image/jpeg"
                onChange={handleFileUpload}
                style={{ display: "none" }}
              />
            </label>
          </div>
        )}

        {/* Informações Complementares */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div>
            <label
              htmlFor="sign-signer-name"
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.3rem",
              }}
            >
              {translate("sign.signerName")}
            </label>
            <input
              id="sign-signer-name"
              type="text"
              value={signerName}
              onChange={(e) => onSignerNameChange(e.target.value)}
              placeholder={translate("sign.signerNamePlaceholder")}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              fontSize: "0.8rem",
              color: "#334155",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={includeDate}
              onChange={(e) => onIncludeDateChange(e.target.checked)}
              style={{ accentColor: "#059669" }}
            />
            <span>{translate("sign.includeDate")}</span>
          </label>

          {/* Onde posicionar a assinatura */}
          <div>
            <span
              style={{
                display: "block",
                fontSize: "0.82rem",
                fontWeight: 600,
                color: "#334155",
                marginBottom: "0.35rem",
              }}
            >
              {translate("sign.placement")}
            </span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
              <button
                type="button"
                onClick={() => onPlacementChange({ ...placement, page: currentPage })}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${placement.page === currentPage ? "#059669" : "#cbd5e1"}`,
                  backgroundColor: placement.page === currentPage ? "#ecfdf5" : "#ffffff",
                  color: placement.page === currentPage ? "#065f46" : "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {translate("sign.placementCurrent")} ({currentPage})
              </button>

              <button
                type="button"
                onClick={() => onPlacementChange({ ...placement, page: "last" })}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${placement.page === "last" ? "#059669" : "#cbd5e1"}`,
                  backgroundColor: placement.page === "last" ? "#ecfdf5" : "#ffffff",
                  color: placement.page === "last" ? "#065f46" : "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {translate("sign.placementLast")}
              </button>

              <button
                type="button"
                onClick={() => onPlacementChange({ ...placement, page: "first" })}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${placement.page === "first" ? "#059669" : "#cbd5e1"}`,
                  backgroundColor: placement.page === "first" ? "#ecfdf5" : "#ffffff",
                  color: placement.page === "first" ? "#065f46" : "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {translate("sign.placementFirst")}
              </button>

              <button
                type="button"
                onClick={() => onPlacementChange({ ...placement, page: "all" })}
                style={{
                  padding: "0.45rem",
                  borderRadius: "6px",
                  border: `1px solid ${placement.page === "all" ? "#059669" : "#cbd5e1"}`,
                  backgroundColor: placement.page === "all" ? "#ecfdf5" : "#ffffff",
                  color: placement.page === "all" ? "#065f46" : "#475569",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {translate("sign.placementAll")}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
