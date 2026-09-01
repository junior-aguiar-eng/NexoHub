import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="hero"
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
      aria-labelledby="hero-title"
    >
      <p className="eyebrow">{translate("hero.eyebrow")}</p>
      <h1 id="hero-title">
        {translate("hero.titlePrefix")} <em>{translate("hero.titleAccent")}</em>
      </h1>
      <p className="hero__description">{translate("hero.description")}</p>
    </motion.section>
  );
}
