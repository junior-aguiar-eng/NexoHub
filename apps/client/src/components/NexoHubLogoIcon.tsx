export interface NexoHubLogoIconProps {
  readonly size?: number;
  readonly className?: string;
  readonly zone?: "pdf" | "img";
}

export function NexoHubLogoIcon({ size = 34, className = "", zone = "pdf" }: NexoHubLogoIconProps) {
  const accentColor = zone === "img" ? "#2563eb" : "#e11d48";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 34 34"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 rounded-[8px] overflow-hidden ${className}`}
      aria-hidden="true"
    >
      {/* Background container */}
      <rect width="34" height="34" rx="8" fill="#0f172a" />

      {/* Left vertical stem (White) */}
      <rect x="7" y="7" width="5.5" height="20" rx="1.5" fill="#ffffff" />

      {/* Diagonal stem (White) */}
      <path
        d="M8 8L24.5 25.5C25.5 26.5 27 25.8 27 24.5V23L10.5 7H8V8Z"
        fill="#ffffff"
        opacity="0.95"
      />

      {/* Right vertical stem (Dynamic: Red in PDF, Blue in Imagem) */}
      <rect
        x="21.5"
        y="7"
        width="5.5"
        height="20"
        rx="1.5"
        fill={accentColor}
        className="transition-colors duration-300"
      />
    </svg>
  );
}
