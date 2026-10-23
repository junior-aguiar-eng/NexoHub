import { LockKeyhole, Search } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { translate } from "@/i18n";
import type { WorkZone } from "./SegmentedZoneToggle";

type HeroProps = {
  readonly searchQuery: string;
  readonly onSearchChange: (query: string) => void;
  readonly onOpenCommandPalette: () => void;
  readonly currentZone?: WorkZone;
};

export function Hero({
  searchQuery,
  onSearchChange,
  onOpenCommandPalette,
  currentZone = "pdf",
}: HeroProps) {
  const reduceMotion = useReducedMotion();
  const isImageZone = currentZone === "img";

  const title = isImageZone
    ? translate("hero.welcomeQuestionImage")
    : translate("hero.welcomeQuestionPdf");

  const subtitle = isImageZone
    ? translate("hero.descriptionImage")
    : translate("hero.descriptionPdf");

  const searchPlaceholder = isImageZone
    ? translate("hero.searchPlaceholderImage")
    : translate("hero.searchPlaceholderPdf");

  return (
    <motion.section
      className={`hero hero--clean ${isImageZone ? "hero--zone-img" : "hero--zone-pdf"}`}
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.3, ease: "easeOut" }}
      aria-labelledby="hero-title"
    >
      <h1 id="hero-title" className="hero__welcome-title">
        {title}
      </h1>
      <p className="hero__clean-subtitle">{subtitle}</p>
      <search className="hero__search" aria-label={translate("hero.searchLabel")}>
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label={translate("hero.searchLabel")}
          placeholder={searchPlaceholder}
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
