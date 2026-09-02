import { applyReviewFindings, type ReviewFinding } from "@nexohub/domain";
import { CheckCheck, SearchCheck } from "lucide-react";
import { useRef, useState } from "react";
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
};

export function ReviewPanel({
  initialContent = "",
  documentCore,
  revisionContext,
}: ReviewPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [savedContent, setSavedContent] = useState(initialContent);
  const [artifactId, setArtifactId] = useState(revisionContext?.artifactId);
  const [findings, setFindings] = useState<readonly ReviewFinding[]>([]);
  const analysisGeneration = useRef(0);

  async function analyze() {
    if (!documentCore) return;
    const generation = ++analysisGeneration.current;
    const analyzedContent = content;
    const result = await documentCore.invoke("review_text", { text: analyzedContent });
    if (generation !== analysisGeneration.current) return;
    setFindings(
      result.matches.map((match) => ({
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
      })),
    );
  }

  function applyAll() {
    setContent(applyReviewFindings(content, findings));
    setFindings([]);
  }

  async function save() {
    if (!documentCore || !revisionContext || !artifactId || content === savedContent) return;
    const result = await documentCore.invoke("create_text_revision", {
      projectPath: revisionContext.projectPath,
      documentId: revisionContext.documentId,
      artifactId,
      content,
    });
    setSavedContent(content);
    setArtifactId(result.artifact.id);
  }

  return (
    <section className="text-editor review-panel" aria-labelledby="review-title">
      <div className="text-editor__toolbar">
        <div>
          <p className="eyebrow">{translate("review.eyebrow")}</p>
          <h2 id="review-title">{translate("review.title")}</h2>
        </div>
        <Button variant="secondary" disabled={!content || !documentCore} onClick={analyze}>
          <SearchCheck size={16} aria-hidden="true" />
          {translate("review.analyze")}
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
          }}
        />
      </label>
      <div className="review-panel__results" aria-live="polite">
        {!documentCore && <p>{translate("review.engineRequired")}</p>}
        <strong>
          {findings.length} {translate("review.findings")}
        </strong>
        {findings.length > 0 && (
          <>
            <ol>
              {findings.map((finding) => (
                <li key={finding.id}>
                  <span className="review-panel__message">{finding.message}</span>
                  <code>{finding.original}</code>
                </li>
              ))}
            </ol>
            <Button variant="secondary" onClick={applyAll}>
              <CheckCheck size={16} aria-hidden="true" />
              {translate("review.applyAll")}
            </Button>
          </>
        )}
      </div>
      <footer>
        <Button
          disabled={!documentCore || !revisionContext || content === savedContent}
          onClick={save}
        >
          {translate("review.save")}
        </Button>
        {(!documentCore || !revisionContext) && <span>{translate("review.projectRequired")}</span>}
      </footer>
    </section>
  );
}
