import { PanelsTopLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type OpenStudioCTAProps = {
  onOpen: () => void;
};

export function OpenStudioCTA({ onOpen }: OpenStudioCTAProps) {
  return (
    <aside className="studio-cta" aria-labelledby="studio-title">
      <span className="studio-cta__icon" aria-hidden="true">
        <PanelsTopLeft size={28} />
      </span>
      <div className="studio-cta__copy">
        <p className="eyebrow">{translate("studio.eyebrow")}</p>
        <h2 id="studio-title">{translate("studio.title")}</h2>
        <p>{translate("studio.description")}</p>
      </div>
      <Button variant="secondary" onClick={onOpen}>
        {translate("studio.action")}
      </Button>
    </aside>
  );
}
