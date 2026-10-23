import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  FileText,
  FormInput,
  Info,
  Loader2,
  PenTool,
  RotateCcw,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";
import type { FormFieldDescriptor, FormFieldValue } from "@/platform/pdf-form";

export interface FormFillPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly fields: readonly FormFieldDescriptor[];
  readonly isLoadingFields?: boolean;
  readonly values: Record<string, FormFieldValue>;
  readonly onValuesChange: (values: Record<string, FormFieldValue>) => void;
  readonly flatten: boolean;
  readonly onFlattenChange: (flatten: boolean) => void;
  readonly onGoToSign?: () => void;
}

export function FormFillPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  fields,
  isLoadingFields = false,
  values,
  onValuesChange,
  flatten,
  onFlattenChange,
  onGoToSign,
}: FormFillPdfPanelProps) {
  const [previewPage, setPreviewPage] = useState<number>(1);
  const baseId = useId();

  const formattedSize =
    fileSizeBytes > 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSizeBytes / 1024)} KB`;

  // Miniatura da página selecionada
  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);

  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] || (previewPage === 1 ? thumbnailUrl : undefined);

  const effectiveValues = Object.fromEntries(
    fields.map((field) => [field.name, values[field.name] ?? field.currentValue]),
  );

  const filledCount = fields.filter((f) => {
    const val = effectiveValues[f.name];
    if (f.type === "checkbox") return Boolean(val);
    return Array.isArray(val) ? val.length > 0 : typeof val === "string" && val.trim().length > 0;
  }).length;

  function handleFieldChange(name: string, value: FormFieldValue) {
    onValuesChange({
      ...effectiveValues,
      [name]: value,
    });
  }

  function handleClearAll() {
    const cleared: Record<string, FormFieldValue> = {};
    for (const f of fields) {
      if (f.isReadOnly) {
        cleared[f.name] = f.currentValue;
      } else if (f.multiSelect) {
        cleared[f.name] = [];
      } else if (f.type === "checkbox") {
        cleared[f.name] = false;
      } else {
        cleared[f.name] = "";
      }
    }
    onValuesChange(cleared);
  }

  function renderFieldTypeBadge(type: FormFieldDescriptor["type"]) {
    switch (type) {
      case "text":
        return <span className="form-fill-badge">{translate("formFill.typeText")}</span>;
      case "checkbox":
        return <span className="form-fill-badge">{translate("formFill.typeCheckbox")}</span>;
      case "dropdown":
        return <span className="form-fill-badge">{translate("formFill.typeDropdown")}</span>;
      case "radio":
        return <span className="form-fill-badge">{translate("formFill.typeRadio")}</span>;
      case "option-list":
        return <span className="form-fill-badge">{translate("formFill.typeOptionList")}</span>;
    }
  }

  return (
    <div className="form-fill-container">
      {/* Coluna Esquerda: Painel de Campos e Opções */}
      <div className="form-fill-controls-pane">
        <div className="form-fill-header-card">
          <div className="form-fill-file-info">
            <div className="form-fill-file-icon">
              <FileText size={22} color="#3b82f6" />
            </div>
            <div>
              <div className="form-fill-file-name" title={fileName}>
                {fileName}
              </div>
              <div className="form-fill-file-meta">
                {formattedSize} •{" "}
                {translate(totalPages === 1 ? "formFill.pageCount" : "formFill.pagesCount").replace(
                  "{count}",
                  String(totalPages),
                )}
              </div>
            </div>
          </div>

          {!isLoadingFields && fields.length > 0 && (
            <div className="form-fill-progress-tag">
              <CheckCircle2 size={14} color="#10b981" />
              <span>
                {translate("formFill.filledProgress")
                  .replace("{filled}", String(filledCount))
                  .replace("{total}", String(fields.length))}
              </span>
            </div>
          )}
        </div>

        {/* Opção de Flattening (Achatar) */}
        <div className="form-fill-options-box">
          <div className="form-fill-option-row">
            <label
              htmlFor={`${baseId}-flatten-toggle`}
              className="form-fill-option-label"
              style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <input
                id={`${baseId}-flatten-toggle`}
                type="checkbox"
                checked={flatten}
                onChange={(e) => onFlattenChange(e.target.checked)}
                className="form-fill-checkbox-input"
              />
              <span style={{ fontWeight: 600, color: "var(--color-ink)" }}>
                {translate("formFill.flattenLabel")}
              </span>
            </label>
            <div className="form-fill-option-hint">{translate("formFill.flattenHint")}</div>
          </div>
        </div>

        {/* Lista de Campos ou Estado Vazio */}
        {isLoadingFields ? (
          <div className="form-fill-loading-state">
            <Loader2 size={28} className="animate-spin" color="#3b82f6" />
            <p>{translate("formFill.loadingFields")}</p>
          </div>
        ) : fields.length === 0 ? (
          <div className="form-fill-empty-state">
            <div className="form-fill-empty-icon">
              <AlertCircle size={36} color="#f59e0b" />
            </div>
            <h3>{translate("formFill.noFieldsTitle")}</h3>
            <p>{translate("formFill.noFieldsDesc")}</p>
            {onGoToSign && (
              <button type="button" className="form-fill-goto-sign-btn" onClick={onGoToSign}>
                <PenTool size={16} />
                <span>{translate("formFill.goToSign")}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="form-fill-fields-section">
            <div className="form-fill-section-header">
              <div className="form-fill-section-title">
                <FormInput size={18} color="#3b82f6" />
                <span>{translate("formFill.optionsTitle")}</span>
                <span className="form-fill-count-pill">{fields.length}</span>
              </div>
              <button
                type="button"
                className="form-fill-clear-btn"
                onClick={handleClearAll}
                title={translate("formFill.clearTitle")}
              >
                <RotateCcw size={14} />
                <span>{translate("formFill.clearValues")}</span>
              </button>
            </div>

            <div className="form-fill-fields-list">
              {fields.map((field, idx) => {
                const fieldId = `${baseId}-field-${idx}`;
                const val = effectiveValues[field.name];

                return (
                  <div key={field.name} className="form-fill-field-card">
                    <div className="form-fill-field-header">
                      <label htmlFor={fieldId} className="form-fill-field-name">
                        {field.name}
                      </label>
                      <div className="form-fill-field-badges">
                        {renderFieldTypeBadge(field.type)}
                        {field.isReadOnly && (
                          <span className="form-fill-badge form-fill-badge--readonly">
                            {translate("formFill.readOnlyBadge")}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Inputs de acordo com o tipo */}
                    {field.type === "text" && (
                      <input
                        id={fieldId}
                        type="text"
                        className="form-fill-input-text"
                        value={typeof val === "string" ? val : ""}
                        onChange={(e) => handleFieldChange(field.name, e.target.value)}
                        disabled={field.isReadOnly}
                        placeholder={translate("formFill.fieldPlaceholder")}
                      />
                    )}

                    {field.type === "checkbox" && (
                      <label htmlFor={fieldId} className="form-fill-checkbox-container">
                        <input
                          id={fieldId}
                          type="checkbox"
                          className="form-fill-checkbox-input"
                          checked={Boolean(val)}
                          onChange={(e) => handleFieldChange(field.name, e.target.checked)}
                          disabled={field.isReadOnly}
                        />
                        <span className="form-fill-checkbox-text">
                          {translate(val ? "formFill.checked" : "formFill.unchecked")}
                        </span>
                      </label>
                    )}

                    {field.type === "dropdown" && field.isEditable && !field.multiSelect && (
                      <>
                        <input
                          id={fieldId}
                          list={`${fieldId}-options`}
                          className="form-fill-input-text"
                          value={typeof val === "string" ? val : ""}
                          onChange={(event) => handleFieldChange(field.name, event.target.value)}
                          disabled={field.isReadOnly}
                        />
                        <datalist id={`${fieldId}-options`}>
                          {field.options?.map((option) => (
                            <option key={option} value={option} />
                          ))}
                        </datalist>
                      </>
                    )}

                    {(field.type === "option-list" ||
                      (field.type === "dropdown" && (!field.isEditable || field.multiSelect))) && (
                      <select
                        id={fieldId}
                        className="form-fill-select"
                        multiple={field.multiSelect}
                        value={
                          field.multiSelect
                            ? Array.isArray(val)
                              ? val
                              : typeof val === "string" && val !== ""
                                ? [val]
                                : []
                            : typeof val === "string"
                              ? val
                              : ""
                        }
                        onChange={(event) =>
                          handleFieldChange(
                            field.name,
                            field.multiSelect
                              ? Array.from(event.target.selectedOptions, (option) => option.value)
                              : event.target.value,
                          )
                        }
                        disabled={field.isReadOnly}
                      >
                        {!field.multiSelect && (
                          <option value="">{translate("formFill.selectPlaceholder")}</option>
                        )}
                        {field.options?.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === "radio" && (
                      <div className="form-fill-radio-group">
                        {field.options?.map((opt) => {
                          const radioId = `${fieldId}-${opt}`;
                          return (
                            <label key={opt} htmlFor={radioId} className="form-fill-radio-label">
                              <input
                                id={radioId}
                                type="radio"
                                name={field.name}
                                value={opt}
                                checked={val === opt}
                                onChange={() => handleFieldChange(field.name, opt)}
                                disabled={field.isReadOnly}
                              />
                              <span>{opt}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Coluna Direita: Pré-visualização do Documento */}
      <div className="form-fill-preview-pane">
        <div className="form-fill-preview-header">
          <div className="form-fill-preview-title">
            <FileCheck2 size={16} color="#3b82f6" />
            <span>{translate("formFill.previewTitle")}</span>
          </div>

          {totalPages > 1 && (
            <div className="form-fill-preview-pagination">
              <button
                type="button"
                className="form-fill-page-nav-btn"
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                aria-label={translate("formFill.previousPage")}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="form-fill-page-indicator">
                {previewPage} / {totalPages}
              </span>
              <button
                type="button"
                className="form-fill-page-nav-btn"
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                disabled={previewPage >= totalPages}
                aria-label={translate("formFill.nextPage")}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="form-fill-preview-canvas-box">
          {activeThumbnail ? (
            <img
              src={activeThumbnail}
              alt={translate("formFill.previewPageAlt").replace("{page}", String(previewPage))}
              className="form-fill-preview-image"
            />
          ) : (
            <div className="form-fill-preview-placeholder">
              <FileText size={48} color="#64748b" />
              <span>{translate("formFill.pageLabel").replace("{page}", String(previewPage))}</span>
            </div>
          )}
        </div>

        <div className="form-fill-preview-footer-hint">
          <Info size={14} />
          <span>{translate("formFill.previewHint")}</span>
        </div>
      </div>

      {/* Estilos dedicados ao painel de preenchimento */}
      <style>{`
        .form-fill-container {
          display: grid;
          grid-template-columns: minmax(360px, 1.2fr) minmax(320px, 1fr);
          gap: 1.5rem;
          width: 100%;
          min-height: 540px;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .form-fill-container {
            grid-template-columns: 1fr;
          }
        }

        .form-fill-controls-pane {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .form-fill-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: var(--color-surface-raised);
          backdrop-filter: blur(8px);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          gap: 1rem;
        }

        .form-fill-file-info {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .form-fill-file-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(59, 130, 246, 0.12);
          border-radius: 10px;
          flex-shrink: 0;
        }

        .form-fill-file-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 240px;
        }

        .form-fill-file-meta {
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          margin-top: 2px;
        }

        .form-fill-progress-tag {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          background: rgba(16, 185, 129, 0.12);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 9999px;
          font-size: 0.8rem;
          color: #047857;
          font-weight: 500;
          white-space: nowrap;
        }

        .form-fill-options-box {
          padding: 1rem 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
        }

        .form-fill-option-row {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .form-fill-checkbox-input {
          width: 18px;
          height: 18px;
          accent-color: #2563eb;
          cursor: pointer;
        }

        .form-fill-option-hint {
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          margin-left: 1.6rem;
          line-height: 1.4;
        }

        .form-fill-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.75rem;
        }

        .form-fill-section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-ink);
        }

        .form-fill-count-pill {
          background: rgba(59, 130, 246, 0.15);
          color: #1d4ed8;
          padding: 0.1rem 0.45rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .form-fill-clear-btn {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          background: transparent;
          border: 1px solid var(--color-border);
          color: var(--color-ink-muted);
          border-radius: 6px;
          padding: 0.3rem 0.6rem;
          font-size: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .form-fill-clear-btn:hover {
          background: rgba(239, 68, 68, 0.12);
          border-color: rgba(239, 68, 68, 0.3);
          color: #b91c1c;
        }

        .form-fill-fields-list {
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
          max-height: 480px;
          overflow-y: auto;
          padding-right: 0.5rem;
        }

        .form-fill-field-card {
          padding: 0.85rem 1rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 10px;
          transition: border-color 0.2s ease;
        }

        .form-fill-field-card:focus-within {
          border-color: #3b82f6;
          box-shadow: 0 0 0 1px #3b82f6;
        }

        .form-fill-field-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.5rem;
          gap: 0.5rem;
        }

        .form-fill-field-name {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-ink);
          word-break: break-all;
        }

        .form-fill-field-badges {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          flex-shrink: 0;
        }

        .form-fill-badge {
          background: var(--color-surface-muted);
          color: var(--color-ink-muted);
          font-size: 0.7rem;
          padding: 0.15rem 0.4rem;
          border-radius: 4px;
          font-weight: 500;
        }

        .form-fill-badge--readonly {
          background: rgba(245, 158, 11, 0.15);
          color: #92400e;
        }

        .form-fill-input-text,
        .form-fill-select {
          width: 100%;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 6px;
          padding: 0.55rem 0.75rem;
          color: var(--color-ink);
          font-size: 0.85rem;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s ease;
        }

        .form-fill-input-text:focus,
        .form-fill-select:focus {
          border-color: #3b82f6;
        }

        .form-fill-checkbox-container {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          cursor: pointer;
        }

        .form-fill-checkbox-text {
          font-size: 0.85rem;
          color: var(--color-ink-muted);
        }

        .form-fill-radio-group {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem;
        }

        .form-fill-radio-label {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.85rem;
          color: var(--color-ink-muted);
          cursor: pointer;
        }

        .form-fill-loading-state,
        .form-fill-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 3rem 1.5rem;
          background: var(--color-surface-raised);
          border: 1px dashed var(--color-border);
          border-radius: 12px;
          gap: 0.75rem;
        }

        .form-fill-empty-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 60px;
          height: 60px;
          background: rgba(245, 158, 11, 0.1);
          border-radius: 50%;
        }

        .form-fill-empty-state h3 {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0;
        }

        .form-fill-empty-state p {
          font-size: 0.85rem;
          color: var(--color-ink-muted);
          max-width: 320px;
          margin: 0;
          line-height: 1.4;
        }

        .form-fill-goto-sign-btn {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: #059669;
          color: #ffffff;
          border: none;
          border-radius: 8px;
          padding: 0.6rem 1rem;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 0.5rem;
          transition: background 0.2s ease;
        }

        .form-fill-goto-sign-btn:hover {
          background: #047857;
        }

        /* Coluna Direita: Pré-visualização */
        .form-fill-preview-pane {
          display: flex;
          flex-direction: column;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 1.25rem;
          gap: 1rem;
        }

        .form-fill-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .form-fill-preview-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-ink);
        }

        .form-fill-preview-pagination {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .form-fill-page-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--color-surface-muted);
          border: none;
          border-radius: 6px;
          color: var(--color-ink);
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .form-fill-page-nav-btn:hover:not(:disabled) {
          background: var(--color-surface-muted);
        }

        .form-fill-page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .form-fill-page-indicator {
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          min-width: 44px;
          text-align: center;
        }

        .form-fill-preview-canvas-box {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 1rem;
          min-height: 420px;
        }

        .form-fill-preview-image {
          max-width: 100%;
          max-height: 520px;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .form-fill-preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.75rem;
          color: var(--color-ink-muted);
          font-size: 0.85rem;
        }

        .form-fill-preview-footer-hint {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
        }
      `}</style>
    </div>
  );
}
