import type { Artifact, NexoFlowSnapshot } from "@nexohub/domain";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  FileCheck2,
  FileText,
  History,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LauncherTool } from "@/features/launcher/model";
import { translate } from "@/i18n";
import { type AnchorDraft, AnchorPanel } from "./AnchorPanel";

export type FactItem = {
  id: string;
  fact: string;
  proof: string;
  authority: string;
  order: string;
  page: number;
};

export type TimelineStep = {
  title: string;
  date: string;
  state: "done" | "active" | "pending";
};

type ContextInspectorPanelProps = {
  isOpen: boolean;
  onToggleOpen: () => void;
  activeEvidenceId?: string;
  onSelectEvidenceRow?: (evidenceId: string) => void;
  auditHealthy?: boolean;
  onAuditClick?: () => void;
  promotedFlow?: {
    tool: LauncherTool;
    flow: NexoFlowSnapshot;
  };
  artifacts?: readonly Artifact[];
  onCreateAnchor?: (draft: AnchorDraft) => Promise<void> | void;
  isFlowView?: boolean;
  onOpenHistory?: () => void;
  onSelectArtifact?: (artifact: Artifact) => void;
  selectedArtifactId?: string;
  facts?: readonly FactItem[];
  onAddFact?: (fact: FactItem) => void;
  onRemoveFact?: (factId: string) => void;
  timelineSteps?: readonly TimelineStep[];
  onAddTimelineStep?: (step: TimelineStep) => void;
};

