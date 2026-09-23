import { Database, FileCheck, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AuthProvider, useAuth } from "@/features/account/AuthContext";
import { AuthModal } from "@/features/account/AuthModal";
import { UserProfileModal } from "@/features/account/UserProfileModal";
import { CapabilitiesModal } from "@/features/capabilities/CapabilitiesModal";
import { CommandPalette } from "@/features/launcher/CommandPalette";
import { DedicatedToolView } from "@/features/launcher/DedicatedToolView";
import { resolveLauncherTools } from "@/features/launcher/data";
import { Header } from "@/features/launcher/Header";
import { Hero } from "@/features/launcher/Hero";
import type { LauncherTool, SuiteId } from "@/features/launcher/model";
import { QuickToolGrid } from "@/features/launcher/QuickToolGrid";
import { SuiteNavigation } from "@/features/launcher/SuiteNavigation";
import { useRecentOperations } from "@/features/launcher/useRecentOperations";
import { translate } from "@/i18n";
import { createDocumentCorePort } from "@/platform/document-core";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR");
}

const ROUTE_TOOL_MAP: Record<string, string> = {
  "/juntar-pdf": "pdf-merge",
  "/merge-pdf": "pdf-merge",
  "/dividir-pdf": "pdf-split",
  "/split-pdf": "pdf-split",
  "/rotacionar-pdf": "pdf-rotate",
  "/rotate-pdf": "pdf-rotate",
  "/comprimir-pdf": "pdf-compress",
  "/compress-pdf": "pdf-compress",
  "/organizar-pdf": "pdf-organize",
  "/pdf-para-word": "pdf-to-word",
  "/pdf-to-word": "pdf-to-word",
  "/word-para-pdf": "word-to-pdf",
  "/word-to-pdf": "word-to-pdf",
  "/imagem-para-pdf": "images-to-pdf",
  "/jpg-to-pdf": "images-to-pdf",
  "/ocr-pdf": "pdf-ocr",
  "/ocr": "pdf-ocr",
  "/proteger-pdf": "pdf-protect",
  "/protect-pdf": "pdf-protect",
  "/extrair-imagens": "pdf-extract-images",
  "/comparar-textos": "text-compare",
  "/revisar-texto": "text-review",
  "/traduzir-texto": "text-translate",
};

const TOOL_ROUTE_MAP: Record<string, string> = {
  "pdf-merge": "/juntar-pdf",
  "pdf-split": "/dividir-pdf",
  "pdf-rotate": "/rotacionar-pdf",
  "pdf-compress": "/comprimir-pdf",
  "pdf-organize": "/organizar-pdf",
  "pdf-to-word": "/pdf-para-word",
  "word-to-pdf": "/word-para-pdf",
  "images-to-pdf": "/imagem-para-pdf",
  "pdf-ocr": "/ocr-pdf",
  "pdf-protect": "/proteger-pdf",
  "pdf-extract-images": "/extrair-imagens",
  "text-compare": "/comparar-textos",
  "text-review": "/revisar-texto",
  "text-translate": "/traduzir-texto",
};

export function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

