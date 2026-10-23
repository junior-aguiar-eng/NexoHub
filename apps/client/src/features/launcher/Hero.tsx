import { translate } from "@/i18n";
import type { WorkZone } from "./SegmentedZoneToggle";
export function Hero({ currentZone = "pdf" }: { readonly currentZone?: WorkZone }) {
  return (
    <section className="hero hero--clean" aria-labelledby="hero-title">
      <h1 id="hero-title" className="hero__welcome-title">
        {translate(currentZone === "pdf" ? "hero.welcomeQuestionPdf" : "hero.welcomeQuestionImage")}
      </h1>
      <p className="hero__clean-subtitle">
        {translate(currentZone === "pdf" ? "hero.descriptionPdf" : "hero.descriptionImage")}
      </p>
    </section>
  );
}
