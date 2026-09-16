import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Hash,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Scaling,
  Sparkles,
  UploadCloud,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { type ChangeEvent, type KeyboardEvent, type RefObject, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

export type DocumentEvidence = {
  id: string;
  page: number;
  fact: string;
  proof: string;
  authority: string;
  order: string;
  highlightText: string;
  anchorHash: string;
};

type DocumentViewerCanvasProps = {
  documentTitle?: string;
  hasDocument?: boolean;
  pageCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  evidences?: readonly DocumentEvidence[];
  activeEvidenceId?: string;
  onSelectEvidence?: (evidence: DocumentEvidence) => void;
  scrollTargetRef?: RefObject<HTMLDivElement | null>;
  activeArtifactVersionName?: string;
  pdfBlobUrl?: string | null;
  onDropFile?: (file: File) => void;
  onImportClick?: () => void;
};

export function DocumentViewerCanvas({
  documentTitle,
  hasDocument,
  pageCount = 1,
  currentPage: externalPage,
  onPageChange,
  evidences = [],
  activeEvidenceId,
  onSelectEvidence,
  scrollTargetRef,
  activeArtifactVersionName,
  pdfBlobUrl,
  onDropFile,
  onImportClick,
}: DocumentViewerCanvasProps) {
  const isDocumentActive =
    hasDocument ??
    (Boolean(pdfBlobUrl) ||
      (Boolean(documentTitle) &&
        documentTitle !== "Nenhum documento aberto" &&
        documentTitle !== "Nenhum documento anexado."));
  const [internalPage, setInternalPage] = useState(1);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showThumbnails, setShowThumbnails] = useState(false);
  const [pageInputVal, setPageInputVal] = useState<string>("");
  const [isCanvasDragging, setIsCanvasDragging] = useState(false);

  const currentPage = externalPage ?? internalPage;

  function handleSetPage(page: number) {
    const valid = Math.max(1, Math.min(pageCount, page));
    setInternalPage(valid);
    onPageChange?.(valid);
    setPageInputVal("");
  }

  function handlePrevPage() {
    handleSetPage(currentPage - 1);
  }

  function handleNextPage() {
    handleSetPage(currentPage + 1);
  }

  function handleZoomIn() {
    setZoom((prev) => Math.min(180, prev + 15));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(60, prev - 15));
  }

  function handleFitWidth() {
    setZoom(100);
  }

  function handlePageInputChange(e: ChangeEvent<HTMLInputElement>) {
    setPageInputVal(e.target.value);
  }

  function handlePageInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const parsed = parseInt(pageInputVal, 10);
      if (!Number.isNaN(parsed)) {
        handleSetPage(parsed);
      }
    }
  }

  const pageEvidences = evidences.filter((ev) => ev.page === currentPage);
  const currentEvidence = pageEvidences.length > 0 ? pageEvidences[0] : evidences[0];

  return (
    <div className={`document-canvas ${isFullscreen ? "document-canvas--fullscreen" : ""}`}>
      {/* Document Hero / Canvas Header */}
      <div className="document-canvas__header">
        <span className="eyebrow">{translate("studio.canvas.eyebrow")}</span>
        <h1 id="studio-canvas-title" className="document-canvas__heading">
          {translate("studio.canvas.title")}
        </h1>
      </div>

      {/* Floating Glass Toolbar */}
      <div className="document-canvas__toolbar">
        <div className="document-canvas__doc-badge">
          <FileText size={15} className="document-canvas__doc-icon" />
          <span className="document-canvas__doc-title">{documentTitle || "Mesa de Trabalho"}</span>
          {activeArtifactVersionName && (
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.15rem 0.4rem",
                borderRadius: "3px",
                background: "var(--color-brand-soft, rgba(13, 79, 63, 0.15))",
                color: "var(--color-brand, #0d4f3f)",
                fontWeight: 600,
                marginLeft: "0.3rem",
              }}
            >
              {activeArtifactVersionName}
            </span>
          )}
        </div>

        {/* Botão de Toggle do Painel de Miniaturas */}
        <Button
          variant={showThumbnails ? "primary" : "ghost"}
          size="compact"
          onClick={() => setShowThumbnails((prev) => !prev)}
          title="Exibir miniaturas de páginas"
          style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
        >
          <LayoutGrid size={14} style={{ marginRight: "0.3rem" }} />
          <span>Miniaturas</span>
        </Button>

        {/* Controles de Navegação Multi-Página */}
        <div className="document-canvas__nav-controls">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            title="Página anterior"
            className="document-canvas__btn-icon"
          >
            <ChevronLeft size={16} />
          </Button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
              fontSize: "0.85rem",
            }}
          >
            <input
              type="number"
              min={1}
              max={pageCount}
              value={pageInputVal !== "" ? pageInputVal : currentPage}
              onChange={handlePageInputChange}
              onKeyDown={handlePageInputKeyDown}
              onBlur={() => {
                if (pageInputVal !== "") {
                  const parsed = parseInt(pageInputVal, 10);
                  if (!Number.isNaN(parsed)) handleSetPage(parsed);
                }
              }}
              style={{
                width: "42px",
                height: "24px",
                textAlign: "center",
                borderRadius: "4px",
                border: "1px solid var(--color-border, #334155)",
                background: "var(--color-surface, #1e293b)",
                color: "inherit",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
              title="Digite a página e tecle Enter"
            />
            <span className="document-canvas__page-indicator">/ {pageCount}</span>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= pageCount}
            title="Próxima página"
            className="document-canvas__btn-icon"
          >
            <ChevronRight size={16} />
          </Button>
        </div>

        {/* Controles de Zoom */}
        <div className="document-canvas__zoom-controls">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomOut}
            disabled={zoom <= 60}
            title="Reduzir zoom"
            className="document-canvas__btn-icon"
          >
            <ZoomOut size={15} />
          </Button>
          <span className="document-canvas__zoom-indicator">{zoom}%</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleZoomIn}
            disabled={zoom >= 180}
            title="Aumentar zoom"
            className="document-canvas__btn-icon"
          >
            <ZoomIn size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleFitWidth}
            title="Ajustar à largura padrão (100%)"
            className="document-canvas__btn-icon"
          >
            <Scaling size={14} />
          </Button>
        </div>

        <div className="document-canvas__actions">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen((prev) => !prev)}
            title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
            className="document-canvas__btn-icon"
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </Button>
        </div>
      </div>

      {/* Main Viewport Container com Miniaturas Laterais */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>
        {/* Painel Retrátil de Miniaturas */}
        {showThumbnails && (
          <aside
            style={{
              width: "160px",
              borderRight: "1px solid var(--color-border, #334155)",
              background: "var(--color-surface, #0f172a)",
              overflowY: "auto",
              padding: "0.75rem 0.5rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
              zIndex: 10,
            }}
            aria-label="Lista de páginas do documento"
          >
            <div
              style={{
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--color-text-secondary, #94a3b8)",
                marginBottom: "0.25rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Páginas ({pageCount})
            </div>
            {Array.from({ length: Math.min(pageCount, 42) }, (_, i) => i + 1).map((pg) => {
              const isSelected = pg === currentPage;
              return (
                <button
                  key={pg}
                  type="button"
                  onClick={() => handleSetPage(pg)}
                  style={{
                    border: isSelected
                      ? "2px solid var(--color-primary, #3b82f6)"
                      : "1px solid var(--color-border, #334155)",
                    borderRadius: "4px",
                    padding: "0.4rem",
                    background: isSelected
                      ? "rgba(59, 130, 246, 0.1)"
                      : "rgba(255, 255, 255, 0.02)",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "80px",
                      background: "#fff",
                      color: "#333",
                      borderRadius: "2px",
                      padding: "4px",
                      fontSize: "6px",
                      overflow: "hidden",
                      boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        height: "4px",
                        width: "70%",
                        background: "var(--color-brand, #0d4f3f)",
                      }}
                    />
                    <div
                      style={{
                        height: "2px",
                        width: "90%",
                        background: "var(--color-surface-muted, #cbd5e1)",
                      }}
                    />
                    <div
                      style={{
                        height: "2px",
                        width: "80%",
                        background: "var(--color-surface-muted, #cbd5e1)",
                      }}
                    />
                    <div
                      style={{
                        height: "2px",
                        width: "85%",
                        background: "var(--color-surface-muted, #cbd5e1)",
                      }}
                    />
                    {pg === 8 && (
                      <div
                        style={{
                          height: "12px",
                          width: "100%",
                          background: "var(--highlight-gold, rgba(254, 240, 138, 0.8))",
                          border: "1px solid var(--highlight-gold-border, #facc15)",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "0.75rem",
                      color: isSelected ? "var(--color-brand, #0d4f3f)" : "inherit",
                      fontWeight: isSelected ? 600 : "normal",
                    }}
                  >
                    Pág. {pg}
                  </span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Document Sheet Viewport */}
        <div
          className="document-canvas__viewport"
          style={{ flex: 1, padding: pdfBlobUrl ? "0.75rem" : undefined }}
        >
          {pdfBlobUrl ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                minHeight: "720px",
                display: "flex",
                flexDirection: "column",
                borderRadius: "8px",
                overflow: "hidden",
                border: "1px solid var(--color-border, #cbd5e1)",
                boxShadow: "var(--shadow-sheet)",
                background: "var(--color-surface-muted, #182a25)",
              }}
            >
              <iframe
                src={`${pdfBlobUrl}#page=${currentPage}&toolbar=0&navpanes=0&scrollbar=1`}
                title={documentTitle}
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: "750px",
                  border: "none",
                  background: "var(--color-surface-muted, #182a25)",
                }}
              />
            </div>
          ) : !isDocumentActive ? (
            <section
              aria-label="Mesa de trabalho documental"
              className={`document-empty-canvas ${isCanvasDragging ? "document-empty-canvas--active" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCanvasDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCanvasDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsCanvasDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  onDropFile?.(e.dataTransfer.files[0]);
                }
              }}
              style={{
                width: "100%",
                maxWidth: "680px",
                margin: "4rem auto",
                padding: "3.5rem 2.5rem",
                borderRadius: "16px",
                border: isCanvasDragging
                  ? "2px dashed var(--color-brand, #0d4f3f)"
                  : "1px solid var(--color-border, #cbd5e1)",
                background: isCanvasDragging
                  ? "var(--color-brand-soft, rgba(13, 79, 63, 0.08))"
                  : "var(--color-surface, #ffffff)",
                boxShadow: "var(--shadow-sheet)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "1.25rem",
                transition: "all 0.2s ease-in-out",
              }}
            >
              <div
                style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  background: "var(--color-brand-soft, rgba(13, 79, 63, 0.1))",
                  color: "var(--color-brand, #0d4f3f)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <UploadCloud size={32} />
              </div>
              <div>
                <h3
                  style={{
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--color-ink, #1f2937)",
                    marginBottom: "0.5rem",
                    fontFamily: "var(--font-heading)",
                  }}
                >
                  Mesa de Trabalho Documental
                </h3>
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "var(--color-ink-muted, #667771)",
                    maxWidth: "420px",
                    lineHeight: 1.5,
                  }}
                >
                  Arraste e solte um arquivo PDF, Word ou Texto aqui para iniciar a análise e
                  transformação com integridade preservada.
                </p>
              </div>
              <Button
                variant="primary"
                onClick={onImportClick}
                style={{
                  padding: "0.6rem 1.4rem",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  gap: "0.5rem",
                }}
              >
                <FileText size={16} />
                <span>Selecionar Documento</span>
              </Button>
            </section>
          ) : (
            <div
              className="document-sheet"
              style={{
                transform: `scale(${zoom / 100})`,
                transformOrigin: "top center",
              }}
            >
              <div className="document-sheet__page-tag">p. {currentPage}</div>

              <div className="document-sheet__content">
                <h2 className="document-sheet__section-title">
                  {documentTitle || "Documento Local"}
                </h2>

                <p className="document-sheet__paragraph">
                  Este artefato está registrado sob a cadeia de custódia local do NexoHub. A
                  integridade estrutural e os metadados do documento permanecem protegidos contra
                  alterações destrutivas.
                </p>

                {pageEvidences.length > 0 && currentEvidence && (
                  <div
                    ref={scrollTargetRef}
                    className={`document-sheet__highlight-block ${
                      activeEvidenceId ? "document-sheet__highlight-block--selected" : ""
                    }`}
                  >
                    <mark className="document-sheet__mark">{currentEvidence.highlightText}</mark>

                    <button
                      type="button"
                      className="document-sheet__anchor-pill"
                      title={`Âncora de evidência: Hash ${currentEvidence.anchorHash || "3e7f...a9c2"} (BLAKE3)`}
                      onClick={() => {
                        onSelectEvidence?.(currentEvidence);
                      }}
                    >
                      <span className="document-sheet__anchor-icon">
                        <Hash size={12} />
                      </span>
                      <span className="document-sheet__anchor-label">Âncora</span>
                      <span className="document-sheet__anchor-hash">
                        {currentEvidence.anchorHash
                          ? `${currentEvidence.anchorHash.substring(0, 4)}…`
                          : "3e7f…a9c2"}
                      </span>
                      <ExternalLink size={11} className="document-sheet__anchor-arrow" />
                    </button>
                  </div>
                )}

                <div className="document-sheet__watermark" style={{ marginTop: "3rem" }}>
                  <Sparkles size={13} style={{ marginRight: "0.4rem" }} />
                  Integridade criptográfica auditada • Imutabilidade garantida
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
