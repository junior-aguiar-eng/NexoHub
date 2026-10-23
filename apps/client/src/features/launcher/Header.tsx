import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { NexoHubLogoIcon } from "@/components/NexoHubLogoIcon";
import { translate } from "@/i18n";
import { imageSuites, pdfSuites } from "./data";
import type { LauncherTool, SuiteId } from "./model";
import { SegmentedZoneToggle, type WorkZone } from "./SegmentedZoneToggle";

type HeaderProps = {
  activeSuite: SuiteId;
  onSelectSuite: (suite: SuiteId) => void;
  tools: readonly LauncherTool[];
  onSelectTool?: (toolId: string) => void;
  activeToolId?: string | null;
  onLogoClick?: () => void;
  onOpenCommandPalette: () => void;
  currentZone?: WorkZone;
  onZoneChange?: (zone: WorkZone) => void;
};

export function Header({
  tools,
  onSelectTool,
  onLogoClick,
  onOpenCommandPalette,
  currentZone = "pdf",
  onZoneChange,
}: HeaderProps) {
  const [allToolsMenuOpen, setAllToolsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuId = useId();
  const availableTools = tools.filter(
    (tool) =>
      tool.availability.available &&
      (tool.manifest.category === "image") === (currentZone === "img"),
  );
  const groups = (currentZone === "img" ? imageSuites : pdfSuites).filter(
    (suite) => suite.id !== "overview",
  );
  const allToolsLabel = translate(
    currentZone === "img" ? "header.allImageTools" : "header.allTools",
  );
  const isImageZone = currentZone === "img";

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
    <header
      className={`app-header app-header--ilovepdf ${isImageZone ? "app-header--zone-img" : "app-header--zone-pdf"}`}
    >
      <div className="header-left flex items-center gap-3">
        <button
          type="button"
          className="brand brand-btn ilovepdf-brand flex items-center gap-2"
          onClick={onLogoClick}
          aria-label={translate("header.homeLabel")}
        >
          <NexoHubLogoIcon zone={currentZone} size={44} />
          <span className="brand-logo-text flex items-center">
            <strong>NEXO</strong>
            <span className="brand-logo-accent">HUB</span>
          </span>
        </button>

        {/* Global Segmented Control Toggle */}
        {onZoneChange && (
          <div className="header-zone-toggle">
            <SegmentedZoneToggle currentZone={currentZone} onZoneChange={onZoneChange} />
          </div>
        )}
      </div>

      <nav className="header-main-nav" aria-label={translate("header.primaryNavigation")}>
        {availableTools
          .filter((tool) =>
            (isImageZone
              ? ["image-compress", "image-resize", "image-crop"]
              : ["pdf-merge", "pdf-split", "pdf-compress"]
            ).includes(tool.id),
          )
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
            aria-label={allToolsLabel}
            aria-expanded={allToolsMenuOpen}
            aria-controls={allToolsMenuOpen ? menuId : undefined}
            onClick={() => setAllToolsMenuOpen(!allToolsMenuOpen)}
          >
            <span className="nav-link-label--full">{allToolsLabel}</span>
            <span className="nav-link-label--compact">{translate("header.toolsCompact")}</span>
            <ChevronDown
              size={14}
              className={`dropdown-chevron ${allToolsMenuOpen ? "dropdown-chevron--open" : ""}`}
            />
          </button>
          {allToolsMenuOpen && (
            <div id={menuId} className="megamenu-panel megamenu-panel--all">
              {groups.map((group) => {
                const groupTools = availableTools.filter((tool) => tool.suite === group.id);
                if (groupTools.length === 0) return null;
                return (
                  <div className="megamenu-column" key={group.id}>
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

      <div className="header-actions flex items-center gap-2">
        <button
          type="button"
          className="header-search-icon-btn"
          onClick={onOpenCommandPalette}
          aria-label={translate("header.searchLabel")}
          title={translate("header.searchTitle")}
        >
          <Search size={20} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
