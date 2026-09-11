import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  Hash,
  Maximize2,
  Minimize2,
  Sparkles,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { type RefObject, useState } from "react";
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
  pageCount?: number;
  currentPage?: number;
  onPageChange?: (page: number) => void;
  evidences?: readonly DocumentEvidence[];
  activeEvidenceId?: string;
  onSelectEvidence?: (evidence: DocumentEvidence) => void;
  scrollTargetRef?: RefObject<HTMLDivElement | null>;
};

export function DocumentViewerCanvas({
  documentTitle = "Doc. 02 - Laudo pericial.pdf",
  pageCount = 42,
  currentPage: externalPage,
  onPageChange,
  evidences = [],
  activeEvidenceId,
  onSelectEvidence,
  scrollTargetRef,
}: DocumentViewerCanvasProps) {
  const [internalPage, setInternalPage] = useState(8);
  const [zoom, setZoom] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const currentPage = externalPage ?? internalPage;

  function handlePrevPage() {
    const next = Math.max(1, currentPage - 1);
    setInternalPage(next);
    onPageChange?.(next);
  }

  function handleNextPage() {
    const next = Math.min(pageCount, currentPage + 1);
    setInternalPage(next);
    onPageChange?.(next);
  }

  function handleZoomIn() {
    setZoom((prev) => Math.min(180, prev + 15));
  }

  function handleZoomOut() {
    setZoom((prev) => Math.max(60, prev - 15));
  }

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
          <span className="document-canvas__doc-title">{documentTitle}</span>
        </div>

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
          <span className="document-canvas__page-indicator">
            <strong>{currentPage}</strong> / {pageCount}
          </span>
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

      {/* Document Sheet Viewport */}
      <div className="document-canvas__viewport">
        <div
          className="document-sheet"
          style={{
            transform: `scale(${zoom / 100})`,
            transformOrigin: "top center",
          }}
        >
          {/* Page Tag Floating Corner */}
          <div className="document-sheet__page-tag">p. {currentPage}</div>

          {/* Document Content Header */}
          <div className="document-sheet__content">
            <h2 className="document-sheet__section-title">IV. CONCLUSÃO</h2>

            <p className="document-sheet__paragraph">
              Com base nas análises técnicas realizadas, nos documentos apresentados e nas
              diligências efetuadas, é possível afirmar que houve descumprimento das normas técnicas
              aplicáveis ao caso concreto.
            </p>

            {/* Highlighted Evidence Anchor Block */}
            <div
              ref={scrollTargetRef}
              className={`document-sheet__highlight-block ${
                activeEvidenceId ? "document-sheet__highlight-block--selected" : ""
              }`}
            >
              <mark className="document-sheet__mark">
                Diante do conjunto probatório analisado, conclui-se que os danos identificados
                decorrem diretamente da falha na prestação do serviço, havendo nexo causal
                inequívoco entre a conduta da requerida e os prejuízos experimentados pela parte
                autora.
              </mark>

              {/* Discrete Lateral Evidence Anchor Badge */}
              <button
                type="button"
                className="document-sheet__anchor-pill"
                title="Âncora de evidência: Hash 3e7f...a9c2 (BLAKE3)"
                onClick={() => {
                  if (evidences.length > 0) {
                    onSelectEvidence?.(evidences[0]);
                  }
                }}
              >
                <span className="document-sheet__anchor-icon">
                  <Hash size={12} />
                </span>
                <span className="document-sheet__anchor-label">Âncora #1</span>
                <span className="document-sheet__anchor-hash">3e7f…a9c2</span>
                <ExternalLink size={11} className="document-sheet__anchor-arrow" />
              </button>
            </div>

            <p className="document-sheet__paragraph">
              Esse entendimento está em consonância com a jurisprudência consolidada do Superior
              Tribunal de Justiça, conforme precedentes normativos e julgados análogos catalogados
              na sequência dos trabalhos periciais.
            </p>

            <h2 className="document-sheet__section-title" style={{ marginTop: "2.5rem" }}>
              V. ENCERRAMENTO
            </h2>

            <p className="document-sheet__paragraph">
              Nada mais havendo a consignar ou suscitar quanto aos quesitos formulados pelas partes,
              encerra-se o presente laudo técnico pericial de constatação documental e material.
            </p>

            <div className="document-sheet__watermark">
              <Sparkles size={13} style={{ marginRight: "0.4rem" }} />
              Integridade criptográfica auditada via BLAKE3 • Imutabilidade garantida
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
