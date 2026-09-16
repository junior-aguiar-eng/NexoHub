import { Lock, ShieldCheck, Zap } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="hero"
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.35, ease: "easeOut" }}
      aria-labelledby="hero-title"
    >
      <h1 id="hero-title" className="hero__welcome-title">
        {translate("hero.welcome")}
      </h1>
      <p className="hero__description">{translate("hero.description")}</p>

      <ul className="hero__trust-row" aria-label="Garantias de processamento local">
        <li className="hero__trust-item">
          <ShieldCheck size={15} aria-hidden="true" style={{ color: "var(--color-brand)" }} />
          <span className="hero__trust-label">{translate("hero.trust.local")}</span>
        </li>
        <li className="hero__trust-item">
          <Lock size={15} aria-hidden="true" style={{ color: "var(--color-brand)" }} />
          <span className="hero__trust-label">{translate("hero.trust.privacy")}</span>
        </li>
        <li className="hero__trust-item">
          <Zap size={15} aria-hidden="true" style={{ color: "var(--color-brand)" }} />
          <span className="hero__trust-label">{translate("hero.trust.traceability")}</span>
        </li>
      </ul>
    </motion.section>
  );
}
