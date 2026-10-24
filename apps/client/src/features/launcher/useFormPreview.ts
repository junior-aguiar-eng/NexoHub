import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import { renderPdfPageToDataUrl } from "@/platform/pdf-engine";
import {
  type FormFieldValue,
  getPdfFormRevisionBytes,
  matchesPdfFormRevision,
  type PdfFormRevision,
  preparePdfFormRevision,
} from "@/platform/pdf-form";

interface FormPreviewInput {
  file?: File;
  enabled: boolean;
  values: Record<string, FormFieldValue>;
  flatten: boolean;
  page: number;
}
function previewError(error: unknown): string {
  if (error instanceof Error) {
    if (error.message === "PDF_FORM_CARACTERE_NAO_SUPORTADO")
      return translate("formFill.unsupportedCharacters");
    if (error.message === "PDF_ASSINADO_NAO_SUPORTADO")
      return translate("toolQuality.signedDocument");
    if (error.message === "PDF_XFA_NAO_SUPORTADO") return translate("toolQuality.unsupportedForm");
    if (error.message.startsWith("PDF_FORM_CAMPO") || error.message === "PDF_FORM_VALOR_INVALIDO")
      return translate("toolQuality.invalidForm");
  }
  return translate("formFill.previewError");
}

/** Only a fully rendered current revision is available for export. No preview object URLs. */
export function useFormPreview({ file, enabled, values, flatten, page }: FormPreviewInput) {
  const [retryToken, setRetryToken] = useState(0);
  const [prepared, setPrepared] = useState<PdfFormRevision>();
  const [preparationError, setPreparationError] = useState<{
    file: File;
    values: typeof values;
    flatten: boolean;
    message: string;
  }>();
  const [preview, setPreview] = useState<{
    revision: PdfFormRevision;
    page: number;
    url?: string;
    error?: string;
  }>();
  const revision =
    enabled && file && prepared && matchesPdfFormRevision(prepared, file, { values, flatten })
      ? prepared
      : undefined;
  // biome-ignore lint/correctness/useExhaustiveDependencies: retryToken invalida explicitamente a sessão após uma falha.
  useEffect(() => {
    const controller = new AbortController();
    setPrepared(undefined);
    setPreparationError(undefined);
    if (!file || !enabled) return () => controller.abort();
    const timer = setTimeout(() => {
      void preparePdfFormRevision(file, { values, flatten }, controller.signal)
        .then((next) => {
          if (!controller.signal.aborted) setPrepared(next);
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted)
            setPreparationError({ file, values, flatten, message: previewError(error) });
        });
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [file, enabled, values, flatten, retryToken]);
  useEffect(() => {
    const controller = new AbortController();
    setPreview(undefined);
    if (!revision) return () => controller.abort();
    void renderPdfPageToDataUrl(getPdfFormRevisionBytes(revision), page, 1.8, controller.signal)
      .then((url) => {
        if (controller.signal.aborted) return;
        if (!url) throw new Error("PDF_FORM_PREVIA_INDISPONIVEL");
        setPreview({ revision, page, url });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setPreview({ revision, page, error: previewError(error) });
      });
    return () => controller.abort();
  }, [revision, page]);
  const currentPreview =
    revision && preview?.revision === revision && preview.page === page ? preview : undefined;
  const error =
    enabled &&
    preparationError &&
    preparationError.file === file &&
    preparationError.values === values &&
    preparationError.flatten === flatten
      ? preparationError.message
      : currentPreview?.error;
  const ready = Boolean(currentPreview?.url && !error);
  return {
    previewUrl: ready ? currentPreview?.url : undefined,
    revision: ready ? revision : undefined,
    pending: Boolean(enabled && file && !ready && !error),
    error,
    retry: () => setRetryToken((value) => value + 1),
  };
}
