import type { ProcessingMode } from "@nexohub/contracts";
import { Cloud, Lock, ShieldCheck, Zap } from "lucide-react";
import type React from "react";
import { translate } from "@/i18n";

export interface CloudProcessingChoiceProps {
  toolId: string;
  mode: ProcessingMode;
  onChangeMode: (mode: ProcessingMode) => void;
  quotaRemaining?: number;
  quotaUnitLabel?: string;
  isAuthenticated: boolean;
  disabled?: boolean;
}

export const CloudProcessingChoice: React.FC<CloudProcessingChoiceProps> = ({
  mode,
  onChangeMode,
  quotaRemaining,
  quotaUnitLabel,
  isAuthenticated,
  disabled = false,
}) => {
  return (
    <section className="cloud-choice-card" aria-labelledby="cloud-choice-title">
      <div className="cloud-choice-header">
        <h4 id="cloud-choice-title" className="cloud-choice-title">
          {translate("cloudProcessing.choiceTitle")}
        </h4>
        <p className="cloud-choice-subtitle">{translate("cloudProcessing.choiceSubtitle")}</p>
      </div>

      <div
        className="cloud-choice-options"
        role="radiogroup"
        aria-label={translate("cloudProcessing.choiceTitle")}
      >
        <label
          className={`cloud-choice-option ${mode === "local" ? "cloud-choice-option--active" : ""}`}
        >
          <input
            type="radio"
            name="processing-mode-choice"
            value="local"
            checked={mode === "local"}
            onChange={() => onChangeMode("local")}
            disabled={disabled}
            className="cloud-choice-radio"
          />
          <div className="cloud-choice-option-content">
            <div className="cloud-choice-option-heading">
              <ShieldCheck size={18} className="cloud-choice-icon cloud-choice-icon--local" />
              <span className="cloud-choice-option-name">
                {translate("cloudProcessing.modeLocal")}
              </span>
            </div>
            <p className="cloud-choice-option-desc">{translate("cloudProcessing.modeLocalDesc")}</p>
          </div>
        </label>

        <label
          className={`cloud-choice-option ${mode === "cloud" ? "cloud-choice-option--active" : ""}`}
        >
          <input
            type="radio"
            name="processing-mode-choice"
            value="cloud"
            checked={mode === "cloud"}
            onChange={() => onChangeMode("cloud")}
            disabled={disabled}
            className="cloud-choice-radio"
          />
          <div className="cloud-choice-option-content">
            <div className="cloud-choice-option-heading">
              <Zap size={18} className="cloud-choice-icon cloud-choice-icon--cloud" />
              <span className="cloud-choice-option-name">
                {translate("cloudProcessing.modeCloud")}
              </span>
              {quotaRemaining !== undefined && (
                <span className="cloud-choice-badge">
                  {translate("cloudProcessing.quotaAvailable")
                    .replace("{count}", String(quotaRemaining))
                    .replace("{unit}", quotaUnitLabel ?? "")}
                </span>
              )}
            </div>
            <p className="cloud-choice-option-desc">{translate("cloudProcessing.modeCloudDesc")}</p>
          </div>
        </label>
      </div>

      {mode === "cloud" && (
        <div className="cloud-choice-footer">
          {isAuthenticated ? (
            <div className="cloud-choice-privacy" role="status">
              <Lock size={14} className="cloud-choice-privacy-icon" />
              <span>{translate("cloudProcessing.privacyGuarantee")}</span>
            </div>
          ) : (
            <div className="cloud-choice-login" role="alert">
              <Cloud size={14} className="cloud-choice-login-icon" />
              <span>{translate("cloudProcessing.loginRequired")}</span>
              <a href="/hub/cloud/login" className="cloud-choice-login-link">
                {translate("cloudProcessing.loginAction")}
              </a>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
