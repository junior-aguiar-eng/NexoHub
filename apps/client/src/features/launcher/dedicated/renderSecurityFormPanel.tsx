import type { RefObject } from "react";
import type {
  FormFieldDescriptor,
  FormFieldValue,
  PdfProtectionStatus,
  RedactionArea,
  SignaturePlacement,
} from "@/platform/pdf-engine";
import { FormFillPdfPanel } from "../FormFillPdfPanel";
import { ProtectPdfPanel } from "../ProtectPdfPanel";
import { RedactPdfPanel } from "../RedactPdfPanel";
import { SignPdfPanel } from "../SignPdfPanel";
import { UnlockPdfPanel } from "../UnlockPdfPanel";
import type { useFormPreview } from "../useFormPreview";

export type SecurityFormPanelProps = {
  toolId: string;
  files: File[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  pdfPageCount: number;
  firstPageThumb: string;
  allPageThumbnails: string[];
  previewEpoch: number;
  handlePreviewPageChange: (page: number) => void;
  onOpenTool?: (toolId: string, files?: File[]) => void;
  // Sign
  signaturePlacement: SignaturePlacement;
  setSignaturePlacement: (v: SignaturePlacement) => void;
  signatureImageBytes: Uint8Array | undefined;
  setSignatureImageBytes: (v: Uint8Array | undefined) => void;
  signerName: string;
  setSignerName: (v: string) => void;
  includeSignatureDate: boolean;
  setIncludeSignatureDate: (v: boolean) => void;
  // Form Fill
  formPreviewPage: number;
  setFormPreviewPage: (v: number) => void;
  formOriginalOnly: boolean;
  formOriginalThumbnail: string | undefined;
  formPreview: ReturnType<typeof useFormPreview>;
  formInputError: string | undefined;
  formFieldsFile: File | undefined;
  formFields: readonly FormFieldDescriptor[];
  isLoadingFormFields: boolean;
  formValues: Record<string, FormFieldValue>;
  setFormValues: (v: Record<string, FormFieldValue>) => void;
  formFlatten: boolean;
  setFormFlatten: (v: boolean) => void;
  // Unlock
  protectionStatus: PdfProtectionStatus;
  isCheckingProtection: boolean;
  unlockPassword: string;
  setUnlockPassword: (v: string) => void;
  // Protect
  protectPassword: string;
  setProtectPassword: (v: string) => void;
  protectConfirmPassword: string;
  setProtectConfirmPassword: (v: string) => void;
  protectAlgorithm: "AES-256" | "RC4";
  setProtectAlgorithm: (v: "AES-256" | "RC4") => void;
  protectAllowPrinting: boolean;
  setProtectAllowPrinting: (v: boolean) => void;
  protectAllowCopying: boolean;
  setProtectAllowCopying: (v: boolean) => void;
  protectAllowModifying: boolean;
  setProtectAllowModifying: (v: boolean) => void;
  protectAllowAnnotating: boolean;
  setProtectAllowAnnotating: (v: boolean) => void;
  protectAllowFillingForms: boolean;
  setProtectAllowFillingForms: (v: boolean) => void;
  // Redact
  redactionPreserve: boolean;
  setRedactionPreserve: (v: boolean) => void;
  redactionAreas: RedactionArea[];
  setRedactionAreas: (v: RedactionArea[]) => void;
};

export function renderSecurityFormPanel(p: SecurityFormPanelProps): React.ReactNode | undefined {
  if (p.toolId === "pdf-sign") {
    return (
      <SignPdfPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.handlePreviewPageChange}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        placement={p.signaturePlacement}
        onPlacementChange={p.setSignaturePlacement}
        signatureImageBytes={p.signatureImageBytes}
        onSignatureImageChange={p.setSignatureImageBytes}
        signerName={p.signerName}
        onSignerNameChange={p.setSignerName}
        includeDate={p.includeSignatureDate}
        onIncludeDateChange={p.setIncludeSignatureDate}
      />
    );
  }

  if (p.toolId === "pdf-form-fill") {
    return (
      <FormFillPdfPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.setFormPreviewPage}
        previewPage={p.formPreviewPage}
        revisionPreview={
          p.formOriginalOnly
            ? {
                previewUrl: p.formOriginalThumbnail,
                pending: !p.formOriginalThumbnail,
                isOriginal: true,
              }
            : { ...p.formPreview, error: p.formInputError ?? p.formPreview.error }
        }
        onRetryPreview={p.formInputError ? undefined : p.formPreview.retry}
        onReplaceFile={() => p.fileInputRef.current?.click()}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        fields={p.formFieldsFile === p.files[0] ? p.formFields : []}
        isLoadingFields={p.isLoadingFormFields}
        values={p.formValues}
        onValuesChange={p.setFormValues}
        flatten={p.formFlatten}
        onFlattenChange={p.setFormFlatten}
        onGoToSign={() => {
          window.location.hash = "#/assinar-pdf";
        }}
      />
    );
  }

  if (p.toolId === "pdf-unlock") {
    return (
      <UnlockPdfPanel
        key={`${p.files[0]?.name}-${p.files[0]?.size}-${p.files[0]?.lastModified}`}
        onPreviewPageChange={p.handlePreviewPageChange}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        protectionStatus={p.protectionStatus}
        isCheckingStatus={p.isCheckingProtection}
        passwordValue={p.unlockPassword}
        onPasswordChange={p.setUnlockPassword}
        onGoToCompress={() => {
          window.location.hash = "#/comprimir-pdf";
        }}
        onGoToOrganize={() => {
          window.location.hash = "#/organizar-pdf";
        }}
      />
    );
  }

  if (p.toolId === "pdf-protect") {
    return (
      <ProtectPdfPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.handlePreviewPageChange}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        protectionStatus={p.protectionStatus}
        passwordValue={p.protectPassword}
        onPasswordChange={p.setProtectPassword}
        confirmPasswordValue={p.protectConfirmPassword}
        onConfirmPasswordChange={p.setProtectConfirmPassword}
        algorithm={p.protectAlgorithm}
        onAlgorithmChange={p.setProtectAlgorithm}
        allowPrinting={p.protectAllowPrinting}
        onAllowPrintingChange={p.setProtectAllowPrinting}
        allowCopying={p.protectAllowCopying}
        onAllowCopyingChange={p.setProtectAllowCopying}
        allowModifying={p.protectAllowModifying}
        onAllowModifyingChange={p.setProtectAllowModifying}
        allowAnnotating={p.protectAllowAnnotating}
        onAllowAnnotatingChange={p.setProtectAllowAnnotating}
        allowFillingForms={p.protectAllowFillingForms}
        onAllowFillingFormsChange={p.setProtectAllowFillingForms}
        onGoToUnlock={p.onOpenTool ? () => p.onOpenTool?.("pdf-unlock", p.files) : undefined}
      />
    );
  }

  if (p.toolId === "pdf-redact") {
    return (
      <RedactPdfPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.handlePreviewPageChange}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        preserve={p.redactionPreserve}
        onPreserveChange={p.setRedactionPreserve}
        redactions={p.redactionAreas}
        onRedactionsChange={(areas) => p.setRedactionAreas([...areas])}
        file={p.files[0]}
      />
    );
  }

  return undefined;
}
