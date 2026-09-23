import { motion, useReducedMotion } from "motion/react";

export function Hero() {
  const reduceMotion = useReducedMotion();

  return (
    <motion.section
      className="hero hero--clean"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
      aria-labelledby="hero-title"
    >
      <h1 id="hero-title" className="hero__welcome-title">
        Olá, Boni, o que faremos hoje?
      </h1>
      <p className="hero__clean-subtitle">Use todas as ferramentas de forma gratuita e ilimitada</p>
    </motion.section>
  );
}
