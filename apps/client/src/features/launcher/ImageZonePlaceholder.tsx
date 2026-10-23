import {
  Cpu,
  Eye,
  Image as ImageIcon,
  Layers,
  Lock,
  Maximize2,
  ShieldCheck,
  Sliders,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { translate } from "@/i18n";

export function ImageZonePlaceholder() {
  const [activeTab, setActiveTab] = useState<"features" | "preview">("features");

  return (
    <section
      id="panel-zone-img"
      data-testid="panel-zone-img"
      role="tabpanel"
      aria-labelledby="tab-zone-img"
      className="w-full max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8 animate-fade-in"
    >
      {/* Top Banner Status */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-violet-500/10 border border-blue-500/20 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-violet-950/40 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <ImageIcon className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300">
                {translate("imageZone.badge")}
              </span>
              <span className="text-xs font-medium text-text-tertiary">
                {translate("imageZone.statusBadge")}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-text-primary mt-1">
              {translate("imageZone.title")}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-600/10 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Lock className="w-3.5 h-3.5" aria-hidden="true" />
            100% Local-First
          </span>
        </div>
      </div>

      {/* Main Grid: Architecture & Studio Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left Column: 3 Pillars (7 cols) */}
        <div className="lg:col-span-7 flex flex-col gap-4 justify-between">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 mb-2">
              {translate("imageZone.statusTitle")}
            </h3>
            <p className="text-sm text-text-secondary leading-relaxed mb-6">
              {translate("imageZone.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Pillar 1 */}
            <div className="p-4 rounded-xl bg-surface border border-border shadow-xs flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <ShieldCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-text-primary">
                {translate("imageZone.pillar1Title")}
              </h4>
              <p className="text-[11px] text-text-tertiary leading-snug">
                {translate("imageZone.pillar1Desc")}
              </p>
            </div>

            {/* Pillar 2 */}
            <div className="p-4 rounded-xl bg-surface border border-border shadow-xs flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                <Cpu className="w-5 h-5" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-text-primary">
                {translate("imageZone.pillar2Title")}
              </h4>
              <p className="text-[11px] text-text-tertiary leading-snug">
                {translate("imageZone.pillar2Desc")}
              </p>
            </div>

            {/* Pillar 3 */}
            <div className="p-4 rounded-xl bg-surface border border-border shadow-xs flex flex-col gap-2">
              <div className="w-9 h-9 rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center">
                <Layers className="w-5 h-5" aria-hidden="true" />
              </div>
              <h4 className="text-xs font-bold text-text-primary">
                {translate("imageZone.pillar3Title")}
              </h4>
              <p className="text-[11px] text-text-tertiary leading-snug">
                {translate("imageZone.pillar3Desc")}
              </p>
            </div>
          </div>

          {/* Status Note */}
          <div className="p-4 rounded-xl bg-surface-muted/60 border border-border/80 text-xs text-text-secondary flex items-start gap-3 mt-2">
            <Sparkles
              className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="leading-relaxed">{translate("imageZone.statusDesc")}</p>
          </div>
        </div>

        {/* Right Column: Studio UI Mockup (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-blue-500/30 bg-surface overflow-hidden shadow-xs flex flex-col">
          {/* Mock Window Titlebar */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-secondary/50">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
              <span className="text-xs font-mono text-text-tertiary ml-2">
                estudio-imagem.canvas
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setActiveTab("features")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  activeTab === "features"
                    ? "bg-blue-600 text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Parâmetros
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("preview")}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                  activeTab === "preview"
                    ? "bg-blue-600 text-white"
                    : "text-text-tertiary hover:text-text-primary"
                }`}
              >
                Prévia
              </button>
            </div>
          </div>

          {/* Mock Canvas Workspace */}
          <div className="flex-1 p-5 flex flex-col items-center justify-center bg-gradient-to-b from-blue-500/5 to-indigo-500/5 min-h-[220px]">
            {activeTab === "features" ? (
              <div className="w-full flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Sliders className="w-3.5 h-3.5 text-blue-600" />
                    Brilho & Contraste
                  </span>
                  <span className="font-mono text-blue-600 font-bold">100%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-secondary overflow-hidden">
                  <div className="h-full bg-blue-600 rounded-full w-2/3" />
                </div>

                <div className="flex items-center justify-between text-xs mt-2">
                  <span className="text-text-secondary flex items-center gap-1.5 font-medium">
                    <Maximize2 className="w-3.5 h-3.5 text-indigo-600" />
                    Escala e Proporção
                  </span>
                  <span className="font-mono text-indigo-600 font-bold">Original (1:1)</span>
                </div>
                <div className="w-full h-2 rounded-full bg-surface-secondary overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full w-1/2" />
                </div>

                <div className="mt-3 p-3 rounded-xl bg-surface border border-border/80 flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">Motor Gráfico</span>
                  <span className="text-xs font-mono font-semibold text-text-primary">
                    WebGL 2.0 / Canvas API
                  </span>
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-4 border border-dashed border-blue-400/40 rounded-xl bg-white/40 dark:bg-black/20 text-center">
                <Eye className="w-8 h-8 text-blue-600/70 mb-2" />
                <span className="text-xs font-semibold text-text-primary">
                  Área de Visualização Vetorial
                </span>
                <span className="text-[11px] text-text-tertiary mt-1">
                  Renderização de alta fidelidade sem compressão com perdas
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