function AppContent() {
  const documentCore = useMemo(() => createDocumentCorePort(), []);
  const { addOperation } = useRecentOperations();
  const {
    authModalOpen,
    authModalTab,
    closeAuthModal,
    userProfileModalOpen,
    closeUserProfileModal,
  } = useAuth();

  const dynamicTools = useMemo(() => {
    return resolveLauncherTools([], documentCore);
  }, [documentCore]);

  const [activeDedicatedTool, setActiveDedicatedTool] = useState<LauncherTool | null>(() => {
    if (typeof window !== "undefined") {
      const pathname = window.location.pathname.replace(/\/$/, "");
      const matchedToolId = ROUTE_TOOL_MAP[pathname];
      if (matchedToolId) {
        return dynamicTools.find((t) => t.id === matchedToolId) || null;
      }
    }
    return null;
  });

  const [initialFilesForTool, setInitialFilesForTool] = useState<File[]>([]);
  const [activeSuite, setActiveSuite] = useState<SuiteId>("overview");
  const [searchQuery] = useState("");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isCapabilitiesOpen, setIsCapabilitiesOpen] = useState(false);

  // Sincroniza a URL do navegador com a ferramenta ativa
  useEffect(() => {
    function handlePopState() {
      const pathname = window.location.pathname.replace(/\/$/, "");
      const matchedToolId = ROUTE_TOOL_MAP[pathname];
      if (matchedToolId) {
        const found = dynamicTools.find((t) => t.id === matchedToolId);
        if (found) {
          setActiveDedicatedTool(found);
          return;
        }
      }
      setActiveDedicatedTool(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dynamicTools]);

  const selectToolWithUrl = (tool: LauncherTool | null, files?: File[]) => {
    setInitialFilesForTool(files || []);
    setActiveDedicatedTool(tool);
    if (tool) {
      const targetRoute = TOOL_ROUTE_MAP[tool.id] || `/${tool.id}`;
      if (window.location.pathname !== targetRoute) {
        window.history.pushState({ toolId: tool.id }, "", targetRoute);
      }
    } else {
      if (window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
      }
    }
  };

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
        (activeSuite === "organize" &&
          (tool.suite === "organize" || (tool.suite as string) === "pdf")) ||
        (activeSuite === "optimize" && (tool.suite === "optimize" || tool.id === "pdf-compress")) ||
        (activeSuite === "convert" && tool.suite === "convert") ||
        (activeSuite === "text" &&
          (tool.suite === "text" || (tool.suite as string) === "review")) ||
        (activeSuite === "security" && tool.suite === "security");
      const searchableText = `${translate(tool.titleKey)} ${translate(tool.descriptionKey)}`;
      return matchesSuite && normalize(searchableText).includes(normalizedQuery);
    });
  }, [dynamicTools, activeSuite, searchQuery]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {translate("app.skip")}
      </a>
      <Header
        activeSuite={activeSuite}
        onSelectSuite={(suite) => {
          setActiveSuite(suite);
          selectToolWithUrl(null);
        }}
        onSelectTool={(toolId) => {
          const found = dynamicTools.find((t) => t.id === toolId);
          if (found) selectToolWithUrl(found);
        }}
        activeToolId={activeDedicatedTool?.id}
        onLogoClick={() => {
          selectToolWithUrl(null);
          setActiveSuite("overview");
        }}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenCapabilities={() => setIsCapabilitiesOpen(true)}
        searchQuery={searchQuery}
      />
      <main id="main-content" className="launcher-content launcher-content--full">
        {activeDedicatedTool ? (
          <DedicatedToolView
            tool={activeDedicatedTool}
            documentCore={documentCore}
            initialFiles={initialFilesForTool}
            onBack={() => {
              selectToolWithUrl(null);
            }}
            onOperationComplete={(op) => {
              addOperation(op);
            }}
          />
        ) : (
          <>
            <div className="launcher-welcome-container">
              <Hero />
              <div className="launcher-suites-center">
                <SuiteNavigation activeSuite={activeSuite} onSelect={setActiveSuite} />
              </div>
            </div>

            <div className="launcher-grid-container">
              <QuickToolGrid
                tools={filteredTools}
                onRunTool={(tool, files) => {
                  selectToolWithUrl(tool, files);
                }}
              />
            </div>
          </>
        )}
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

      <CapabilitiesModal
        open={isCapabilitiesOpen}
        onClose={() => setIsCapabilitiesOpen(false)}
        documentCore={documentCore}
      />

      <AuthModal open={authModalOpen} onClose={closeAuthModal} initialTab={authModalTab} />

      <UserProfileModal open={userProfileModalOpen} onClose={closeUserProfileModal} />
    </div>
  );
}
