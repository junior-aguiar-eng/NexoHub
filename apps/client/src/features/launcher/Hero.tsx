import { LockKeyhole, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";

type HeroProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenCommandPalette: () => void;
};

export function Hero({ searchQuery, onSearchChange, onOpenCommandPalette }: HeroProps) {
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
        {translate("hero.welcomeQuestion")}
      </h1>
      <p className="hero__clean-subtitle">{translate("hero.description")}</p>
      <search className="hero__search" aria-label={translate("hero.searchLabel")}>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label={translate("hero.searchLabel")}
          placeholder={translate("hero.searchPlaceholder")}
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") onSearchChange("");
          }}
        />
        <button
          type="button"
          className="hero__search-shortcut"
          onClick={onOpenCommandPalette}
          aria-label={translate("hero.commandShortcut")}
          aria-keyshortcuts="Control+k Meta+k"
        >
          <kbd>{/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl + K"}</kbd>
        </button>
      </search>
      <span className="hero__security-badge">
        <LockKeyhole size={14} aria-hidden="true" />
        {translate("hero.securityBadge")}
      </span>
    </motion.section>
  );
}
