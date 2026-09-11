import {
  applyReviewFindings,
  mergeReviewFindings,
  type ReviewFinding,
  reviewText,
} from "@nexohub/domain";
import { ArrowRight, Check, CheckCheck, CheckCircle2, Loader2, SearchCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type ReviewPanelProps = {
  initialContent?: string;
  documentCore?: DocumentCorePort;
  revisionContext?: {
    readonly projectPath: string;
    readonly documentId: import("@nexohub/domain").DocumentId;
    readonly artifactId: import("@nexohub/domain").ArtifactId;
  };
  onSuccess?: () => void | Promise<void>;
};

export function ReviewPanel({
  initialContent = "",
  documentCore,
  revisionContext,
  onSuccess,
}: ReviewPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [artifactId, setArtifactId] = useState(revisionContext?.artifactId);
  const [findings, setFindings] = useState<readonly ReviewFinding[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [showSavedSuccess, setShowSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const analysisGeneration = useRef(0);

  const currentDocRef = useRef(revisionContext?.documentId);
  useEffect(() => {
    if (revisionContext?.documentId !== currentDocRef.current) {
      currentDocRef.current = revisionContext?.documentId;
      setArtifactId(revisionContext?.artifactId);
    }
  }, [revisionContext?.documentId, revisionContext?.artifactId]);

  async function analyze() {
    if (!documentCore) return;
    const generation = ++analysisGeneration.current;
    const analyzedContent = content;
    setIsAnalyzing(true);
    setErrorMessage(null);
    try {
      const localFindings = reviewText(analyzedContent);
      const result = await documentCore.invoke("review_text", { text: analyzedContent });
      if (generation !== analysisGeneration.current) return;
      const ltFindings: ReviewFinding[] = result.matches.map((match) => ({
        id: `${match.rule.id}:${match.offset}:${match.offset + match.length}`,
        rule: "LANGUAGE_TOOL" as const,
        severity: match.rule.issueType === "duplication" ? "warning" : "suggestion",
        start: match.offset,
        end: match.offset + match.length,
        original: analyzedContent.slice(match.offset, match.offset + match.length),
        replacement:
          match.replacements[0]?.value ??
          analyzedContent.slice(match.offset, match.offset + match.length),
        message: match.message,
      }));
      setFindings(mergeReviewFindings(ltFindings, localFindings));
      setHasAnalyzed(true);
    } catch {
      if (generation !== analysisGeneration.current) return;
      // Fallback gracioso para as regras de análise local do domínio
      const fallbackFindings = reviewText(analyzedContent);
      setFindings(fallbackFindings);
      setHasAnalyzed(true);
    } finally {
      if (generation === analysisGeneration.current) {
        setIsAnalyzing(false);
      }
    }
  }

  function applyOne(findingId: string) {
    const target = findings.find((f) => f.id === findingId);
    if (!target) return;
    const newContent = applyReviewFindings(content, findings, new Set([findingId]));
    setContent(newContent);
    const delta = target.replacement.length - (target.end - target.start);
    const updated = findings
      .filter((f) => f.id !== findingId)
      .map((f) => {
        if (f.start >= target.end) {
          return {
            ...f,
            start: f.start + delta,
            end: f.end + delta,
          };
        }
        return f;
      });
    setFindings(updated);
  }

  function applyAll() {
    setContent(applyReviewFindings(content, findings));
    setFindings([]);
  }

  async function save() {
    if (!documentCore || !revisionContext || !artifactId || content === savedContent) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const result = await documentCore.invoke("create_text_revision", {
        projectPath: revisionContext.projectPath,
        documentId: revisionContext.documentId,
        artifactId,
        content,
      });
      setSavedContent(content);
      setArtifactId(result.artifact.id);
      setShowSavedSuccess(true);
      setTimeout(() => setShowSavedSuccess(false), 4000);
      await onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <section className="text-editor review-panel" aria-labelledby="review-title">
      <div className="text-editor__toolbar">
        <div>
          <h2 id="review-title" style={{ margin: 0, fontSize: "0.95rem", fontWeight: 600 }}>
            {translate("review.title")}
          </h2>
        </div>
        <Button
          variant="secondary"
          disabled={!content || !documentCore || isAnalyzing}
          onClick={analyze}
        >
          {isAnalyzing ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <SearchCheck size={16} aria-hidden="true" />
          )}
          {isAnalyzing ? translate("review.analyzing") : translate("review.analyze")}
        </Button>
      </div>

      <label>
        <span className="sr-only">{translate("review.label")}</span>
        <textarea
          value={content}
          onChange={(event) => {
            analysisGeneration.current += 1;
            setContent(event.currentTarget.value);
            setFindings([]);
            setHasAnalyzed(false);
          }}
          placeholder="Digite ou cole o texto para revisão..."
        />
      </label>

      <div className="review-panel__results" aria-live="polite">
        {!hasAnalyzed && <p>{translate("review.engineRequired")}</p>}
        {errorMessage && (
          <p className="review-panel__error" role="alert">
            {errorMessage}
          </p>
        )}

        <div className="review-panel__status-bar">
          <strong>
            {findings.length} {translate("review.findings")}
          </strong>
          {findings.length > 0 && (
            <Button variant="secondary" onClick={applyAll} style={{ fontSize: "0.75rem" }}>
              <CheckCheck size={14} aria-hidden="true" style={{ marginRight: "0.3rem" }} />
              {translate("review.applyAll")}
            </Button>
          )}
        </div>

        {hasAnalyzed && findings.length === 0 && (
          <p className="review-panel__empty">{translate("review.noFindings")}</p>
        )}

        {findings.length > 0 && (
          <ol className="review-panel__list">
            {findings.map((finding) => (
              <li key={finding.id} className="review-finding-item">
                <div className="review-finding-item__body">
                  <div className="review-finding-item__header">
                    <span className={`review-badge review-badge--${finding.severity}`}>
                      {finding.severity === "warning" ? "Aviso" : "Sugestão"}
                    </span>
                    <span className="review-panel__message">{finding.message}</span>
                  </div>
                  <div className="review-finding-item__diff">
                    <code className="review-diff-del">{finding.original || "(espaço)"}</code>
                    <ArrowRight size={13} aria-hidden="true" className="review-diff-arrow" />
                    <code className="review-diff-ins">{finding.replacement || "(remover)"}</code>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => applyOne(finding.id)}
                  className="review-finding-item__apply-btn"
                  title="Substituir este achado"
                >
                  <Check size={13} aria-hidden="true" style={{ marginRight: "0.25rem" }} />
                  {translate("review.applyOne")}
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <footer>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <Button
            disabled={!documentCore || !revisionContext || content === savedContent}
            onClick={save}
          >
            {isSaving && (
              <Loader2 size={14} className="animate-spin" style={{ marginRight: "0.3rem" }} />
            )}
            {translate("review.save")}
          </Button>
          {showSavedSuccess && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                color: "var(--color-success, #22c55e)",
                fontSize: "0.75rem",
                fontWeight: 500,
              }}
            >
              <CheckCircle2 size={14} />
              {translate("review.savedSuccess")}
            </span>
          )}
        </div>
        {(!documentCore || !revisionContext) && <span>{translate("review.projectRequired")}</span>}
      </footer>
    </section>
  );
}
