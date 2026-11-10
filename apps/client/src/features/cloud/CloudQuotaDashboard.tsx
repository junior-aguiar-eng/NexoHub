import type { CloudBalance, CloudUsage } from "@nexohub/contracts";
import { FileScan, FileSpreadsheet, Languages } from "lucide-react";
import { translate as t } from "@/i18n";

export interface CloudQuotaDashboardProps {
  readonly usage: CloudUsage | null;
  readonly processingEnabled?: boolean;
}

function calculatePercent(balance: CloudBalance): number {
  const total = balance.used + balance.remaining;
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((balance.used / total) * 100)));
}

interface QuotaCardProps {
  readonly title: string;
  readonly balance: CloudBalance;
  readonly icon: React.ReactNode;
  readonly unitLabel: string;
}

function QuotaCard({ title, balance, icon, unitLabel }: QuotaCardProps) {
  const percent = calculatePercent(balance);
  const total = balance.used + balance.remaining;

  return (
    <article className="cloud-quota-card">
      <div className="cloud-quota-card__header">
        <span className="cloud-quota-card__icon" aria-hidden="true">
          {icon}
        </span>
        <h3 className="cloud-quota-card__title">{title}</h3>
      </div>
      <div className="cloud-quota-card__body">
        <div className="cloud-quota-card__metric">
          <strong className="cloud-quota-card__remaining">
            {balance.remaining.toLocaleString("pt-BR")} {unitLabel} restantes
          </strong>
        </div>
        <div
          role="progressbar"
          aria-label={title}
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          className="cloud-quota-progress"
        >
          <div className="cloud-quota-progress__bar" style={{ width: `${percent}%` }} />
        </div>
        <p className="cloud-quota-card__subtext">
          {balance.used.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} usados
        </p>
      </div>
    </article>
  );
}

export function CloudQuotaDashboard({ usage, processingEnabled }: CloudQuotaDashboardProps) {
  if (!usage) {
    return (
      <section className="cloud-account-card cloud-quota-section" aria-labelledby="conta-cotas">
        <h2 id="conta-cotas">{t("account.page.quotasTitle")}</h2>
        <p role="status">
          {t(processingEnabled ? "account.page.quotasUnavailable" : "account.page.quotasPilot")}
        </p>
      </section>
    );
  }

  const resetDate = new Date(usage.resetAt);
  const formattedReset = Number.isNaN(resetDate.getTime())
    ? usage.resetAt
    : resetDate.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

  return (
    <section className="cloud-account-card cloud-quota-section" aria-labelledby="conta-cotas">
      <div className="cloud-quota-section__header">
        <div>
          <h2 id="conta-cotas">{t("account.page.quotasTitle")}</h2>
          <p>{t("account.page.quotasSubtitle")}</p>
        </div>
        <span className="cloud-quota-badge">
          {t("account.page.renewsOn").replace("{date}", formattedReset)}
        </span>
      </div>

      <div className="cloud-quota-grid">
        <QuotaCard
          title={t("account.page.ocrQuota")}
          balance={usage.ocrPages}
          icon={<FileScan size={18} />}
          unitLabel="páginas"
        />
        <QuotaCard
          title={t("account.page.translationQuota")}
          balance={usage.translationCharacters}
          icon={<Languages size={18} />}
          unitLabel="caracteres"
        />
        <QuotaCard
          title={t("account.page.officeQuota")}
          balance={usage.officeFiles}
          icon={<FileSpreadsheet size={18} />}
          unitLabel="arquivos"
        />
      </div>
    </section>
  );
}
