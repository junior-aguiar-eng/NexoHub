import {
  BetweenHorizontalStart,
  ChevronDown,
  FileArchive,
  FileCode2,
  FileScan,
  FileType,
  FolderInput,
  GitCompareArrows,
  Image,
  Images,
  Languages,
  Lock,
  RotateCw,
  Scissors,
  Search,
  SpellCheck2,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SuiteId } from "./model";

type HeaderProps = {
  activeSuite: SuiteId;
  onSelectSuite: (suite: SuiteId) => void;
  onSelectTool?: (toolId: string) => void;
  activeToolId?: string | null;
  onLogoClick?: () => void;
  onOpenCommandPalette: () => void;
  onOpenCapabilities?: () => void;
  searchQuery?: string;
};

export function Header({
  activeSuite: _activeSuite,
  onSelectSuite: _onSelectSuite,
  onSelectTool,
  activeToolId: _activeToolId,
  onLogoClick,
  onOpenCommandPalette,
  onOpenCapabilities,
  searchQuery: _searchQuery,
}: HeaderProps) {
  const [convertMenuOpen, setConvertMenuOpen] = useState(false);
  const [allToolsMenuOpen, setAllToolsMenuOpen] = useState(false);

  const convertMenuRef = useRef<HTMLDivElement | null>(null);
  const allToolsMenuRef = useRef<HTMLDivElement | null>(null);

  // Fecha dropdowns ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (convertMenuRef.current && !convertMenuRef.current.contains(event.target as Node)) {
        setConvertMenuOpen(false);
      }
      if (allToolsMenuRef.current && !allToolsMenuRef.current.contains(event.target as Node)) {
        setAllToolsMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleToolClick(toolId: string) {
    setConvertMenuOpen(false);
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
          aria-label="NexoHub - Página Inicial"
        >
          <span className="brand-logo-text">
            <strong>NEXO</strong>
            <span className="brand-logo-accent">HUB</span>
          </span>
        </button>
      </div>

      {/* Menu Superior com Links Rápidos e Megamenus */}
      <nav className="header-main-nav" aria-label="Navegação Principal">
        <button type="button" className="nav-link-btn" onClick={() => handleToolClick("pdf-merge")}>
          JUNTAR PDF
        </button>

        <button type="button" className="nav-link-btn" onClick={() => handleToolClick("pdf-split")}>
          DIVIDIR PDF
        </button>

        <button
          type="button"
          className="nav-link-btn"
          onClick={() => handleToolClick("pdf-compress")}
        >
          COMPRIMIR PDF
        </button>

        {/* Dropdown Converter PDF */}
        <div className="nav-dropdown-wrapper" ref={convertMenuRef}>
          <button
            type="button"
            className={`nav-link-btn nav-link-btn--dropdown ${convertMenuOpen ? "nav-link-btn--active" : ""}`}
            onClick={() => {
              setConvertMenuOpen(!convertMenuOpen);
              setAllToolsMenuOpen(false);
            }}
          >
            <span>CONVERTER PDF</span>
            <ChevronDown
              size={14}
              className={`dropdown-chevron ${convertMenuOpen ? "dropdown-chevron--open" : ""}`}
            />
          </button>

          {convertMenuOpen && (
            <div className="megamenu-panel megamenu-panel--convert">
              <div className="megamenu-column">
                <span className="megamenu-col-title">CONVERTER EM PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("images-to-pdf")}
                >
                  <Image size={16} className="megamenu-icon" style={{ color: "#059669" }} />
                  <span>JPG para PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("word-to-pdf")}
                >
                  <FileCode2 size={16} className="megamenu-icon" style={{ color: "#0284C7" }} />
                  <span>WORD para PDF</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">CONVERTER DE PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-to-word")}
                >
                  <FileType size={16} className="megamenu-icon" style={{ color: "#2563EB" }} />
                  <span>PDF para WORD</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-extract-images")}
                >
                  <Images size={16} className="megamenu-icon" style={{ color: "#F59E0B" }} />
                  <span>Extrair Imagens</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Megamenu Todas as Ferramentas */}
        <div className="nav-dropdown-wrapper" ref={allToolsMenuRef}>
          <button
            type="button"
            className={`nav-link-btn nav-link-btn--dropdown ${allToolsMenuOpen ? "nav-link-btn--active" : ""}`}
            onClick={() => {
              setAllToolsMenuOpen(!allToolsMenuOpen);
              setConvertMenuOpen(false);
            }}
          >
            <span>TODAS AS FERRAMENTAS PDF</span>
            <ChevronDown
              size={14}
              className={`dropdown-chevron ${allToolsMenuOpen ? "dropdown-chevron--open" : ""}`}
            />
          </button>

          {allToolsMenuOpen && (
            <div className="megamenu-panel megamenu-panel--all">
              <div className="megamenu-column">
                <span className="megamenu-col-title">ORGANIZAR PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-merge")}
                >
                  <FolderInput size={15} style={{ color: "#E11D48" }} />
                  <span>Juntar PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-split")}
                >
                  <Scissors size={15} style={{ color: "#EA580C" }} />
                  <span>Dividir PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-rotate")}
                >
                  <RotateCw size={15} style={{ color: "#D97706" }} />
                  <span>Rotacionar PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-organize")}
                >
                  <BetweenHorizontalStart size={15} style={{ color: "#EF4444" }} />
                  <span>Organizar PDF</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">OTIMIZAR PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-compress")}
                >
                  <FileArchive size={15} style={{ color: "#10B981" }} />
                  <span>Comprimir PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-ocr")}
                >
                  <FileScan size={15} style={{ color: "#8B5CF6" }} />
                  <span>OCR PDF</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">CONVERTER EM PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("images-to-pdf")}
                >
                  <Image size={15} style={{ color: "#059669" }} />
                  <span>JPG para PDF</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("word-to-pdf")}
                >
                  <FileCode2 size={15} style={{ color: "#0284C7" }} />
                  <span>WORD para PDF</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">CONVERTER DE PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-to-word")}
                >
                  <FileType size={15} style={{ color: "#2563EB" }} />
                  <span>PDF para WORD</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-extract-images")}
                >
                  <Images size={15} style={{ color: "#F59E0B" }} />
                  <span>Extrair Imagens</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">TEXTO E OCR</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("text-review")}
                >
                  <SpellCheck2 size={15} style={{ color: "#6366F1" }} />
                  <span>Revisar Texto</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("text-compare")}
                >
                  <GitCompareArrows size={15} style={{ color: "#3B82F6" }} />
                  <span>Comparar Textos</span>
                </button>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("text-translate")}
                >
                  <Languages size={15} style={{ color: "#06B6D4" }} />
                  <span>Traduzir Texto</span>
                </button>
              </div>

              <div className="megamenu-column">
                <span className="megamenu-col-title">SEGURANÇA DO PDF</span>
                <button
                  type="button"
                  className="megamenu-item"
                  onClick={() => handleToolClick("pdf-protect")}
                >
                  <Lock size={15} style={{ color: "#475569" }} />
                  <span>Proteger PDF</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Canto Direito com Superpoderes, Busca e Avatar */}
      <div className="header-actions">
        {onOpenCapabilities && (
          <button
            type="button"
            className="header-capabilities-btn"
            onClick={onOpenCapabilities}
            aria-label="Superpoderes Documentais"
            title="Superpoderes Documentais (Sidecars e Motores)"
          >
            <Zap size={15} />
            <span>Superpoderes</span>
          </button>
        )}

        <button
          type="button"
          className="header-search-icon-btn"
          onClick={onOpenCommandPalette}
          aria-label="Buscar no NexoHub"
          title="Buscar no NexoHub (Ctrl+K)"
        >
          <Search size={18} />
        </button>
      </div>
    </header>
  );
}
