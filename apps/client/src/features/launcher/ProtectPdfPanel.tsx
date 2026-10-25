import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Unlock,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";
import type { PdfProtectionStatus } from "@/platform/pdf-engine";

export interface ProtectPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly protectionStatus?: PdfProtectionStatus;
  readonly passwordValue: string;
  readonly onPasswordChange: (password: string) => void;
  readonly confirmPasswordValue: string;
  readonly onConfirmPasswordChange: (password: string) => void;
  readonly algorithm: "AES-256" | "RC4";
  readonly onAlgorithmChange: (algorithm: "AES-256" | "RC4") => void;
  readonly allowPrinting: boolean;
  readonly onAllowPrintingChange: (allow: boolean) => void;
  readonly allowCopying: boolean;
  readonly onAllowCopyingChange: (allow: boolean) => void;
  readonly allowModifying: boolean;
  readonly onAllowModifyingChange: (allow: boolean) => void;
  readonly allowAnnotating: boolean;
  readonly onAllowAnnotatingChange: (allow: boolean) => void;
  readonly allowFillingForms: boolean;
  readonly onAllowFillingFormsChange: (allow: boolean) => void;
  readonly onGoToUnlock?: () => void;
}

export function ProtectPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  protectionStatus,
  passwordValue,
  onPasswordChange,
  confirmPasswordValue,
  onConfirmPasswordChange,
  algorithm,
  onAlgorithmChange,
  allowPrinting,
  onAllowPrintingChange,
  allowCopying,
  onAllowCopyingChange,
  allowModifying,
  onAllowModifyingChange,
  allowAnnotating,
  onAllowAnnotatingChange,
  allowFillingForms,
  onAllowFillingFormsChange,
  onGoToUnlock,
}: ProtectPdfPanelProps) {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const passId = useId();
  const confirmPassId = useId();

  const formattedSize =
    fileSizeBytes > 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSizeBytes / 1024)} KB`;

  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);

  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] ?? (previewPage === 1 ? thumbnailUrl : undefined);

  const isMismatch = confirmPasswordValue.length > 0 && passwordValue !== confirmPasswordValue;

  const isProtected = Boolean(protectionStatus?.isProtected);

  // Força da senha calculada
  const computeStrength = (pass: string) => {
    if (!pass) return { score: 0, label: "", color: "#94a3b8" };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 10) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1)
      return {
        score: 1,
        label: translate("protect.strengthWeak"),
        color: "#f43f5e",
      };
    if (score <= 3)
      return {
        score: 2,
        label: translate("protect.strengthMedium"),
        color: "#f59e0b",
      };
    return {
      score: 3,
      label: translate("protect.strengthStrong"),
      color: "#10b981",
    };
  };

  const strength = computeStrength(passwordValue);

  return (
    <div className="protect-container" data-workspace-panel>
      {/* Coluna Esquerda: Configurações de Criptografia e Permissões */}
      <div className="protect-controls-pane" data-workspace-part="options">
        <div className="protect-header-card">
          <div className="protect-file-info">
            <div className="protect-file-icon">
              {isProtected ? (
                <ShieldAlert size={22} color="#f43f5e" />
              ) : (
                <ShieldCheck size={22} color="#10b981" />
              )}
            </div>
            <div>
              <div className="protect-file-name" title={fileName}>
                {fileName}
              </div>
              <div className="protect-file-meta">
                <span>{formattedSize}</span>
                <span>•</span>
                <span>
                  {totalPages}{" "}
                  {translate(totalPages === 1 ? "unlock.pageSingular" : "unlock.pagePlural")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Alerta se o arquivo já estiver protegido */}
        {isProtected && (
          <div className="protect-alert-already">
            <div className="protect-alert-content">
              <div className="protect-alert-title">
                <AlertCircle size={18} />
                <span>{translate("protect.alreadyProtectedTitle")}</span>
              </div>
              <p className="protect-alert-desc">{translate("protect.alreadyProtectedDesc")}</p>
              {onGoToUnlock && (
                <button type="button" className="protect-btn-unlock" onClick={onGoToUnlock}>
                  <Unlock size={14} />
                  <span>{translate("protect.goToUnlock")}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Seção de Senha */}
        <div className="protect-section-card">
          <div className="protect-section-title">
            <KeyRound size={16} />
            <label htmlFor={passId}>{translate("protect.passwordLabel")}</label>
          </div>

          <div className="protect-input-group">
            <div className="protect-input-wrapper">
              <input
                id={passId}
                type={showPassword ? "text" : "password"}
                className="protect-input"
                placeholder={translate("protect.passwordPlaceholder")}
                value={passwordValue}
                onChange={(e) => onPasswordChange(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="protect-toggle-eye"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? translate("protect.hidePassword")
                    : translate("protect.showPassword")
                }
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {/* Barra de Força da Senha */}
            {passwordValue.length > 0 && (
              <div className="protect-strength-bar-container">
                <div className="protect-strength-track">
                  <div
                    className="protect-strength-fill"
                    style={{
                      width: `${(strength.score / 3) * 100}%`,
                      backgroundColor: strength.color,
                    }}
                  />
                </div>
                <span className="protect-strength-label" style={{ color: strength.color }}>
                  {strength.label}
                </span>
              </div>
            )}
          </div>

          <div className="protect-input-group" style={{ marginTop: "1rem" }}>
            <label htmlFor={confirmPassId} className="protect-field-label">
              {translate("protect.confirmPasswordLabel")}
            </label>
            <div className="protect-input-wrapper">
              <input
                id={confirmPassId}
                type={showConfirmPassword ? "text" : "password"}
                className={`protect-input ${isMismatch ? "protect-input-error" : ""}`}
                aria-invalid={isMismatch}
                aria-describedby={isMismatch ? `${confirmPassId}-error` : undefined}
                placeholder={translate("protect.confirmPasswordPlaceholder")}
                value={confirmPasswordValue}
                onChange={(e) => onConfirmPasswordChange(e.target.value)}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="protect-toggle-eye"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                aria-label={
                  showConfirmPassword
                    ? translate("protect.hidePassword")
                    : translate("protect.showPassword")
                }
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {isMismatch && (
              <div id={`${confirmPassId}-error`} className="protect-error-text" role="status">
                <AlertCircle size={14} />
                <span>{translate("protect.passwordMismatch")}</span>
              </div>
            )}
          </div>
        </div>

        {/* Padrão de Criptografia */}
        <div className="protect-section-card">
          <div className="protect-section-title">
            <Lock size={16} />
            <span>{translate("protect.encryptionStandard")}</span>
          </div>

          <div className="protect-algo-options">
            <label className={`protect-algo-option ${algorithm === "AES-256" ? "selected" : ""}`}>
              <input
                type="radio"
                name="algorithm"
                value="AES-256"
                checked={algorithm === "AES-256"}
                onChange={() => onAlgorithmChange("AES-256")}
              />
              <div>
                <div className="protect-algo-title">AES-256</div>
                <div className="protect-algo-desc">{translate("protect.algoAes256")}</div>
              </div>
            </label>

            <label className={`protect-algo-option ${algorithm === "RC4" ? "selected" : ""}`}>
              <input
                type="radio"
                name="algorithm"
                value="RC4"
                checked={algorithm === "RC4"}
                onChange={() => onAlgorithmChange("RC4")}
              />
              <div>
                <div className="protect-algo-title">RC4 128-bit</div>
                <div className="protect-algo-desc">{translate("protect.algoRc4")}</div>
              </div>
            </label>
          </div>
        </div>

        {/* Permissões de Uso */}
        <div className="protect-section-card">
          <div className="protect-section-title">
            <Shield size={16} />
            <span>{translate("protect.permissionsTitle")}</span>
          </div>

          <div className="protect-permissions-list">
            <label className="protect-checkbox-row">
              <input
                type="checkbox"
                checked={allowPrinting}
                onChange={(e) => onAllowPrintingChange(e.target.checked)}
              />
              <span>{translate("protect.allowPrinting")}</span>
            </label>

            <label className="protect-checkbox-row">
              <input
                type="checkbox"
                checked={allowCopying}
                onChange={(e) => onAllowCopyingChange(e.target.checked)}
              />
              <span>{translate("protect.allowCopying")}</span>
            </label>

            <label className="protect-checkbox-row">
              <input
                type="checkbox"
                checked={allowModifying}
                onChange={(e) => onAllowModifyingChange(e.target.checked)}
              />
              <span>{translate("protect.allowModifying")}</span>
            </label>

            <label className="protect-checkbox-row">
              <input
                type="checkbox"
                checked={allowAnnotating}
                onChange={(e) => onAllowAnnotatingChange(e.target.checked)}
              />
              <span>{translate("protect.allowAnnotating")}</span>
            </label>

            <label className="protect-checkbox-row">
              <input
                type="checkbox"
                checked={allowFillingForms}
                onChange={(e) => onAllowFillingFormsChange(e.target.checked)}
              />
              <span>{translate("protect.allowFillingForms")}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Coluna Direita: Pré-visualização do PDF */}
      <div className="protect-preview-pane" data-workspace-part="document">
        <div className="protect-preview-card">
          <div className="protect-preview-header">
            <span className="protect-preview-title">{translate("formFill.previewTitle")}</span>
            {totalPages > 1 && (
              <div className="protect-page-nav">
                <button
                  type="button"
                  className="protect-nav-btn"
                  disabled={previewPage <= 1}
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  aria-label={translate("unlock.previousPage")}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="protect-page-counter">
                  {previewPage} / {totalPages}
                </span>
                <button
                  type="button"
                  className="protect-nav-btn"
                  disabled={previewPage >= totalPages}
                  onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                  aria-label={translate("unlock.nextPage")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            )}
          </div>

          <div className="protect-thumbnail-canvas">
            {activeThumbnail ? (
              <div className="protect-thumb-wrapper">
                <img
                  src={activeThumbnail}
                  alt={translate("unlock.previewAlt").replace("{page}", String(previewPage))}
                  className="protect-thumb-img"
                />
                <div className="protect-watermark-overlay">
                  <div className="protect-badge-overlay">
                    <Shield size={16} />
                    <span>
                      {translate("protect.encryptionPreview").replace("{algorithm}", algorithm)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="protect-no-thumb">
                <Lock size={48} color="#94a3b8" />
                <span style={{ marginTop: "0.5rem" }}>
                  {translate("common.previewUnavailable")}
                </span>
              </div>
            )}
          </div>

          <div className="protect-preview-footer">
            <span className="protect-footer-hint">{translate("protect.successNotice")}</span>
          </div>
        </div>
      </div>

      <style>{`
        .protect-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1.5rem;
          width: 100%;
          align-items: start;
        }
        @media (max-width: 900px) {
          .protect-container {
            grid-template-columns: 1fr;
          }
        }
        .protect-controls-pane {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }
        .protect-header-card {
          padding: 1rem 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
        }
        .protect-file-info {
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }
        .protect-file-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 42px;
          height: 42px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--color-border);
        }
        .protect-file-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-ink);
          word-break: break-all;
        }
        .protect-file-meta {
          display: flex;
          gap: 0.5rem;
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          margin-top: 2px;
        }
        .protect-alert-already {
          padding: 1rem 1.25rem;
          border-radius: 12px;
          background: rgba(244, 63, 94, 0.08);
          border: 1px solid rgba(244, 63, 94, 0.25);
        }
        .protect-alert-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #f43f5e;
          font-weight: 600;
          font-size: 0.9rem;
        }
        .protect-alert-desc {
          margin: 0.4rem 0 0.8rem 0;
          font-size: 0.85rem;
          color: var(--color-ink);
          line-height: 1.4;
        }
        .protect-btn-unlock {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          padding: 0.4rem 0.85rem;
          background: #f43f5e;
          color: #ffffff;
          font-size: 0.8rem;
          font-weight: 600;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .protect-btn-unlock:hover {
          background: #e11d48;
        }
        .protect-section-card {
          padding: 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }
        .protect-section-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .protect-field-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 500;
          color: var(--color-ink-muted);
          margin-bottom: 0.35rem;
        }
        .protect-input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .protect-input {
          width: 100%;
          padding: 0.65rem 2.5rem 0.65rem 0.85rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          color: var(--color-ink);
          font-size: 0.9rem;
          transition: border-color 0.2s, box-shadow 0.2s;
        }
        .protect-input:focus {
          outline: none;
          border-color: #0369a1;
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.2);
        }
        .protect-input-error {
          border-color: #f43f5e !important;
        }
        .protect-toggle-eye {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: var(--color-ink-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 4px;
        }
        .protect-toggle-eye:hover {
          color: var(--color-ink);
        }
        .protect-strength-bar-container {
          margin-top: 0.4rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .protect-strength-track {
          flex: 1;
          height: 4px;
          background: var(--color-surface-muted);
          border-radius: 2px;
          overflow: hidden;
        }
        .protect-strength-fill {
          height: 100%;
          transition: width 0.3s ease, background-color 0.3s ease;
        }
        .protect-strength-label {
          font-size: 0.75rem;
          font-weight: 500;
        }
        .protect-error-text {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          color: #f43f5e;
          font-size: 0.75rem;
          margin-top: 0.35rem;
        }
        .protect-algo-options {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .protect-algo-option {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          padding: 0.75rem 0.85rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
        }
        .protect-algo-option.selected {
          border-color: #0369a1;
          background: rgba(56, 189, 248, 0.08);
        }
        .protect-algo-title {
          font-weight: 600;
          font-size: 0.85rem;
          color: var(--color-ink);
        }
        .protect-algo-desc {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          margin-top: 2px;
        }
        .protect-permissions-list {
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .protect-checkbox-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.85rem;
          color: var(--color-ink);
          cursor: pointer;
        }
        .protect-checkbox-row input[type="checkbox"] {
          accent-color: #0369a1;
          width: 16px;
          height: 16px;
          cursor: pointer;
        }
        .protect-preview-pane {
          position: sticky;
          top: 1.5rem;
        }
        .protect-preview-card {
          padding: 1.25rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .protect-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .protect-preview-title {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-ink);
        }
        .protect-page-nav {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .protect-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 26px;
          height: 26px;
          border-radius: 6px;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          color: var(--color-ink);
          cursor: pointer;
        }
        .protect-nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }
        .protect-page-counter {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          min-width: 48px;
          text-align: center;
        }
        .protect-thumbnail-canvas {
          background: var(--color-surface-muted);
          border-radius: 8px;
          padding: 1rem;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 380px;
          position: relative;
        }
        .protect-thumb-wrapper {
          position: relative;
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          border-radius: 4px;
          overflow: hidden;
          max-height: 480px;
        }
        .protect-thumb-img {
          display: block;
          max-width: 100%;
          max-height: 480px;
          object-fit: contain;
        }
        .protect-watermark-overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(15, 23, 42, 0.25);
        }
        .protect-badge-overlay {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 0.85rem;
          background: var(--color-surface-raised);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(56, 189, 248, 0.4);
          border-radius: 20px;
          color: #0369a1;
          font-size: 0.8rem;
          font-weight: 600;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        }
        .protect-no-thumb {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          color: #64748b;
          font-size: 0.85rem;
        }
        .protect-preview-footer {
          padding-top: 0.5rem;
          border-top: 1px solid var(--color-border);
          text-align: center;
        }
        .protect-footer-hint {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
        }
      `}</style>
    </div>
  );
}
