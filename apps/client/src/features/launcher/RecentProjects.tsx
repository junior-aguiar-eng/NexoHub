import { ArrowRight, FileText, Lock, MoreHorizontal, ShieldCheck } from "lucide-react";
import { translate } from "@/i18n";

type RecentDossier = {
  id: string;
  name: string;
  subline: string;
  categoryKey: "recent.type.procedural" | "recent.type.contracts" | "recent.type.opinion";
  verified: boolean;
};

const RECENT_DOSSIERS: RecentDossier[] = [
  {
    id: "d-1",
    name: "Apelação Cível – 0019284-82.2025.8.19.0001",
    subline: "Última edição hoje, 14:12 • 42 páginas",
    categoryKey: "recent.type.procedural",
    verified: true,
  },
  {
    id: "d-2",
    name: "Contrato de Prestação de Serviços – Minuta v3",
    subline: "Última edição hoje, 11:20 • 18 páginas",
    categoryKey: "recent.type.contracts",
    verified: true,
  },
  {
    id: "d-3",
    name: "Parecer Jurídico – Compliance Tributário",
    subline: "Última edição ontem, 09:47 • 9 páginas",
    categoryKey: "recent.type.opinion",
    verified: true,
  },
];

type RecentProjectsProps = {
  onOpenStudio?: () => void;
};

export function RecentProjects({ onOpenStudio }: RecentProjectsProps) {
  return (
    <section
      className="section-block recent-projects-section"
      aria-labelledby="recent-projects-title"
    >
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">{translate("recent.eyebrow")}</p>
          <h2 id="recent-projects-title">{translate("recent.title")}</h2>
        </div>
        <button
          type="button"
          className="recent-projects-view-all"
          onClick={onOpenStudio}
          aria-label={translate("recent.viewAll")}
        >
          <span>{translate("recent.viewAll")}</span>
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>

      <ul className="recent-dossiers-list">
        {RECENT_DOSSIERS.map((dossier) => (
          <li key={dossier.id} className="recent-dossier-item">
            <div className="recent-dossier-card">
              <button
                type="button"
                className="recent-dossier-card__main-btn"
                onClick={onOpenStudio}
                aria-label={`${dossier.name} - ${dossier.subline}`}
              >
                <div className="recent-dossier-card__icon-box" aria-hidden="true">
                  <FileText size={18} />
                </div>
                <div className="recent-dossier-card__meta">
                  <strong className="recent-dossier-card__title">{dossier.name}</strong>
                  <p className="recent-dossier-card__subline">{dossier.subline}</p>
                </div>
              </button>

              <div className="recent-dossier-card__right">
                <span
                  className="recent-badge-local"
                  title="Processado integralmente no ambiente local"
                >
                  <Lock size={12} aria-hidden="true" />
                  <span>{translate("recent.processedLocally")}</span>
                </span>

                <span className="recent-badge-category">{translate(dossier.categoryKey)}</span>

                {dossier.verified && (
                  <span
                    className="recent-badge-verified"
                    title="Integridade criptográfica BLAKE3 verificada"
                  >
                    <ShieldCheck size={13} aria-hidden="true" />
                    <span>{translate("recent.verifiedBlake3")}</span>
                  </span>
                )}

                <button
                  type="button"
                  className="recent-dossier-more-btn"
                  aria-label="Mais opções para este dossiê"
                  onClick={onOpenStudio}
                >
                  <MoreHorizontal size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
