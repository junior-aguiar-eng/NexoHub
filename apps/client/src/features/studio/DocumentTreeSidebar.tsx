import type { ArtifactId, Document, DocumentId, ProjectId } from "@nexohub/domain";
import {
  Briefcase,
  ChevronDown,
  ChevronRight,
  FileCheck2,
  FilePlus2,
  FileText,
  Folder,
  FolderOpen,
  History,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ShieldCheck,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

import { translate } from "@/i18n";

type DocumentTreeSidebarProps = {
  activeProject: { path: string; name: string } | null;
  documents: readonly Document[];
  selectedDocument: Document | null;
  onSelectDocument: (document: Document) => void;
  onOpenProject: () => void;
  onImportDocument: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
  isLoading?: boolean;
  onSearchClick?: () => void;
  onStrategyClick?: () => void;
  onMonitoringClick?: () => void;
  onProductionClick?: () => void;
  onReportsClick?: () => void;
};

// Exemplos de documentos representativos exibidos quando nenhum documento real foi importado ainda
const SAMPLE_DOCS: Array<{ id: string; title: string; mimeType: string }> = [
  { id: "sample-1", title: "Petição inicial.pdf", mimeType: "application/pdf" },
  { id: "sample-2", title: "Contestação.pdf", mimeType: "application/pdf" },
  { id: "sample-3", title: "Doc. 01 - Contrato.pdf", mimeType: "application/pdf" },
  { id: "sample-4", title: "Doc. 02 - Laudo pericial.pdf", mimeType: "application/pdf" },
  { id: "sample-5", title: "Doc. 03 - E-mails.pdf", mimeType: "application/pdf" },
  { id: "sample-6", title: "Doc. 04 - Fotos.pdf", mimeType: "application/pdf" },
];

export function DocumentTreeSidebar({
  activeProject,
  documents,
  selectedDocument,
  onSelectDocument,
  onOpenProject,
  onImportDocument,
  isOpen,
  onToggleOpen,
  isLoading = false,
  onSearchClick,
  onStrategyClick,
  onMonitoringClick,
  onProductionClick,
  onReportsClick,
}: DocumentTreeSidebarProps) {
  const [dossierExpanded, setDossierExpanded] = useState(true);
  const [selectedSampleId, setSelectedSampleId] = useState("sample-4");

  const effectiveDocs =
    documents.length > 0
      ? documents
      : SAMPLE_DOCS.map((s) => ({
          id: s.id as DocumentId,
          projectId: (activeProject?.path ?? "local") as ProjectId,
          title: s.title,
          originalMimeType: s.mimeType,
          originalArtifactId: "sample-art" as ArtifactId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }));

  return (
    <aside
      className={`studio-sidebar ${isOpen ? "studio-sidebar--open" : "studio-sidebar--collapsed"}`}
      aria-labelledby="studio-tree-title"
    >
      {!isOpen ? (
        <button
          type="button"
          className="studio-sidebar__rail"
          onClick={onToggleOpen}
          title="Expandir painel de documentos"
          aria-label="Expandir painel de documentos"
        >
          <h2 className="visually-hidden" id="studio-tree-title">
            {translate("studio.tree.title")}
          </h2>
          <div className="studio-sidebar__rail-icon-box">
            <PanelLeftOpen size={18} />
          </div>
          <span className="studio-sidebar__rail-label">Documentos</span>
        </button>
      ) : (
        <>
          {/* Top Brand / Section Header */}
          <div className="studio-sidebar__top">
            <div className="studio-sidebar__badge">
              <Briefcase size={16} className="studio-sidebar__badge-icon" />
              <h2 className="studio-sidebar__badge-title" id="studio-tree-title">
                {translate("studio.tree.title")}
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleOpen}
              className="studio-sidebar__toggle-btn"
              title="Recolher painel"
            >
              <PanelLeftClose size={17} />
            </Button>
          </div>

          <div className="studio-sidebar__body">
            {/* Dossier Group Node */}
            <div className="studio-tree-group">
              <button
                type="button"
                className="studio-tree-group__header"
                onClick={() => setDossierExpanded((prev) => !prev)}
              >
                {dossierExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <Folder size={15} className="studio-tree-group__icon" />
                <span className="studio-tree-group__title">
                  {activeProject ? activeProject.name : "Dossiê Processual"}
                </span>
              </button>

              {dossierExpanded && (
                <div className="studio-tree-group__children">
                  <div className="studio-tree-subgroup">
                    <div className="studio-tree-subgroup__header">
                      <span className="studio-tree-subgroup__label">
                        Documentos ({effectiveDocs.length})
                      </span>
                    </div>

                    <ul className="studio-tree-list">
                      {effectiveDocs.map((doc) => {
                        const isSelected = selectedDocument
                          ? selectedDocument.id === doc.id
                          : selectedSampleId === doc.id;

                        return (
                          <li key={doc.id}>
                            <button
                              type="button"
                              className={`studio-tree-item ${
                                isSelected ? "studio-tree-item--active" : ""
                              }`}
                              onClick={() => {
                                if (documents.length > 0) {
                                  onSelectDocument(doc);
                                } else {
                                  setSelectedSampleId(doc.id);
                                }
                              }}
                            >
                              <FileText size={14} className="studio-tree-item__icon" />
                              <span className="studio-tree-item__name">{doc.title}</span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>

                    {/* Add Document Action */}
                    <button
                      type="button"
                      className="studio-tree-add-btn"
                      onClick={onImportDocument}
                      disabled={isLoading}
                    >
                      <FilePlus2 size={14} />
                      <span>Adicionar documentos</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Quick Tools / Workspace Sections */}
            <div className="studio-sidebar__shortcuts">
              <button
                type="button"
                className="studio-sidebar__shortcut-item"
                onClick={onSearchClick}
                title="Focar na busca do acervo"
              >
                <Search size={14} />
                <span>Pesquisas</span>
              </button>
              <button
                type="button"
                className="studio-sidebar__shortcut-item"
                onClick={onStrategyClick}
                title="Abrir Matriz de Fatos e Estratégia"
              >
                <SlidersHorizontal size={14} />
                <span>Estratégia</span>
              </button>
              <button
                type="button"
                className="studio-sidebar__shortcut-item"
                onClick={onMonitoringClick}
                title="Abrir Histórico & Linhagem SQLite"
              >
                <History size={14} />
                <span>Monitoramento</span>
              </button>
              <button
                type="button"
                className="studio-sidebar__shortcut-item"
                onClick={onProductionClick}
                title="Abrir NexoFlow & Receitas"
              >
                <Layers size={14} />
                <span>Produção</span>
              </button>
              <button
                type="button"
                className="studio-sidebar__shortcut-item"
                onClick={onReportsClick}
                title="Emitir auditoria de integridade do dossiê"
              >
                <FileCheck2 size={14} />
                <span>Relatórios</span>
              </button>
            </div>

            {/* Open Local Project Folder Button */}
            {!activeProject && (
              <div className="studio-sidebar__footer">
                <Button
                  variant="secondary"
                  size="compact"
                  onClick={onOpenProject}
                  disabled={isLoading}
                  className="studio-sidebar__open-project-btn"
                >
                  <FolderOpen size={14} style={{ marginRight: "0.35rem" }} />
                  Abrir pasta de projeto
                </Button>
              </div>
            )}

            {/* Local Processing & Privacy Footer */}
            <div className="studio-sidebar__privacy-footer">
              <ShieldCheck size={16} className="studio-sidebar__privacy-icon" />
              <div className="studio-sidebar__privacy-text">
                <span className="studio-sidebar__privacy-title">Processamento 100% local</span>
                <span className="studio-sidebar__privacy-sub">Seus dados, sob seu controle.</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
