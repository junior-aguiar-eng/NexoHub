import { translate } from "@/i18n";

type JusticeFlowCardProps = {
  onOpenStudio?: () => void;
};

export function JusticeFlowCard({ onOpenStudio }: JusticeFlowCardProps) {
  return (
    <button
      type="button"
      className="justice-flow-card"
      onClick={onOpenStudio}
      aria-label={`${translate("tools.flowCta.title")} - ${translate("tools.flowCta.description")}`}
    >
      <div className="justice-flow-card__copy">
        <p className="eyebrow justice-flow-card__eyebrow">{translate("tools.flowCta.eyebrow")}</p>
        <h3 className="justice-flow-card__title">{translate("tools.flowCta.title")}</h3>
        <p className="justice-flow-card__desc">{translate("tools.flowCta.description")}</p>
      </div>

      <div className="justice-flow-card__visual" aria-hidden="true">
        <svg
          viewBox="0 0 160 140"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="justice-scales-svg"
          role="img"
          aria-labelledby="scales-title"
        >
          <title id="scales-title">Balança da Justiça</title>
          <defs>
            <linearGradient id="goldGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#DFC386" />
              <stop offset="50%" stopColor="#B38A38" />
              <stop offset="100%" stopColor="#7E5C1B" />
            </linearGradient>
            <linearGradient id="goldGrad2" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#F9E8B2" />
              <stop offset="60%" stopColor="#C99F44" />
              <stop offset="100%" stopColor="#8C661D" />
            </linearGradient>
            <filter id="goldGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow
                dx="0"
                dy="2"
                stdDeviation="2"
                floodColor="#3B2A06"
                floodOpacity="0.18"
              />
            </filter>
          </defs>

          {/* Base Pedestal */}
          <path
            d="M54 124 L106 124 C108 124 109 125 109 127 L109 132 L51 132 L51 127 C51 125 52 124 54 124 Z"
            fill="url(#goldGrad1)"
            filter="url(#goldGlow)"
          />
          <rect x="62" y="119" width="36" height="5" rx="1.5" fill="url(#goldGrad2)" />
          <path d="M73 119 L76 34 L84 34 L87 119 Z" fill="url(#goldGrad1)" />

          {/* Column Rings & Finial */}
          <rect x="73" y="68" width="14" height="4" rx="1" fill="url(#goldGrad2)" />
          <circle cx="80" cy="30" r="7" fill="url(#goldGrad2)" filter="url(#goldGlow)" />
          <circle cx="80" cy="18" r="4" fill="url(#goldGrad1)" />
          <polygon points="80,10 83,16 77,16" fill="url(#goldGrad2)" />

          {/* Cross Beam */}
          <path
            d="M22 36 Q80 32 138 36"
            stroke="url(#goldGrad1)"
            strokeWidth="4.5"
            strokeLinecap="round"
          />
          <circle cx="22" cy="36" r="3" fill="url(#goldGrad2)" />
          <circle cx="138" cy="36" r="3" fill="url(#goldGrad2)" />

          {/* Left Pan & Chains */}
          <line x1="22" y1="37" x2="8" y2="76" stroke="#AA8230" strokeWidth="1.2" />
          <line x1="22" y1="37" x2="36" y2="76" stroke="#AA8230" strokeWidth="1.2" />
          <path d="M6 76 Q22 92 38 76 Z" fill="url(#goldGrad2)" filter="url(#goldGlow)" />
          <ellipse cx="22" cy="76" rx="16" ry="3.5" fill="url(#goldGrad1)" />

          {/* Right Pan & Chains */}
          <line x1="138" y1="37" x2="124" y2="76" stroke="#AA8230" strokeWidth="1.2" />
          <line x1="138" y1="37" x2="152" y2="76" stroke="#AA8230" strokeWidth="1.2" />
          <path d="M122 76 Q138 92 154 76 Z" fill="url(#goldGrad2)" filter="url(#goldGlow)" />
          <ellipse cx="138" cy="76" rx="16" ry="3.5" fill="url(#goldGrad1)" />
        </svg>
      </div>
    </button>
  );
}
