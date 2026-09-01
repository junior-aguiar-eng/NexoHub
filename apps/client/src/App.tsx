import { useEffect, useMemo, useState } from "react";
import { CommandPalette } from "@/features/launcher/CommandPalette";
import { launcherTools } from "@/features/launcher/data";
import { GlobalSearch } from "@/features/launcher/GlobalSearch";
import { Header } from "@/features/launcher/Header";
import { Hero } from "@/features/launcher/Hero";
import type { SuiteId } from "@/features/launcher/model";
import { OpenStudioCTA } from "@/features/launcher/OpenStudioCTA";
import { QuickToolGrid } from "@/features/launcher/QuickToolGrid";
import { RecentProjects } from "@/features/launcher/RecentProjects";
import { SuiteNavigation } from "@/features/launcher/SuiteNavigation";
import { StudioWorkspace } from "@/features/studio/StudioWorkspace";
import { translate } from "@/i18n";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function App() {
  const [surface, setSurface] = useState<"launcher" | "studio">("launcher");
  const [activeSuite, setActiveSuite] = useState<SuiteId>("overview");
  const [searchQuery, setSearchQuery] = useState("");
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
    return launcherTools.filter((tool) => {
      const matchesSuite = activeSuite === "overview" || tool.suite === activeSuite;
      const searchableText = `${translate(tool.titleKey)} ${translate(tool.descriptionKey)}`;
      return matchesSuite && normalize(searchableText).includes(normalizedQuery);
    });
  }, [activeSuite, searchQuery]);

  if (surface === "studio") {
    return <StudioWorkspace onClose={() => setSurface("launcher")} />;
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {translate("app.skip")}
      </a>
      <Header onOpenCommandPalette={() => setCommandPaletteOpen(true)} />
      <SuiteNavigation activeSuite={activeSuite} onSelect={setActiveSuite} />
      <main id="main-content" className="launcher-content">
        <Hero />
        <GlobalSearch value={searchQuery} onChange={setSearchQuery} />
        <QuickToolGrid tools={filteredTools} />
        <RecentProjects />
        <OpenStudioCTA onOpen={() => setSurface("studio")} />
      </main>
      <footer className="app-footer">
        <span>NexoHub</span>
        <span>{translate("brand.tagline")}</span>
      </footer>
      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectSuite={setActiveSuite}
      />
    </div>
  );
}
