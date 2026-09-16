import { Database, FileCheck, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "@/features/launcher/CommandPalette";
import { resolveLauncherTools } from "@/features/launcher/data";
import { DedicatedToolView } from "@/features/launcher/DedicatedToolView";
import { Header } from "@/features/launcher/Header";
import { Hero } from "@/features/launcher/Hero";
import type { LauncherTool, SuiteId } from "@/features/launcher/model";
import { QuickToolGrid } from "@/features/launcher/QuickToolGrid";
import { RecentProjects } from "@/features/launcher/RecentProjects";
import { useRecentOperations } from "@/features/launcher/useRecentOperations";
import { translate } from "@/i18n";
import { createDocumentCorePort } from "@/platform/document-core";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function App() {
  const documentCore = useMemo(() => createDocumentCorePort(), []);
  const { operations, addOperation, clearOperations } = useRecentOperations();

  const dynamicTools = useMemo(() => {
    return resolveLauncherTools([], documentCore);
  }, [documentCore]);

  const [activeDedicatedTool, setActiveDedicatedTool] = useState<LauncherTool | null>(null);
  const [activeSuite, setActiveSuite] = useState<SuiteId>("overview");
  const [searchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLocaleLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  const filteredTools = useMemo(() => {
    const normalizedQuery = normalize(searchQuery.trim());
    return dynamicTools.filter((tool) => {
      const matchesSuite =
        activeSuite === "overview" ||
        activeSuite === tool.suite ||
        (activeSuite === "organize" && (tool.suite === "organize" || (tool.suite as string) === "pdf")) ||
        (activeSuite === "optimize" && (tool.suite === "optimize" || tool.id === "pdf-compress")) ||
        (activeSuite === "text" && (tool.suite === "text" || (tool.suite as string) === "review"));
      const searchableText = `${translate(tool.titleKey)} ${translate(tool.descriptionKey)}`;
      return matchesSuite && normalize(searchableText).includes(normalizedQuery);
    });
  }, [dynamicTools, activeSuite, searchQuery]);

  // Se o usuário selecionou uma ferramenta, exibe a tela dedicada da ferramenta
  if (activeDedicatedTool) {
    return (
      <div className="app-shell">
        <DedicatedToolView
          tool={activeDedicatedTool}
          documentCore={documentCore}
          onBack={() => setActiveDedicatedTool(null)}
          onOperationComplete={(op) => {
            addOperation(op);
          }}
        />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {translate("app.skip")}
      </a>
      <Header
        activeSuite={activeSuite}
        onSelectSuite={(suite) => setActiveSuite(suite)}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        searchQuery={searchQuery}
      />
      <main id="main-content" className="launcher-content launcher-content--full">
        <div className="launcher-welcome-container">
          <Hero />
        </div>

        <div className="launcher-grid-container">
          <QuickToolGrid
            tools={filteredTools}
            onRunTool={(tool) => {
              setActiveDedicatedTool(tool);
            }}
          />
        </div>

        <div className="launcher-recent-container">
          <RecentProjects
            operations={operations}
            onClearOperations={clearOperations}
          />
        </div>
      </main>

      <footer className="app-footer">
        <div className="app-footer__brand">
          <span className="app-footer__logo-mark" aria-hidden="true">
            N
          </span>
          <div className="app-footer__brand-text">
            <strong>NexoHub</strong>
            <small>{translate("brand.footerTagline")}</small>
          </div>
        </div>

        <div className="app-footer__pillars">
          <div className="app-footer__pillar-item">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>{translate("footer.pillar.security")}</span>
          </div>
          <div className="app-footer__pillar-item">
            <Database size={16} aria-hidden="true" />
            <span>{translate("footer.pillar.integrity")}</span>
          </div>
          <div className="app-footer__pillar-item">
            <FileCheck size={16} aria-hidden="true" />
            <span>{translate("footer.pillar.auditable")}</span>
          </div>
          <div className="app-footer__pillar-item">
            <Zap size={16} aria-hidden="true" />
            <span>{translate("footer.pillar.professionals")}</span>
          </div>
        </div>

        <div className="app-footer__signature">
          <span>— {translate("footer.tagline")}</span>
        </div>
      </footer>

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectSuite={setActiveSuite}
      />
    </div>
  );
}
