import { FileImage, ScanText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type OcrPanelProps = {
  onRun?: () => Promise<void> | void;
};

export function OcrPanel({ onRun }: OcrPanelProps) {
  return (
    <section className="ocr-panel" aria-labelledby="ocr-title">
      <div className="ocr-panel__title">
        <span aria-hidden="true">
          <ScanText size={22} />
        </span>
        <div>
          <p className="eyebrow">{translate("ocr.eyebrow")}</p>
          <h2 id="ocr-title">{translate("ocr.title")}</h2>
        </div>
      </div>
      <ul>
        <li>
          <FileImage size={16} aria-hidden="true" />
          {translate("ocr.formats")}
        </li>
        <li>
          <ShieldCheck size={16} aria-hidden="true" />
          {translate("ocr.local")}
        </li>
      </ul>
      <Button variant="secondary" disabled={!onRun} onClick={onRun}>
        {translate("ocr.run")}
      </Button>
      {!onRun && <p>{translate("ocr.projectRequired")}</p>}
    </section>
  );
}
