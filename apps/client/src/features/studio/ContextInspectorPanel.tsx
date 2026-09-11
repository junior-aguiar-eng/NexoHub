import type { Artifact, NexoFlowSnapshot } from "@nexohub/domain";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Crosshair,
  History,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  Scale,
  ShieldCheck,
  Workflow,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { LauncherTool } from "@/features/launcher/model";
import { translate } from "@/i18n";
import { type AnchorDraft, AnchorPanel } from "./AnchorPanel";

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
};

type FactItem = {
  id: string;
  fact: string;
  proof: string;
  authority: string;
  order: string;
  page: number;
};

const SAMPLE_FACTS: FactItem[] = [
  {
    id: "f-1",
    fact: "Falha na prestação do serviço",
    proof: "Laudo pericial (p. 8) Docs. 03 e 04",
    authority: "STJ, AgInt no REsp 1.812.456",
    order: "Procedência",
    page: 8,
  },
  {
    id: "f-2",
    fact: "Danos materiais",
    proof: "Notas fiscais E-mails",
    authority: "Art. 186 e 927 do CC Súmula 479/STJ",
    order: "Indenização",
    page: 12,
  },
  {
    id: "f-3",
    fact: "Nexo causal",
    proof: "Laudo pericial Relatórios técnicos",
    authority: "STJ, REsp 1.245.678",
    order: "Reconhecimento",
    page: 8,
  },
];

const TIMELINE_STEPS = [
  { title: "Petição inicial", date: "10/01/2023", state: "done" },
  { title: "Contestação", date: "28/02/2023", state: "done" },
  { title: "Perícia", date: "15/06/2023", state: "active" },
  { title: "Alegações finais", date: "10/09/2023", state: "pending" },
  { title: "Sentença", date: "Em andamento", state: "pending" },
];

export function ContextInspectorPanel({
  isOpen,
  onToggleOpen,
  activeEvidenceId = "f-1",
  onSelectEvidenceRow,
  auditHealthy = true,
  onAuditClick,
  promotedFlow,
  artifacts = [],
  onCreateAnchor,
  isFlowView = false,
}: ContextInspectorPanelProps) {
  const [activeTab, setActiveTab] = useState<"fact" | "order" | "all">("fact");
  const [timelineOpen, setTimelineOpen] = useState(true);
  const [layersOpen, setLayersOpen] = useState(!isFlowView && artifacts.length > 0);
  const [flowOpen, setFlowOpen] = useState(Boolean(promotedFlow));
  const [anchorsOpen, setAnchorsOpen] = useState(!isFlowView);

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
        {/* Card 1: Matrix Table */}
        <section className="inspector-card">
          <div className="inspector-tab-row">
            <button
              type="button"
              className={`inspector-tab-pill ${
                activeTab === "fact" ? "inspector-tab-pill--active" : ""
              }`}
              onClick={() => setActiveTab("fact")}
            >
              Por fato
            </button>
            <button
              type="button"
              className={`inspector-tab-pill ${
                activeTab === "order" ? "inspector-tab-pill--active" : ""
              }`}
              onClick={() => setActiveTab("order")}
            >
              Por pedido
            </button>
            <button
              type="button"
              className={`inspector-tab-pill ${
                activeTab === "all" ? "inspector-tab-pill--active" : ""
              }`}
              onClick={() => setActiveTab("all")}
            >
              Visão completa
            </button>
          </div>

          <div className="inspector-table-wrapper">
            <table className="inspector-table">
              <thead>
                <tr>
                  <th>Fato</th>
                  <th>Prova</th>
                  <th>Autoridade</th>
                  <th>Pedido</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_FACTS.map((item) => {
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
                        <span>{item.proof}</span>
                      </td>
                      <td className="inspector-table__cell-auth">{item.authority}</td>
                      <td className="inspector-table__cell-order">{item.order}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Card 2: Vertical Timeline (Collapsible) */}
        <section className="inspector-card">
          <button
            type="button"
            className="inspector-card__accordion-toggle"
            onClick={() => setTimelineOpen((prev) => !prev)}
            aria-expanded={timelineOpen}
          >
            <div className="inspector-card__header" style={{ margin: 0 }}>
              <Clock size={15} className="inspector-card__icon" />
              <h3 className="inspector-card__title">Linha do tempo do processo</h3>
            </div>
            {timelineOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {timelineOpen && (
            <div className="inspector-timeline-v">
              {TIMELINE_STEPS.map((step, idx) => (
                <div key={step.title} className={`timeline-v-step timeline-v-step--${step.state}`}>
                  <div className="timeline-v-track">
                    <div className="timeline-v-node" />
                    {idx < TIMELINE_STEPS.length - 1 && <div className="timeline-v-line" />}
                  </div>
                  <div className="timeline-v-content">
                    <span className="timeline-v-title">{step.title}</span>
                    <span className="timeline-v-date">{step.date}</span>
                  </div>
                </div>
              ))}
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

        {/* Card 4: Nexo Layers (Collapsible) */}
        <section
          className="studio-inspector__section inspector-card"
          aria-labelledby="studio-layers-title"
        >
          <button
            type="button"
            className="inspector-card__accordion-toggle"
            onClick={() => setLayersOpen((prev) => !prev)}
            aria-expanded={layersOpen}
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
            <div style={{ marginTop: "var(--space-2)" }}>
              {artifacts && artifacts.length > 0 ? (
                <ul className="studio-layers-list">
                  {artifacts.map((art) => (
                    <li key={art.id} className="studio-layers-item">
                      <span>{art.storagePath.split("/").pop() || art.id}</span>
                      <span className="studio-layers-badge">{art.kind}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="studio-inspector__empty-text">{translate("studio.layers.empty")}</p>
              )}
            </div>
          )}
        </section>

        {/* Card 5: NexoFlow (Collapsible) */}
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
              <div className="studio-flow-card" style={{ marginTop: "var(--space-2)" }}>
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

        {/* Card 6: Anchors (Collapsible) */}
        <section className="inspector-card" aria-labelledby="anchors-accordion-title">
          <button
            type="button"
            className="inspector-card__accordion-toggle"
            onClick={() => setAnchorsOpen((prev) => !prev)}
            aria-expanded={anchorsOpen}
          >
            <div className="inspector-card__header" style={{ margin: 0 }}>
              <Crosshair size={15} className="inspector-card__icon" />
              <h3 id="anchors-accordion-title" className="inspector-card__title">
                {translate("anchors.title")}
              </h3>
            </div>
            {anchorsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>

          {anchorsOpen && (
            <div style={{ marginTop: "var(--space-2)" }}>
              <AnchorPanel onCreate={onCreateAnchor} hideHeader />
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}
