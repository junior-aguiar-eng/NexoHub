import { type NexoFlowSnapshot, promoteQuickTool } from "@nexohub/domain";
import { Database, FileCheck, ShieldCheck, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { CapabilitiesModal } from "@/features/capabilities/CapabilitiesModal";
import { useCapabilities } from "@/features/capabilities/useCapabilities";
import { CommandPalette } from "@/features/launcher/CommandPalette";
import { resolveLauncherTools } from "@/features/launcher/data";
import { Header } from "@/features/launcher/Header";
import { Hero } from "@/features/launcher/Hero";
import type { LauncherTool, SuiteId } from "@/features/launcher/model";
import { OperationalDropzone } from "@/features/launcher/OperationalDropzone";
import { QuickToolGrid } from "@/features/launcher/QuickToolGrid";
import { RecentProjects } from "@/features/launcher/RecentProjects";
import { StudioWorkspace } from "@/features/studio/StudioWorkspace";
import { translate } from "@/i18n";
import { BrowserDocumentCorePort } from "@/platform/browser-document-core";
import { createDocumentCorePort } from "@/platform/document-core";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

export function App() {
  const [surface, setSurface] = useState<"launcher" | "studio">("launcher");
  const documentCore = useMemo(() => createDocumentCorePort(), []);
  const { capabilities, refresh: refreshCapabilities } = useCapabilities(documentCore);

  const dynamicTools = useMemo(() => {
    return resolveLauncherTools(capabilities, documentCore);
  }, [capabilities, documentCore]);

  const [promotedFlow, setPromotedFlow] = useState<{
    tool: LauncherTool;
    flow: NexoFlowSnapshot;
  }>();
  const [activeSuite, setActiveSuite] = useState<SuiteId>("overview");
  const [searchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [capabilitiesOpen, setCapabilitiesOpen] = useState(false);

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
        ((activeSuite === "processing" || activeSuite === "pdf") &&
          (tool.suite === "pdf" || (tool.suite as string) === "processing")) ||
        ((activeSuite === "review" || activeSuite === "text") &&
          (tool.suite === "text" || (tool.suite as string) === "review")) ||
        ((activeSuite === "compliance" || activeSuite === "security") &&
          (tool.suite === "security" || (tool.suite as string) === "compliance")) ||
        (activeSuite === "extraction" && tool.id === "intelligence-extract");
      const searchableText = `${translate(tool.titleKey)} ${translate(tool.descriptionKey)}`;
      return matchesSuite && normalize(searchableText).includes(normalizedQuery);
    });
  }, [dynamicTools, activeSuite, searchQuery]);

  if (surface === "studio") {
    return (
      <StudioWorkspace
        documentCore={documentCore}
        promotedFlow={promotedFlow}
        onClose={() => {
          setSurface("launcher");
          setPromotedFlow(undefined);
        }}
      />
    );
  }

  const handleFileImport = async (file: File) => {
    if (!documentCore) {
      setSurface("studio");
      return;
    }
    try {
      const project = await documentCore.invoke("pick_project_folder", {});
      if (!project) {
        setSurface("studio");
        return;
      }
      if (documentCore instanceof BrowserDocumentCorePort) {
        documentCore.registerUploadedFile(file);
      }
      await documentCore.invoke("import_document", {
        projectPath: project.path,
        sourcePath: file.name,
        mimeType: file.type || "application/octet-stream",
        title: file.name,
      });
      setSurface("studio");
    } catch (err) {
      console.error("Falha ao importar arquivo pelo dropzone:", err);
      setSurface("studio");
    }
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {translate("app.skip")}
      </a>
      <Header
        activeSuite={activeSuite}
        onSelectSuite={(suite) => {
          if (suite === "flow") {
            setSurface("studio");
          } else {
            setActiveSuite(suite);
          }
        }}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenStudio={() => setSurface("studio")}
        onOpenCapabilities={() => setCapabilitiesOpen(true)}
        searchQuery={searchQuery}
      />
      <main id="main-content" className="launcher-content">
        <div className="launcher-split">
          <div className="launcher-hero-column">
            <Hero />
            <OperationalDropzone
              onOpenStudio={() => setSurface("studio")}
              onFileImport={handleFileImport}
            />
          </div>
          <div className="launcher-tools-column">
            <QuickToolGrid
              tools={filteredTools}
              onPromote={(tool) => {
                setPromotedFlow({ tool, flow: promoteQuickTool(tool.id).snapshot });
                setSurface("studio");
              }}
              onOpenStudio={() => setSurface("studio")}
            />
          </div>
        </div>
        <RecentProjects onOpenStudio={() => setSurface("studio")} />
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
            <Users size={16} aria-hidden="true" />
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

      <CapabilitiesModal
        open={capabilitiesOpen}
        onClose={() => {
          setCapabilitiesOpen(false);
          refreshCapabilities();
        }}
        documentCore={documentCore}
      />
    </div>
  );
}
