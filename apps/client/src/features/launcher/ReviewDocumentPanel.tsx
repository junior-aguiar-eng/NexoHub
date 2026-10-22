import type { ReviewFinding } from "@nexohub/domain";
import {
  BookOpen,
  Check,
  CheckCircle2,
  Copy,
  Download,
  EyeOff,
  PenTool,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type ReviewDocumentPanelProps = {
  reviewFindings: readonly ReviewFinding[];
  reviewedText: string;
  onReviewedTextChange: (text: string) => void;
  onApplySingleReview: (findingId: string, customReplacement?: string) => void;
  onApplyAllReview: () => void;
  onIgnoreFinding: (findingId: string) => void;
  onAddToDictionary: (word: string) => void;
  isRunning: boolean;
  progressPercent: number;
  progressStatusMessage?: string;
  accentColor?: string;
  outputFileName?: string;
  outputBlob?: Blob;
};

export function ReviewDocumentPanel({
  reviewFindings,
  reviewedText,
  onReviewedTextChange,
  onApplySingleReview,
  onApplyAllReview,
  onIgnoreFinding,
  onAddToDictionary,
  isRunning,
  progressPercent,
  progressStatusMessage,
  accentColor = "#6366f1",
  outputFileName = "documento_revisado.txt",
  outputBlob,
}: ReviewDocumentPanelProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (!reviewedText) return;
    try {
      await navigator.clipboard.writeText(reviewedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  function handleDownload() {
    if (!reviewedText) return;
    const blob = outputBlob || new Blob([reviewedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = outputFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const wordCount = reviewedText.trim() ? reviewedText.trim().split(/\s+/).length : 0;
  const charCount = reviewedText.length;

  function getRuleBadgeStyle(rule: ReviewFinding["rule"]): {
    label: string;
    bg: string;
    color: string;
    border: string;
  } {
    switch (rule) {
      case "SPELLING":
        return {
          label: translate("workspace.review.rule.SPELLING"),
          bg: "rgba(245, 158, 11, 0.1)",
          color: "#b45309",
          border: "rgba(245, 158, 11, 0.3)",
        };
      case "PARONYM_CONTEXT":
        return {
          label: translate("workspace.review.rule.PARONYM_CONTEXT"),
          bg: "rgba(99, 102, 241, 0.1)",
          color: "#4338ca",
          border: "rgba(99, 102, 241, 0.3)",
        };
      case "DUPLICATE_WORD":
        return {
          label: translate("workspace.review.rule.DUPLICATE_WORD"),
          bg: "rgba(168, 85, 247, 0.1)",
          color: "#7e22ce",
          border: "rgba(168, 85, 247, 0.3)",
        };
      case "STYLE_SUGGESTION":
        return {
          label: translate("workspace.review.rule.STYLE_SUGGESTION"),
          bg: "rgba(6, 182, 212, 0.1)",
          color: "#0e7490",
          border: "rgba(6, 182, 212, 0.3)",
        };
      case "SPACE_BEFORE_PUNCTUATION":
        return {
          label: translate("workspace.review.rule.SPACE_BEFORE_PUNCTUATION"),
          bg: "rgba(100, 116, 139, 0.1)",
          color: "#334155",
          border: "rgba(100, 116, 139, 0.3)",
        };
      case "REPEATED_WHITESPACE":
      case "TRAILING_WHITESPACE":
        return {
          label: translate("workspace.review.rule.REPEATED_WHITESPACE"),
          bg: "rgba(100, 116, 139, 0.1)",
          color: "#334155",
          border: "rgba(100, 116, 139, 0.3)",
        };
      case "GRAMMAR_AGREEMENT":
        return {
          label: translate("workspace.review.rule.GRAMMAR_AGREEMENT"),
          bg: "rgba(239, 68, 68, 0.1)",
          color: "#b91c1c",
          border: "rgba(239, 68, 68, 0.3)",
        };
      case "CRASE_USAGE":
        return {
          label: translate("workspace.review.rule.CRASE_USAGE"),
          bg: "rgba(147, 51, 234, 0.1)",
          color: "#7e22ce",
          border: "rgba(147, 51, 234, 0.3)",
        };
      case "ACCENTUATION":
        return {
          label: translate("workspace.review.rule.ACCENTUATION"),
          bg: "rgba(249, 115, 22, 0.1)",
          color: "#c2410c",
          border: "rgba(249, 115, 22, 0.3)",
        };
      case "PLEONASM_REDUNDANCY":
        return {
          label: translate("workspace.review.rule.PLEONASM_REDUNDANCY"),
          bg: "rgba(217, 70, 239, 0.1)",
          color: "#a21caf",
          border: "rgba(217, 70, 239, 0.3)",
        };
      default:
        return {
          label: translate("workspace.review.rule.LANGUAGE_TOOL"),
          bg: "rgba(59, 130, 246, 0.1)",
          color: "#1d4ed8",
          border: "rgba(59, 130, 246, 0.3)",
        };
    }
  }

  return (
    <div
      className="ilovepdf-review-container"
      style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}
    >
      {/* Barra superior de privacidade e motor */}
      <div
        className="ilovepdf-review-top-bar"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0.75rem 1rem",
          background: "rgba(99, 102, 241, 0.05)",
          borderRadius: "0.75rem",
          border: "1px solid rgba(99, 102, 241, 0.15)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <PenTool size={18} style={{ color: accentColor }} />
          <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 700 }}>
            {translate("workspace.review.title")}
          </h4>
        </div>

        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.4rem",
            fontSize: "0.75rem",
            color: "#4338ca",
            fontWeight: 500,
            background: "rgba(99, 102, 241, 0.1)",
            padding: "0.3rem 0.6rem",
            borderRadius: "0.5rem",
          }}
        >
          <ShieldCheck size={14} style={{ color: "#4f46e5" }} />
          <span>{translate("workspace.review.offlineBadge")}</span>
        </div>
      </div>

      {/* Barra de progresso durante carregamento ou download de dicionário */}
      {isRunning && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.4rem",
            padding: "0.75rem 1rem",
            background: "rgba(99, 102, 241, 0.04)",
            borderRadius: "0.5rem",
            border: "1px solid rgba(99, 102, 241, 0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "0.8rem",
              fontWeight: 500,
              color: "#4338ca",
            }}
          >
            <span>
              <Sparkles size={14} style={{ display: "inline", marginRight: "4px" }} />
              {progressStatusMessage || "Processando revisão textual..."}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div
            style={{
              height: "6px",
              background: "#e2e8f0",
              borderRadius: "3px",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${progressPercent}%`,
                height: "100%",
                background: `linear-gradient(90deg, ${accentColor}, #818cf8)`,
                transition: "width 0.2s ease-out",
              }}
            />
          </div>
        </div>
      )}

      {/* Painel de Sugestões e Destaques */}
      {reviewFindings.length > 0 ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.75rem",
            background: "#ffffff",
            padding: "1rem",
            borderRadius: "0.75rem",
            border: "1px solid #e2e8f0",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#475569" }}>
              <strong style={{ color: "#1e293b", fontSize: "0.95rem" }}>
                {reviewFindings.length}
              </strong>{" "}
              {translate("workspace.review.suggestionsFound")}
            </div>
            <Button
              variant="primary"
              size="compact"
              onClick={onApplyAllReview}
              style={{ backgroundColor: accentColor }}
            >
              <Check size={14} />
              <span>{translate("workspace.review.applyAll")}</span>
            </Button>
          </div>

          <div
            className="text-review-findings-list"
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "0.6rem",
              maxHeight: "260px",
              overflowY: "auto",
              paddingRight: "0.25rem",
            }}
          >
            {reviewFindings.map((finding) => {
              const badge = getRuleBadgeStyle(finding.rule);
              return (
                <div
                  key={finding.id}
                  className="text-review-finding-card"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    padding: "0.6rem 0.8rem",
                    background: "rgba(248, 250, 252, 0.9)",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.5rem",
                  }}
                >
                  <div
                    className="text-review-finding-content"
                    style={{ display: "flex", flexDirection: "column", gap: "0.3rem", flex: 1 }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          padding: "0.15rem 0.4rem",
                          borderRadius: "0.25rem",
                          background: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                        }}
                      >
                        {badge.label}
                      </span>
                      <span
                        className="text-review-finding-orig"
                        style={{
                          color: "#ef4444",
                          textDecoration: "line-through",
                          fontWeight: 600,
                          fontSize: "0.85rem",
                        }}
                      >
                        "{finding.original}"
                      </span>
                      <span
                        className="text-review-finding-arrow"
                        style={{ color: "#64748b", fontSize: "0.85rem" }}
                      >
                        →
                      </span>
                      <span
                        className="text-review-finding-repl"
                        style={{ color: "#16a34a", fontWeight: 700, fontSize: "0.9rem" }}
                      >
                        "{finding.replacement}"
                      </span>
                    </div>

                    <p
                      className="text-review-finding-msg"
                      style={{ margin: 0, fontSize: "0.78rem", color: "#64748b" }}
                    >
                      {finding.message}
                    </p>

                    {/* Alternativas adicionais se disponíveis */}
                    {finding.suggestions && finding.suggestions.length > 1 && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          flexWrap: "wrap",
                          marginTop: "0.2rem",
                        }}
                      >
                        <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>Opções:</span>
                        {finding.suggestions.slice(0, 4).map((alt) => (
                          <button
                            type="button"
                            key={alt}
                            onClick={() => onApplySingleReview(finding.id, alt)}
                            style={{
                              fontSize: "0.72rem",
                              padding: "0.15rem 0.45rem",
                              borderRadius: "0.25rem",
                              border: "1px solid #cbd5e1",
                              background: "#f1f5f9",
                              color: "#334155",
                              cursor: "pointer",
                            }}
                            title={`Aplicar "${alt}"`}
                          >
                            {alt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Ações individuais do card */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      flexShrink: 0,
                    }}
                  >
                    <Button
                      variant="primary"
                      size="compact"
                      onClick={() => onApplySingleReview(finding.id)}
                      title={translate("workspace.review.applyTitle")}
                      style={{
                        backgroundColor: accentColor,
                        fontSize: "0.75rem",
                        padding: "0.25rem 0.6rem",
                      }}
                    >
                      {translate("workspace.review.apply")}
                    </Button>

                    <Button
                      variant="ghost"
                      size="compact"
                      onClick={() => onIgnoreFinding(finding.id)}
                      title={translate("workspace.review.ignoreTitle")}
                      style={{ fontSize: "0.75rem", padding: "0.25rem 0.4rem", color: "#64748b" }}
                    >
                      <EyeOff size={13} />
                    </Button>

                    {finding.rule === "SPELLING" && (
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => onAddToDictionary(finding.original)}
                        title={translate("workspace.review.addToDictionaryTitle")}
                        style={{ fontSize: "0.75rem", padding: "0.25rem 0.4rem", color: "#64748b" }}
                      >
                        <BookOpen size={13} />
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="text-review-empty-box"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.75rem 1rem",
            background: "rgba(34, 197, 94, 0.08)",
            border: "1px solid rgba(34, 197, 94, 0.25)",
            borderRadius: "0.75rem",
            color: "#15803d",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={20} style={{ color: "#16a34a" }} />
          <span>{translate("workspace.review.noIssues")}</span>
        </div>
      )}

      {/* Caixa de Texto Revisado e Ações */}
      <div
        className="text-review-output-box"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.5rem",
          background: "#ffffff",
          padding: "1rem",
          borderRadius: "0.75rem",
          border: "1px solid #e2e8f0",
        }}
      >
        <div
          className="text-review-output-header"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "0.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
              {translate("workspace.review.reviewedText")}
            </span>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              ({wordCount} palavras • {charCount} caracteres)
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Button
              variant="ghost"
              size="compact"
              onClick={handleCopy}
              disabled={!reviewedText}
              style={{ fontSize: "0.75rem" }}
            >
              {copied ? <Check size={14} style={{ color: "#16a34a" }} /> : <Copy size={14} />}
              <span>
                {copied ? translate("workspace.ocr.copied") : translate("workspace.review.copy")}
              </span>
            </Button>

            <Button
              variant="ghost"
              size="compact"
              onClick={handleDownload}
              disabled={!reviewedText}
              style={{ fontSize: "0.75rem" }}
            >
              <Download size={14} />
              <span>{translate("workspace.review.downloadTxt")}</span>
            </Button>
          </div>
        </div>

        <textarea
          className="text-review-textarea"
          value={reviewedText}
          onChange={(e) => onReviewedTextChange(e.target.value)}
          placeholder={translate("workspace.review.placeholder")}
          rows={10}
          style={{
            width: "100%",
            padding: "0.75rem",
            borderRadius: "0.5rem",
            border: "1px solid #cbd5e1",
            fontFamily: "var(--font-sans, inherit)",
            fontSize: "0.88rem",
            lineHeight: 1.6,
            background: "#f8fafc",
            color: "#1e293b",
            outline: "none",
            resize: "vertical",
          }}
        />
      </div>
    </div>
  );
}
