import { Search } from "lucide-react";
import { UserMenu } from "@/features/account/UserMenu";
import { translate } from "@/i18n";
import { isTauriEnvironment } from "@/platform/document-core";
import type { SuiteId } from "./model";
import { SuiteNavigation } from "./SuiteNavigation";

type HeaderProps = {
  activeSuite: SuiteId;
  onSelectSuite: (suite: SuiteId) => void;
  onOpenCommandPalette: () => void;
  onOpenCapabilities?: () => void;
  searchQuery?: string;
};

export function Header({
  activeSuite,
  onSelectSuite,
  onOpenCommandPalette,
  onOpenCapabilities,
  searchQuery,
}: HeaderProps) {
  const isDesktop = isTauriEnvironment();
  const stationLabel = isDesktop
    ? translate("brand.desktopStation")
    : translate("brand.webStation");

  return (
    <header className="app-header">
      <div className="header-left">
        <a className="brand" href="#main-content" aria-label="NexoHub">
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <span className="brand__copy">
            <strong>NexoHub</strong>
            <small>{stationLabel}</small>
          </span>
        </a>
      </div>

      <div className="header-nav-center">
        <SuiteNavigation activeSuite={activeSuite} onSelect={onSelectSuite} />
      </div>

      <div className="header-actions">
        <button
          type="button"
          className="header-command-input"
          onClick={onOpenCommandPalette}
          aria-label="Buscar no NexoHub"
        >
          <Search size={15} aria-hidden="true" className="header-command-input__icon" />
          <span className="header-command-input__placeholder">
            {searchQuery || translate("header.commandPlaceholder")}
          </span>
          <kbd className="header-command-input__kbd">{translate("header.searchShortcut")}</kbd>
        </button>

        {onOpenCapabilities && (
          <button
            type="button"
            className="btn btn--secondary header-superpowers-btn"
            onClick={onOpenCapabilities}
            style={{
              fontSize: "0.8125rem",
              padding: "6px 12px",
              borderRadius: "6px",
              border: "1px solid var(--color-border)",
              background: "var(--color-surface-hover)",
              cursor: "pointer",
            }}
          >
            Superpoderes
          </button>
        )}

        <UserMenu />
      </div>
    </header>
  );
}
