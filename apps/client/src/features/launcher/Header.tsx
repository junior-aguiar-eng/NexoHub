import { Plus, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { SuiteId } from "./model";
import { SuiteNavigation } from "./SuiteNavigation";

type HeaderProps = {
  activeSuite: SuiteId;
  onSelectSuite: (suite: SuiteId) => void;
  onOpenCommandPalette: () => void;
  onOpenStudio: () => void;
  onOpenCapabilities?: () => void;
  searchQuery?: string;
};

export function Header({
  activeSuite,
  onSelectSuite,
  onOpenCommandPalette,
  onOpenStudio,
  onOpenCapabilities,
  searchQuery,
}: HeaderProps) {
  return (
    <header className="app-header">
      <div className="header-left">
        <a className="brand" href="#main-content" aria-label="NexoHub">
          <span className="brand__mark" aria-hidden="true">
            N
          </span>
          <span className="brand__copy">
            <strong>NexoJuri</strong>
            <small>{translate("brand.localStation")}</small>
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
          aria-label={translate("header.search")}
        >
          <Search size={15} aria-hidden="true" className="header-command-input__icon" />
          <span className="header-command-input__placeholder">
            {searchQuery || translate("header.commandPlaceholder")}
          </span>
          <kbd className="header-command-input__kbd">{translate("header.searchShortcut")}</kbd>
        </button>

        {onOpenCapabilities && (
          <Button
            variant="secondary"
            className="header-capabilities-btn"
            onClick={onOpenCapabilities}
            title="Personalizar e gerenciar superpoderes documentais"
          >
            <Sparkles size={15} aria-hidden="true" style={{ color: "#d97706" }} />
            <span>{translate("capabilities.headerButton")}</span>
          </Button>
        )}

        <Button variant="primary" className="header-studio-primary-btn" onClick={onOpenStudio}>
          <Plus size={16} aria-hidden="true" />
          <span>{translate("studio.action")}</span>
        </Button>

        <div className="header-user-avatar" title="Perfil / Workspace Local">
          <span>AB</span>
        </div>
      </div>
    </header>
  );
}