export function ContextInspectorPanel({
  isOpen,
  onToggleOpen,
  activeEvidenceId,
  onSelectEvidenceRow,
  auditHealthy = true,
  onAuditClick,
  promotedFlow,
  artifacts = [],
  onCreateAnchor,
  isFlowView = false,
  onOpenHistory,
  onSelectArtifact,
  selectedArtifactId,
  facts = [],
  onAddFact,
  onRemoveFact,
  timelineSteps = [],
  onAddTimelineStep,
}: ContextInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"fact" | "order" | "all">("fact");
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(!isFlowView && artifacts.length > 0);
  const [flowOpen, setFlowOpen] = useState(true);
  const [anchorsOpen, setAnchorsOpen] = useState(!isFlowView);

  // Estado para adicionar fato
  const [isAddingFact, setIsAddingFact] = useState(false);
  const [newFact, setNewFact] = useState("");
  const [newProof, setNewProof] = useState("");
  const [newAuthority, setNewAuthority] = useState("");
  const [newOrder, setNewOrder] = useState("");
  const [newPage, setNewPage] = useState("1");

  // Estado para adicionar marco na timeline
  const [isAddingStep, setIsAddingStep] = useState(false);
  const [newStepTitle, setNewStepTitle] = useState("");
  const [newStepDate, setNewStepDate] = useState("");

  const handleCreateFact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFact.trim()) return;
    onAddFact?.({
      id: `fact-${Date.now()}`,
      fact: newFact.trim(),
      proof: newProof.trim() || "Documento anexado",
      authority: newAuthority.trim() || "Não informada",
      order: newOrder.trim() || "Procedência",
      page: parseInt(newPage, 10) || 1,
    });
    setNewFact("");
    setNewProof("");
    setNewAuthority("");
    setNewOrder("");
    setNewPage("1");
    setIsAddingFact(false);
  };

  const handleCreateStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStepTitle.trim()) return;
    onAddTimelineStep?.({
      title: newStepTitle.trim(),
      date: newStepDate.trim() || new Date().toLocaleDateString("pt-BR"),
      state: "active",
    });
    setNewStepTitle("");
    setNewStepDate("");
    setIsAddingStep(false);
  };

  return (
    <aside
      className={`context-inspector ${
        isOpen ? "context-inspector--open" : "context-inspector--collapsed"
      }`}
      aria-labelledby="studio-inspector-title"
    >
      {!isOpen ? (
        <button
          type="button"
          className="context-inspector__rail"
          onClick={onToggleOpen}
          title="Expandir painel do auditor"
          aria-label="Expandir painel do auditor"
        >
          <h2 className="visually-hidden" id="studio-inspector-title">
            {translate("studio.inspector.title")}
          </h2>
          <div className="context-inspector__rail-icon-box">
            <PanelRightOpen size={18} />
          </div>
          <span className="context-inspector__rail-label">
            {translate("studio.inspector.title")}
          </span>
        </button>
      ) : (
        <div className="context-inspector__header">
          <div className="context-inspector__title-block">
            <Scale size={16} className="context-inspector__title-icon" />
            <h2 className="context-inspector__title" id="studio-inspector-title">
              {translate("studio.inspector.title")}
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleOpen}
            className="context-inspector__toggle-btn"
            title="Recolher painel do auditor"
            aria-label="Recolher painel do auditor"
          >
            <PanelRightClose size={17} />
          </Button>
        </div>
      )}

      <div
        className={`context-inspector__content ${
          !isOpen ? "context-inspector__content--collapsed" : ""
        }`}
      >
        {/* Card 1: Matriz de Fatos e Provas Real */}
        <section className="inspector-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <div className="inspector-tab-row" style={{ margin: 0 }}>
              <button
                type="button"
                className={`inspector-tab ${activeTab === "fact" ? "inspector-tab--active" : ""}`}
                onClick={() => setActiveTab("fact")}
              >
                Por fato
              </button>
              <button
                type="button"
                className={`inspector-tab ${activeTab === "order" ? "inspector-tab--active" : ""}`}
                onClick={() => setActiveTab("order")}
              >
                Por pedido
              </button>
              <button
                type="button"
                className={`inspector-tab ${activeTab === "all" ? "inspector-tab--active" : ""}`}
                onClick={() => setActiveTab("all")}
              >
                Visão completa
              </button>
            </div>

            <Button
              variant="ghost"
              size="compact"
              onClick={() => setIsAddingFact((prev) => !prev)}
              title="Adicionar Fato ou Prova ao documento"
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
            >
              <Plus size={13} style={{ marginRight: "0.2rem" }} />
              Novo
            </Button>
          </div>

          {/* Formulário para adicionar fato real */}
          {isAddingFact && (
            <form
              onSubmit={handleCreateFact}
              style={{
                background: "var(--color-bg-secondary, #f8fafc)",
                border: "1px solid var(--color-border-subtle, #e2e8f0)",
                borderRadius: "6px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.4rem",
                fontSize: "0.8rem",
              }}
            >
              <strong style={{ fontSize: "0.8rem" }}>Vincular Nova Evidência</strong>
              <input
                type="text"
                placeholder="Fato alegado (ex: Falha no serviço)"
                value={newFact}
                onChange={(e) => setNewFact(e.target.value)}
                required
                style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
              />
              <input
                type="text"
                placeholder="Prova documental (ex: Cláusula 4ª, Laudo)"
                value={newProof}
                onChange={(e) => setNewProof(e.target.value)}
                style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
              />
              <div style={{ display: "flex", gap: "0.4rem" }}>
                <input
                  type="text"
                  placeholder="Jurisprudência / Lei"
                  value={newAuthority}
                  onChange={(e) => setNewAuthority(e.target.value)}
                  style={{
                    flex: 2,
                    padding: "0.3rem",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                  }}
                />
                <input
                  type="number"
                  placeholder="Pág"
                  min={1}
                  value={newPage}
                  onChange={(e) => setNewPage(e.target.value)}
                  style={{
                    width: "50px",
                    padding: "0.3rem",
                    borderRadius: "4px",
                    border: "1px solid #cbd5e1",
                  }}
                />
              </div>
              <input
                type="text"
                placeholder="Pedido decorrente (ex: Indenização)"
                value={newOrder}
                onChange={(e) => setNewOrder(e.target.value)}
                style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
              />
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.4rem",
                  marginTop: "0.2rem",
                }}
              >
                <Button
                  variant="ghost"
                  size="compact"
                  type="button"
                  onClick={() => setIsAddingFact(false)}
                >
                  Cancelar
                </Button>
                <Button variant="primary" size="compact" type="submit">
                  Salvar
                </Button>
              </div>
            </form>
          )}

          {facts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "1.5rem 0.5rem",
                color: "var(--color-text-secondary, #64748b)",
                fontSize: "0.8rem",
              }}
            >
              <FileCheck2 size={24} style={{ margin: "0 auto 0.4rem auto", opacity: 0.5 }} />
              <p style={{ margin: "0 0 0.5rem 0" }}>
                Nenhuma evidência vinculada a este documento.
              </p>
              <Button
                variant="secondary"
                size="compact"
                onClick={() => setIsAddingFact(true)}
                style={{ fontSize: "0.75rem" }}
              >
                + Adicionar Fato/Prova
              </Button>
            </div>
          ) : (
            <div className="inspector-table-container">
              <table className="inspector-table">
                <thead>
                  <tr>
                    <th>Fato</th>
                    <th>Prova</th>
                    <th>Autoridade</th>
                    <th>Pedido</th>
                    <th style={{ width: "24px" }} />
                  </tr>
                </thead>
                <tbody>
                  {facts.map((item) => {
                    const isSelected = item.id === activeEvidenceId;
                    return (
                      <tr
                        key={item.id}
                        className={`inspector-table__row ${
                          isSelected ? "inspector-table__row--selected" : ""
                        }`}
                        onClick={() => onSelectEvidenceRow?.(item.id)}
                      >
                        <td className="inspector-table__cell-fact">{item.fact}</td>
                        <td className="inspector-table__cell-proof">
                          <span>
                            {item.proof} {item.page ? `(p. ${item.page})` : ""}
                          </span>
                        </td>
                        <td className="inspector-table__cell-auth">{item.authority}</td>
                        <td className="inspector-table__cell-order">{item.order}</td>
                        <td>
                          {onRemoveFact && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveFact(item.id);
                              }}
                              title="Remover fato"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#94a3b8",
                                cursor: "pointer",
                                padding: "2px",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Card 2: Linha do Tempo Real do Processo */}
        <section className="inspector-card">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              width: "100%",
            }}
          >
            <button
              type="button"
              className="inspector-card__accordion-toggle"
              onClick={() => setTimelineOpen((prev) => !prev)}
              aria-expanded={timelineOpen}
              aria-controls="studio-timeline-panel"
              style={{ flex: 1 }}
            >
              <div className="inspector-card__header" style={{ margin: 0 }}>
                <Clock size={15} className="inspector-card__icon" />
                <h3 className="inspector-card__title">Linha do tempo do processo</h3>
                {timelineSteps.length > 0 && (
                  <span className="status-badge status-badge--compact">{timelineSteps.length}</span>
                )}
              </div>
              {timelineOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {timelineOpen && (
              <Button
                variant="ghost"
                size="compact"
                onClick={() => setIsAddingStep((prev) => !prev)}
                title="Adicionar marco temporal"
                style={{ fontSize: "0.75rem", padding: "0.2rem 0.4rem" }}
              >
                <Plus size={13} />
              </Button>
            )}
          </div>

          {timelineOpen && (
            <div id="studio-timeline-panel">
              {isAddingStep && (
                <form
                  onSubmit={handleCreateStep}
                  style={{
                    background: "var(--color-bg-secondary, #f8fafc)",
                    border: "1px solid var(--color-border-subtle, #e2e8f0)",
                    borderRadius: "6px",
                    padding: "0.6rem",
                    margin: "0.5rem 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    fontSize: "0.8rem",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Nome do ato (ex: Laudo Juntado)"
                    value={newStepTitle}
                    onChange={(e) => setNewStepTitle(e.target.value)}
                    required
                    style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                  />
                  <input
                    type="text"
                    placeholder="Data (ex: 15/06/2024)"
                    value={newStepDate}
                    onChange={(e) => setNewStepDate(e.target.value)}
                    style={{ padding: "0.3rem", borderRadius: "4px", border: "1px solid #cbd5e1" }}
                  />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.3rem" }}>
                    <Button
                      variant="ghost"
                      size="compact"
                      type="button"
                      onClick={() => setIsAddingStep(false)}
                    >
                      Cancelar
                    </Button>
                    <Button variant="primary" size="compact" type="submit">
                      Salvar
                    </Button>
                  </div>
                </form>
              )}

              {timelineSteps.length === 0 ? (
                <div
                  style={{
                    textAlign: "center",
                    padding: "1rem 0.5rem",
                    color: "var(--color-text-secondary, #64748b)",
                    fontSize: "0.8rem",
                  }}
                >
                  <p style={{ margin: "0 0 0.4rem 0" }}>Nenhum marco cadastrado.</p>
                  <Button
                    variant="ghost"
                    size="compact"
                    onClick={() => setIsAddingStep(true)}
                    style={{ fontSize: "0.75rem" }}
                  >
                    + Adicionar Marco
                  </Button>
                </div>
              ) : (
                <div className="inspector-timeline-v" style={{ marginTop: "0.5rem" }}>
                  {timelineSteps.map((step, idx) => (
                    <div
                      key={`${step.title}-${step.date}`}
                      className={`timeline-v-step timeline-v-step--${step.state}`}
                    >
                      <div className="timeline-v-track">
                        <div className="timeline-v-node" />
                        {idx < timelineSteps.length - 1 && <div className="timeline-v-line" />}
                      </div>
                      <div className="timeline-v-content">
                        <span className="timeline-v-title">{step.title}</span>
                        <span className="timeline-v-date">{step.date}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Card 3: Human Review & BLAKE3 Integrity */}
        <section className="inspector-card inspector-card--highlight">
          <div className="inspector-review-box">
            <div className="inspector-review-header">
              <div className="inspector-review-badges">
                <span className="human-review-badge">
                  <CheckCircle2 size={13} aria-hidden="true" />
                  <span>Revisão Humana</span>
                </span>
                <span className="compliance-badge">Supervisão Ética</span>
              </div>
              <Button
                variant="secondary"
                size="compact"
                className="inspector-review-box__history-btn"
                onClick={onOpenHistory}
              >
                <History size={13} style={{ marginRight: "0.25rem" }} />
                Ver histórico
              </Button>
            </div>
            <div className="inspector-review-box__text">
              <strong>Supervisão Técnica &amp; Compliance</strong>
              <p>Nenhuma decisão 100% automatizada. Validação conduzida sob controle humano.</p>
            </div>
          </div>

          <div className="inspector-integrity-footer">
            <div className="inspector-integrity-status">
              <ShieldCheck
                size={14}
                className={auditHealthy ? "text-emerald-600" : "text-amber-600"}
              />
              <span>Hash BLAKE3 Imutável</span>
            </div>
            {onAuditClick && (
              <button
                type="button"
                onClick={onAuditClick}
                className="inspector-integrity-audit-link"
              >
                Auditar
              </button>
            )}
          </div>
        </section>

        {/* Card 4: Nexo Layers */}
        <section
          className="studio-inspector__section inspector-card"
          aria-labelledby="studio-layers-title"
        >
          <button
            type="button"
            className="inspector-card__accordion-toggle"
            onClick={() => setLayersOpen((prev) => !prev)}
            aria-expanded={layersOpen}
            aria-controls="studio-layers-panel"
          >
            <div className="inspector-card__header" style={{ margin: 0 }}>
              <Layers size={15} className="inspector-card__icon" />
              <h3 id="studio-layers-title" className="inspector-card__title">
                {translate("studio.layers.title")}
              </h3>
              {artifacts && artifacts.length > 0 && (
                <span className="status-badge status-badge--compact">{artifacts.length}</span>
              )}
            </div>
            {layersOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {layersOpen && (
            <div id="studio-layers-panel" style={{ marginTop: "var(--space-2)" }}>
              {artifacts && artifacts.length > 0 ? (
                <ul className="studio-layers-list">
                  {artifacts.map((art) => {
                    const isSelected = selectedArtifactId === art.id;
                    return (
                      <li
                        key={art.id}
                        className="studio-layers-item-wrapper"
                        style={{ listStyle: "none" }}
                      >
                        <button
                          type="button"
                          className={`studio-layers-item ${isSelected ? "studio-layers-item--active" : ""}`}
                          style={{
                            width: "100%",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "4px",
                            border: "none",
                            background: isSelected
                              ? "var(--color-brand-soft, rgba(13, 79, 63, 0.15))"
                              : "transparent",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                          onClick={() => onSelectArtifact?.(art)}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                            <FileText size={14} />
                            <div>
                              <strong style={{ fontSize: "0.8rem", display: "block" }}>
                                {art.kind === "ORIGINAL" ? "Original" : "Derivado"}
                              </strong>
                              <span
                                style={{
                                  fontSize: "0.75rem",
                                  color: "var(--color-ink-muted, #667771)",
                                }}
                              >
                                {art.mimeType} • {(art.size / 1024).toFixed(1)} KB
                              </span>
                            </div>
                          </div>
                          <span
                            style={{
                              fontSize: "0.75rem",
                              fontFamily: "monospace",
                              color: "var(--color-ink-muted, #667771)",
                              fontWeight: 500,
                            }}
                          >
                            {art.hash.substring(0, 8)}…
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="studio-layers-empty">Nenhum artifact derivado cadastrado ainda.</p>
              )}
            </div>
          )}
        </section>

        {/* Card: NexoFlow (Collapsible) */}
        {promotedFlow && (
          <section
            className="studio-inspector__section inspector-card"
            aria-labelledby="studio-flow-title"
          >
            <button
              type="button"
              className="inspector-card__accordion-toggle"
              onClick={() => setFlowOpen((prev) => !prev)}
              aria-expanded={flowOpen}
              aria-controls="studio-flow-panel"
            >
              <div className="inspector-card__header" style={{ margin: 0 }}>
                <Workflow size={15} className="inspector-card__icon" />
                <h3 id="studio-flow-title" className="inspector-card__title">
                  {translate("studio.flow.title")}
                </h3>
              </div>
              {flowOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {flowOpen && (
              <div
                id="studio-flow-panel"
                className="studio-flow-card"
                style={{ marginTop: "var(--space-2)" }}
              >
                <span className="status-badge">{translate("studio.flow.draft")}</span>
                <strong>{translate(promotedFlow.tool.titleKey)}</strong>
                <p>{translate("studio.flow.promoted")}</p>
                <ol>
                  {promotedFlow.flow.steps.map((step) => (
                    <li key={step.id}>{step.toolId}</li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Card 5: Âncoras */}
        <section
          className="studio-inspector__section inspector-card"
          aria-labelledby="studio-anchors-title"
        >
          <button
            type="button"
            className="inspector-card__accordion-toggle"
            onClick={() => setAnchorsOpen((prev) => !prev)}
            aria-expanded={anchorsOpen}
            aria-controls="studio-anchors-panel"
          >
            <div className="inspector-card__header" style={{ margin: 0 }}>
              <Scale size={15} className="inspector-card__icon" />
              <h3 id="studio-anchors-title" className="inspector-card__title">
                Anchors
              </h3>
            </div>
            {anchorsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {anchorsOpen && (
            <div id="studio-anchors-panel" style={{ marginTop: "var(--space-2)" }}>
              <AnchorPanel onCreate={onCreateAnchor} hideHeader />
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
