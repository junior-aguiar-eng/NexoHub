import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import nexohubIcon from "@/assets/nexohub-icon.png";
import { translate } from "@/i18n";
import type { LauncherTool, SuiteId } from "./model";

type HeaderProps = {
  activeSuite: SuiteId;
  onSelectSuite: (suite: SuiteId) => void;
  tools: readonly LauncherTool[];
  onSelectTool?: (toolId: string) => void;
  activeToolId?: string | null;
  onLogoClick?: () => void;
  onOpenCommandPalette: () => void;
  searchQuery?: string;
};

const groups = [
  { suite: "organize", labelKey: "suite.organize" },
  { suite: "optimize", labelKey: "suite.optimize" },
  { suite: "convert", labelKey: "suite.convert" },
  { suite: "text", labelKey: "suite.text" },
  { suite: "security", labelKey: "suite.security" },
] as const;

export function Header({ tools, onSelectTool, onLogoClick, onOpenCommandPalette }: HeaderProps) {
  const [allToolsMenuOpen, setAllToolsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const availableTools = tools.filter((tool) => tool.availability.available);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAllToolsMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (
        event.key === "Escape" &&
        allToolsMenuOpen &&
        menuRef.current?.contains(event.target as Node)
      ) {
        event.preventDefault();
        setAllToolsMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    function handleFocusOutside(event: FocusEvent) {
      // Focar outro controle fecha; clicar em títulos internos não remove o catálogo.
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAllToolsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("focusin", handleFocusOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("focusin", handleFocusOutside);
    };
  }, [allToolsMenuOpen]);

  function openTool(toolId: string) {
    setAllToolsMenuOpen(false);
    onSelectTool?.(toolId);
  }

  return (
    <header className="app-header app-header--ilovepdf">
      <div className="header-left">
        <button
          type="button"
          className="brand brand-btn ilovepdf-brand"
          onClick={onLogoClick}
          aria-label={translate("header.homeLabel")}
        >
          <img className="brand-app-icon" src={nexohubIcon} alt="" aria-hidden="true" />
          <span className="brand-logo-text">
            <strong>NEXO</strong>
            <span className="brand-logo-accent">HUB</span>
          </span>
        </button>
      </div>
      <nav className="header-main-nav" aria-label={translate("header.primaryNavigation")}>
        {availableTools
          .filter((tool) => ["pdf-merge", "pdf-split", "pdf-compress"].includes(tool.id))
          .map((tool) => (
            <button
              key={tool.id}
              type="button"
              className="nav-link-btn"
              onClick={() => openTool(tool.id)}
            >
              {translate(tool.titleKey)}
            </button>
          ))}
        <div className="nav-dropdown-wrapper" ref={menuRef}>
          <button
            ref={triggerRef}
            type="button"
            className={`nav-link-btn nav-link-btn--dropdown ${allToolsMenuOpen ? "nav-link-btn--active" : ""}`}
            aria-label={translate("header.allTools")}
            aria-expanded={allToolsMenuOpen}
            aria-controls={allToolsMenuOpen ? menuId : undefined}
            onClick={() => setAllToolsMenuOpen(!allToolsMenuOpen)}
          >
            <span className="nav-link-label--full">{translate("header.allTools")}</span>
            <span className="nav-link-label--compact">{translate("header.toolsCompact")}</span>
            <ChevronDown
              size={14}
              className={`dropdown-chevron ${allToolsMenuOpen ? "dropdown-chevron--open" : ""}`}
            />
          </button>
          {allToolsMenuOpen && (
            <div id={menuId} className="megamenu-panel megamenu-panel--all">
              {groups.map((group) => {
                const groupTools = availableTools.filter((tool) => tool.suite === group.suite);
                if (groupTools.length === 0) return null;
                return (
                  <div className="megamenu-column" key={group.suite}>
                    <span className="megamenu-col-title">{translate(group.labelKey)}</span>
                    {groupTools.map((tool) => (
                      <button
                        key={tool.id}
                        type="button"
                        className="megamenu-item"
                        onClick={() => openTool(tool.id)}
                      >
                        <tool.icon size={15} style={{ color: tool.accentColor }} />
                        <span>{translate(tool.titleKey)}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className="header-search-icon-btn"
          onClick={onOpenCommandPalette}
          aria-label={translate("header.searchLabel")}
          title={translate("header.searchTitle")}
        >
          <Search size={18} />
        </button>
      </div>
    </header>
  );
}
