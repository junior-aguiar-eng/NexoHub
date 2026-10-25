import { Database, FileCheck, ShieldCheck, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { NexoHubLogoIcon } from "@/components/NexoHubLogoIcon";
import { CommandPalette } from "@/features/launcher/CommandPalette";
import { DedicatedToolView } from "@/features/launcher/DedicatedToolView";
import { imageSuites, pdfSuites, resolveLauncherTools } from "@/features/launcher/data";
import { Header } from "@/features/launcher/Header";
import { Hero } from "@/features/launcher/Hero";
import type { LauncherTool, SuiteId } from "@/features/launcher/model";
import { QuickToolGrid } from "@/features/launcher/QuickToolGrid";
import type { WorkZone } from "@/features/launcher/SegmentedZoneToggle";
import { SuiteNavigation } from "@/features/launcher/SuiteNavigation";
import { useRecentOperations } from "@/features/launcher/useRecentOperations";
import { translate } from "@/i18n";
import { withAppBase, withoutAppBase } from "@/platform/app-paths";
import { createDocumentCorePort } from "@/platform/document-core";
import { allowToolNavigation } from "@/platform/tool-navigation-guard";

const ROUTE_TOOL_MAP: Record<string, string> = {
  "/remover-paginas": "pdf-remove-pages",
  "/pdf-remove-pages": "pdf-remove-pages",
  "/extrair-paginas": "pdf-extract-pages",
  "/pdf-extract-pages": "pdf-extract-pages",
  "/html-para-pdf": "html-to-pdf",
  "/html-to-pdf": "html-to-pdf",
  "/digitalizar-pdf": "scan-to-pdf",
  "/scan-to-pdf": "scan-to-pdf",
  "/editar-pdf": "pdf-edit",
  "/edit-pdf": "pdf-edit",
  "/comparar-pdf": "pdf-compare",
  "/compare-pdf": "pdf-compare",
  "/pdf-compare": "pdf-compare",
  "/juntar-pdf": "pdf-merge",
  "/merge-pdf": "pdf-merge",
  "/dividir-pdf": "pdf-split",
  "/split-pdf": "pdf-split",
  "/rotacionar-pdf": "pdf-rotate",
  "/rotate-pdf": "pdf-rotate",
  "/recortar-pdf": "pdf-crop",
  "/pdf-crop": "pdf-crop",
  "/crop-pdf": "pdf-crop",
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
  "/reconhecer-texto": "pdf-ocr",
  "/pdf-ocr": "pdf-ocr",
  "/proteger-pdf": "pdf-protect",
  "/protect-pdf": "pdf-protect",
  "/ocultar-pdf": "pdf-redact",
  "/redact-pdf": "pdf-redact",
  "/pdf-redact": "pdf-redact",
  "/extrair-imagens": "pdf-extract-images",
  "/comparar-textos": "text-compare",
  "/revisar-texto": "text-review",
  "/traduzir-texto": "text-translate",
  "/pdf-para-jpg": "pdf-to-jpg",
  "/pdf-to-jpg": "pdf-to-jpg",
  "/marca-dagua": "pdf-watermark",
  "/marca-d-agua": "pdf-watermark",
  "/pdf-watermark": "pdf-watermark",
  "/watermark-pdf": "pdf-watermark",
  "/numeros-de-pagina": "pdf-page-numbers",
  "/pdf-page-numbers": "pdf-page-numbers",
  "/page-numbers": "pdf-page-numbers",
  "/pdf-para-markdown": "pdf-to-markdown",
  "/pdf-to-markdown": "pdf-to-markdown",
  "/assinar-pdf": "pdf-sign",
  "/pdf-sign": "pdf-sign",
  "/sign-pdf": "pdf-sign",
  "/preencher-formulario": "pdf-form-fill",
  "/pdf-form-fill": "pdf-form-fill",
  "/form-fill": "pdf-form-fill",
  "/desbloquear-pdf": "pdf-unlock",
  "/pdf-unlock": "pdf-unlock",
  "/unlock-pdf": "pdf-unlock",
  "/pdf-para-excel": "pdf-to-excel",
  "/pdf-to-excel": "pdf-to-excel",
  "/excel-pdf": "pdf-to-excel",
  "/remover-paginas-pdf": "pdf-remove-pages",
  "/extrair-paginas-pdf": "pdf-extract-pages",
  "/converter-html-pdf": "html-to-pdf",
  "/digitalizar-para-pdf": "scan-to-pdf",
  "/escanear-pdf": "scan-to-pdf",
  "/comprimir-imagem": "image-compress",
  "/compress-image": "image-compress",
  "/redimensionar-imagem": "image-resize",
  "/resize-image": "image-resize",
  "/recortar-imagem": "image-crop",
  "/crop-image": "image-crop",
  "/converter-imagem": "image-convert",
  "/convert-image": "image-convert",
  "/girar-imagem": "image-rotate",
  "/rotate-image": "image-rotate",
  "/marca-dagua-imagem": "image-watermark",
  "/watermark-image": "image-watermark",
};

const TOOL_ROUTE_MAP: Record<string, string> = {
  "pdf-remove-pages": "/remover-paginas",
  "pdf-extract-pages": "/extrair-paginas",
  "html-to-pdf": "/html-para-pdf",
  "scan-to-pdf": "/digitalizar-pdf",
  "pdf-edit": "/editar-pdf",
  "pdf-compare": "/comparar-pdf",
  "pdf-merge": "/juntar-pdf",
  "pdf-split": "/dividir-pdf",
  "pdf-rotate": "/rotacionar-pdf",
  "pdf-crop": "/recortar-pdf",
  "pdf-sign": "/assinar-pdf",
  "pdf-form-fill": "/preencher-formulario",
  "pdf-unlock": "/desbloquear-pdf",
  "pdf-compress": "/comprimir-pdf",
  "pdf-organize": "/organizar-pdf",
  "pdf-to-word": "/pdf-para-word",
  "word-to-pdf": "/word-para-pdf",
  "images-to-pdf": "/imagem-para-pdf",
  "pdf-to-jpg": "/pdf-para-jpg",
  "pdf-to-markdown": "/pdf-para-markdown",
  "pdf-watermark": "/marca-dagua",
  "pdf-page-numbers": "/numeros-de-pagina",
  "pdf-ocr": "/ocr-pdf",
  "pdf-protect": "/proteger-pdf",
  "pdf-redact": "/ocultar-pdf",
  "pdf-to-excel": "/pdf-para-excel",
  "pdf-extract-images": "/extrair-imagens",
  "text-compare": "/comparar-textos",
  "text-review": "/revisar-texto",
  "text-translate": "/traduzir-texto",
  "image-compress": "/comprimir-imagem",
  "image-resize": "/redimensionar-imagem",
  "image-crop": "/recortar-imagem",
  "image-convert": "/converter-imagem",
  "image-rotate": "/girar-imagem",
  "image-watermark": "/marca-dagua-imagem",
};

export function App() {
  const documentCore = useMemo(() => createDocumentCorePort(), []);
  const { addOperation } = useRecentOperations();

  const dynamicTools = useMemo(() => {
    return resolveLauncherTools([], documentCore);
  }, [documentCore]);

  // Estado da zona de trabalho: "pdf" | "img"
  const [workZone, setWorkZone] = useState<WorkZone>(() => {
    if (typeof window !== "undefined") {
      const pathname = withoutAppBase(window.location.pathname).replace(/\/$/, "");
      if (pathname === "/img" || pathname.startsWith("/img/")) {
        return "img";
      }
      const matchedToolId = ROUTE_TOOL_MAP[pathname];
      if (matchedToolId) {
        const found = dynamicTools.find((t) => t.id === matchedToolId);
        if (found?.manifest.category === "image") return "img";
      }
      try {
        const saved = localStorage.getItem("nexohub_work_zone");
        if (saved === "img" && (pathname === "" || pathname === "/")) {
          return "img";
        }
      } catch {
        // Ignora indisponibilidade do localStorage
      }
    }
    return "pdf";
  });

  const [activeDedicatedTool, setActiveDedicatedTool] = useState<LauncherTool | null>(() => {
    if (typeof window !== "undefined") {
      const pathname = withoutAppBase(window.location.pathname).replace(/\/$/, "");
      const matchedToolId = ROUTE_TOOL_MAP[pathname];
      if (matchedToolId) {
        return dynamicTools.find((t) => t.id === matchedToolId) || null;
      }
    }
    return null;
  });

  const [initialFilesForTool, setInitialFilesForTool] = useState<File[]>([]);
  const [activeSuite, setActiveSuite] = useState<SuiteId>("overview");
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const activePath = useRef(window.location.pathname);

  useEffect(() => {
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = withAppBase(`favicon-${workZone}.svg`);
  }, [workZone]);

  useEffect(() => {
    if (withoutAppBase(window.location.pathname) === "/") {
      const route = withAppBase(workZone === "img" ? "/img" : "/pdf");
      window.history.replaceState({ zone: workZone }, "", route);
      activePath.current = route;
    }
  }, [workZone]);

  // Sincroniza a URL do navegador com a zona ativa e ferramenta
  useEffect(() => {
    function handlePopState() {
      const destination = withoutAppBase(window.location.pathname).replace(/\/$/, "");
      const destinationTool = dynamicTools.find((tool) => tool.id === ROUTE_TOOL_MAP[destination]);
      const nextZone =
        destination === "/img" ||
        destination.startsWith("/img/") ||
        destinationTool?.manifest.category === "image"
          ? "img"
          : "pdf";
      if (
        window.location.pathname !== activePath.current &&
        !allowToolNavigation(nextZone === workZone ? "tool" : "zone")
      ) {
        window.history.pushState({}, "", activePath.current);
        return;
      }
      activePath.current = window.location.pathname;
      setActiveSuite("overview");
      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      }
      const pathname = withoutAppBase(window.location.pathname).replace(/\/$/, "");

      if (pathname === "/img" || pathname.startsWith("/img/")) {
        setWorkZone("img");
        setActiveDedicatedTool(null);
        return;
      }

      if (pathname === "/pdf" || pathname === "") {
        setWorkZone("pdf");
        setActiveDedicatedTool(null);
        return;
      }

      const matchedToolId = ROUTE_TOOL_MAP[pathname];
      if (matchedToolId) {
        const found = dynamicTools.find((t) => t.id === matchedToolId);
        if (found) {
          if (found.manifest.category === "image") {
            setWorkZone("img");
          } else {
            setWorkZone("pdf");
          }
          setActiveDedicatedTool(found);
          return;
        }
      }
      setActiveDedicatedTool(null);
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [dynamicTools, workZone]);

  const handleZoneChange = (nextZone: WorkZone) => {
    if (nextZone === workZone || !allowToolNavigation("zone")) return;
    setInitialFilesForTool([]);
    setWorkZone(nextZone);
    setActiveDedicatedTool(null);
    setActiveSuite("overview");
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("nexohub_work_zone", nextZone);
      } catch {
        // Ignora erros
      }
      const targetRoute = withAppBase(nextZone === "img" ? "/img" : "/pdf");
      if (window.location.pathname !== targetRoute) {
        window.history.pushState({ zone: nextZone }, "", targetRoute);
        activePath.current = targetRoute;
      }
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  };

  const selectToolWithUrl = (tool: LauncherTool | null, files?: File[]) => {
    if (!allowToolNavigation()) return;
    setInitialFilesForTool(files || []);
    setActiveDedicatedTool(tool);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
    if (tool) {
      if (tool.manifest.category === "image") {
        setWorkZone("img");
      } else {
        setWorkZone("pdf");
      }
      const targetRoute = withAppBase(TOOL_ROUTE_MAP[tool.id] || `/${tool.id}`);
      if (window.location.pathname !== targetRoute) {
        window.history.pushState({ toolId: tool.id }, "", targetRoute);
      }
    } else {
      const defaultRoute = withAppBase(workZone === "img" ? "/img" : "/pdf");
      if (
        window.location.pathname !== defaultRoute &&
        window.location.pathname !== withAppBase("/")
      ) {
        window.history.pushState({}, "", defaultRoute);
      }
    }
    activePath.current = window.location.pathname;
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

  const zoneTools = useMemo(() => {
    return dynamicTools.filter((tool) => {
      if (workZone === "img") {
        return tool.manifest.category === "image";
      }
      return tool.manifest.category !== "image";
    });
  }, [dynamicTools, workZone]);

  const filteredTools = useMemo(() => {
    return zoneTools.filter((tool) => {
      const matchesSuite =
        activeSuite === "overview" ||
        activeSuite === tool.suite ||
        (activeSuite === "organize" &&
          (tool.suite === "organize" || (tool.suite as string) === "pdf")) ||
        (activeSuite === "optimize" && (tool.suite === "optimize" || tool.id === "pdf-compress")) ||
        (activeSuite === "convert" && tool.suite === "convert") ||
        (activeSuite === "text" &&
          (tool.suite === "text" || (tool.suite as string) === "review")) ||
        (activeSuite === "security" && tool.suite === "security") ||
        (activeSuite === "img-optimize" && tool.suite === "img-optimize") ||
        (activeSuite === "img-edit" && tool.suite === "img-edit") ||
        (activeSuite === "img-convert" && tool.suite === "img-convert") ||
        (activeSuite === "img-security" && tool.suite === "img-security");
      return matchesSuite;
    });
  }, [zoneTools, activeSuite]);

  return (
    <div
      data-zone={workZone}
      className={`app-shell ${activeDedicatedTool ? "app-shell--workspace" : "app-shell--catalog"} app-shell--zone-${workZone}`}
    >
      <a className="skip-link" href="#main-content">
        {translate("app.skip")}
      </a>
      <Header
        tools={zoneTools}
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
        currentZone={workZone}
        onZoneChange={handleZoneChange}
      />
      <main id="main-content" className="launcher-content launcher-content--full">
        {activeDedicatedTool ? (
          <DedicatedToolView
            key={activeDedicatedTool.id}
            tool={activeDedicatedTool}
            documentCore={documentCore}
            initialFiles={initialFilesForTool}
            onOpenTool={(toolId, files) => {
              const found = dynamicTools.find((candidate) => candidate.id === toolId);
              if (found) selectToolWithUrl(found, files);
            }}
            onBack={() => {
              selectToolWithUrl(null);
            }}
            onOperationComplete={(op) => {
              addOperation(op);
            }}
          />
        ) : (
          <div
            id={workZone === "img" ? "panel-zone-img" : "panel-zone-pdf"}
            data-testid={workZone === "img" ? "panel-zone-img" : "panel-zone-pdf"}
            className="launcher-zone-container"
          >
            <div className="launcher-welcome-container">
              <Hero currentZone={workZone} />
              <div className="launcher-suites-center">
                <SuiteNavigation
                  activeSuite={activeSuite}
                  onSelect={setActiveSuite}
                  tools={zoneTools}
                  suitesList={workZone === "img" ? imageSuites : pdfSuites}
                />
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
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="app-footer__brand">
          <NexoHubLogoIcon zone={workZone} size={44} />
          <div className="app-footer__brand-text">
            <span className="app-footer__brand-title">
              <strong>NEXO</strong>
              <span className="brand-logo-accent">HUB</span>
            </span>
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

        <p className="catalog-privacy">{translate("hero.securityBadge")}</p>
        <div className="app-footer__signature">
          <span>— {translate("footer.tagline")}</span>
        </div>
      </footer>

      <CommandPalette
        key={workZone}
        currentZone={workZone}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onSelectSuite={(suite) => {
          setActiveSuite(suite);
          selectToolWithUrl(null);
        }}
        tools={zoneTools}
        onSelectTool={(tool) => selectToolWithUrl(tool)}
      />
    </div>
  );
}
