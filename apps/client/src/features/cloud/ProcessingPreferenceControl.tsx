import clsx from "clsx";
import { ShieldCheck, Sparkles } from "lucide-react";
import { translate as t } from "@/i18n";
import { type ProcessingPreference, useProcessingPreference } from "./processing-preference";

export function ProcessingPreferenceControl() {
  const [preference, setPreference] = useProcessingPreference();

  const handleSelect = (mode: ProcessingPreference) => {
    setPreference(mode);
  };

  return (
    <section className="cloud-account-card cloud-pref-section" aria-labelledby="conta-preferencias">
      <div className="cloud-pref-section__header">
        <h2 id="conta-preferencias">{t("account.page.preferencesTitle")}</h2>
        <p>{t("account.page.preferencesSubtitle")}</p>
      </div>

      <div role="radiogroup" aria-labelledby="conta-preferencias" className="cloud-pref-options">
        <label
          className={clsx(
            "cloud-pref-card",
            preference === "local-first" && "cloud-pref-card--selected",
          )}
        >
          <input
            type="radio"
            name="processing-preference"
            value="local-first"
            checked={preference === "local-first"}
            onChange={() => handleSelect("local-first")}
            className="cloud-pref-card__radio"
            aria-label={t("account.page.prefLocal")}
          />
          <div className="cloud-pref-card__indicator" aria-hidden="true">
            <div className="cloud-pref-card__dot" />
          </div>
          <div className="cloud-pref-card__content">
            <div className="cloud-pref-card__title-row">
              <ShieldCheck size={18} className="cloud-pref-card__icon" aria-hidden="true" />
              <strong className="cloud-pref-card__title">{t("account.page.prefLocal")}</strong>
            </div>
            <p className="cloud-pref-card__desc">{t("account.page.prefLocalDesc")}</p>
          </div>
        </label>

        <label
          className={clsx(
            "cloud-pref-card",
            preference === "hybrid" && "cloud-pref-card--selected",
          )}
        >
          <input
            type="radio"
            name="processing-preference"
            value="hybrid"
            checked={preference === "hybrid"}
            onChange={() => handleSelect("hybrid")}
            className="cloud-pref-card__radio"
            aria-label={t("account.page.prefHybrid")}
          />
          <div className="cloud-pref-card__indicator" aria-hidden="true">
            <div className="cloud-pref-card__dot" />
          </div>
          <div className="cloud-pref-card__content">
            <div className="cloud-pref-card__title-row">
              <Sparkles size={18} className="cloud-pref-card__icon" aria-hidden="true" />
              <strong className="cloud-pref-card__title">{t("account.page.prefHybrid")}</strong>
            </div>
            <p className="cloud-pref-card__desc">{t("account.page.prefHybridDesc")}</p>
          </div>
        </label>
      </div>
    </section>
  );
}
