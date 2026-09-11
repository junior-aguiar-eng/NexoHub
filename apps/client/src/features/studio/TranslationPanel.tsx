import type { TranslateTextResult, TranslationModelInfo } from "@nexohub/contracts";
import type { ArtifactId, DocumentId } from "@nexohub/domain";
import { ArrowLeftRight, Copy, Languages, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type TranslationPanelProps = {
  documentCore?: DocumentCorePort;
  projectPath?: string;
  documentId?: string;
  artifactId?: string;
  onSuccess?: (result: TranslateTextResult) => void;
};

export function TranslationPanel({
  documentCore,
  projectPath,
  documentId,
  artifactId,
  onSuccess,
}: TranslationPanelProps) {
  const [inputText, setInputText] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [sourceLang, setSourceLang] = useState("pt-BR");
  const [targetLang, setTargetLang] = useState("en");
  const [models, setModels] = useState<readonly TranslationModelInfo[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!documentCore) return;
    documentCore
      .invoke("list_translation_models", { projectPath })
      .then((res) => {
        setModels(res.models);
        if (res.models.length > 0) {
          setSelectedModelId(res.models[0].modelId);
        }
      })
      .catch(() => {
        setModels([]);
      });
  }, [documentCore, projectPath]);

  function handleSwapLanguages() {
    const currentSource = sourceLang;
    const currentTarget = targetLang;
    setSourceLang(currentTarget);
    setTargetLang(currentSource);
    if (translatedText) {
      setInputText(translatedText);
      setTranslatedText("");
    }
  }

  async function handleTranslate() {
    if (!documentCore || !inputText.trim()) return;
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const res = await documentCore.invoke("translate_text", {
        text: inputText,
        sourceLanguage: sourceLang,
        targetLanguage: targetLang,
        modelId: selectedModelId || undefined,
        projectPath,
        documentId: documentId as DocumentId | undefined,
        artifactId: artifactId as ArtifactId | undefined,
      });
      setTranslatedText(res.text);
      onSuccess?.(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCopy() {
    if (!translatedText) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignora erro de clipboard se bloqueado
    }
  }

  return (
    <section className="text-editor" aria-labelledby="translation-title">
      <div className="text-editor__toolbar">
        <div>
          <p className="eyebrow">{translate("translation.eyebrow")}</p>
          <h2 id="translation-title">{translate("translation.title")}</h2>
        </div>
        <Button
          variant="secondary"
          disabled={!documentCore || !inputText.trim() || isLoading}
          onClick={handleTranslate}
        >
          {isLoading ? (
            <Loader2 size={15} className="animate-spin" style={{ marginRight: "0.4rem" }} />
          ) : (
            <Languages size={15} style={{ marginRight: "0.4rem" }} />
          )}
          {translate("translation.run")}
        </Button>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
          padding: "0.6rem 1rem",
          borderBottom: "1px solid var(--color-border)",
          background: "var(--color-surface)",
          fontSize: "0.82rem",
          flexWrap: "wrap",
        }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span>{translate("translation.source")}:</span>
          <select
            value={sourceLang}
            onChange={(e) => setSourceLang(e.target.value)}
            style={{
              background: "var(--color-surface-raised)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "0.2rem 0.5rem",
              fontSize: "0.82rem",
            }}
          >
            <option value="pt-BR">Português (pt-BR)</option>
            <option value="en">Inglês (en)</option>
            <option value="es">Espanhol (es)</option>
            <option value="fr">Francês (fr)</option>
            <option value="de">Alemão (de)</option>
            <option value="it">Italiano (it)</option>
          </select>
        </label>

        <Button
          type="button"
          variant="ghost"
          onClick={handleSwapLanguages}
          title="Inverter idiomas de origem e destino"
          style={{ padding: "0.25rem 0.4rem" }}
        >
          <ArrowLeftRight size={14} />
        </Button>

        <label style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span>{translate("translation.target")}:</span>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            style={{
              background: "var(--color-surface-raised)",
              color: "var(--color-ink)",
              border: "1px solid var(--color-border)",
              borderRadius: "4px",
              padding: "0.2rem 0.5rem",
              fontSize: "0.82rem",
            }}
          >
            <option value="en">Inglês (en)</option>
            <option value="pt-BR">Português (pt-BR)</option>
            <option value="es">Espanhol (es)</option>
            <option value="fr">Francês (fr)</option>
            <option value="de">Alemão (de)</option>
            <option value="it">Italiano (it)</option>
          </select>
        </label>

        {models.length > 1 && (
          <label
            style={{ display: "flex", alignItems: "center", gap: "0.35rem", marginLeft: "auto" }}
          >
            <span>Modelo:</span>
            <select
              value={selectedModelId}
              onChange={(e) => setSelectedModelId(e.target.value)}
              style={{
                background: "var(--color-surface-raised)",
                color: "var(--color-ink)",
                border: "1px solid var(--color-border)",
                borderRadius: "4px",
                padding: "0.2rem 0.5rem",
                fontSize: "0.82rem",
              }}
            >
              {models.map((m) => (
                <option key={m.modelId} value={m.modelId}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      <label style={{ display: "block" }}>
        <span className="sr-only">Texto para tradução</span>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Digite ou cole o texto que deseja traduzir..."
          rows={5}
        />
      </label>

      {translatedText && (
        <div
          style={{
            padding: "0.9rem 1rem",
            borderTop: "1px solid var(--color-border)",
            background: "rgba(0, 0, 0, 0.02)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.4rem",
            }}
          >
            <strong
              style={{
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--color-ink-muted)",
              }}
            >
              Texto Traduzido
            </strong>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCopy}
              style={{ fontSize: "0.72rem", padding: "0.2rem 0.5rem" }}
            >
              <Copy size={12} style={{ marginRight: "0.3rem" }} />
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <p style={{ margin: 0, whiteSpace: "pre-wrap", fontSize: "0.85rem", lineHeight: 1.6 }}>
            {translatedText}
          </p>
        </div>
      )}

      <footer>
        <span>{translate("translation.modelRequired")}</span>
        {errorMsg && <span style={{ color: "var(--color-danger, #ef4444)" }}>{errorMsg}</span>}
        <span>{inputText.length} caracteres</span>
        {documentId && <span>Salvo como camada no Nexo Layers</span>}
      </footer>
    </section>
  );
}
