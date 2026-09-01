import { FolderClock } from "lucide-react";
import { translate } from "@/i18n";

export function RecentProjects() {
  return (
    <section className="section-block" aria-labelledby="recent-projects-title">
      <div className="section-heading section-heading--compact">
        <div>
          <p className="eyebrow">{translate("recent.eyebrow")}</p>
          <h2 id="recent-projects-title">{translate("recent.title")}</h2>
        </div>
      </div>
      <div className="empty-projects">
        <span className="empty-projects__icon" aria-hidden="true">
          <FolderClock size={24} />
        </span>
        <div>
          <h3>{translate("recent.emptyTitle")}</h3>
          <p>{translate("recent.emptyDescription")}</p>
        </div>
      </div>
    </section>
  );
}
