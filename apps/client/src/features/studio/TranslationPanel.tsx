import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

export function TranslationPanel() {
  return (
    <section className="text-editor" aria-labelledby="translation-title">
      <div className="text-editor__header">
        <div>
          <p className="eyebrow">{translate("translation.eyebrow")}</p>
          <h2 id="translation-title">{translate("translation.title")}</h2>
        </div>
        <Languages size={20} aria-hidden="true" />
      </div>
      <div className="text-editor__meta">
        <span>{translate("translation.source")}: pt-BR</span>
        <span>{translate("translation.target")}: en</span>
      </div>
      <Button type="button" disabled>
        {translate("translation.run")}
      </Button>
      <p>{translate("translation.modelRequired")}</p>
    </section>
  );
}
