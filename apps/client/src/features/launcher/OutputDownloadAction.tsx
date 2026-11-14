import type React from "react";

export interface OutputDownloadActionProps {
  readonly className?: string;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  readonly onSaveOutput?: () => void;
  readonly children: React.ReactNode;
}

/**
 * Unifica o gatilho de download entre ambiente Web (<a download>) e Desktop Tauri (onSaveOutput).
 */
export function OutputDownloadAction({
  className,
  downloadUrl,
  outputFileName,
  onSaveOutput,
  children,
}: OutputDownloadActionProps) {
  if (onSaveOutput) {
    return (
      <button type="button" className={className} onClick={onSaveOutput}>
        {children}
      </button>
    );
  }
  if (!downloadUrl) return null;
  return (
    <a href={downloadUrl} download={outputFileName} className={className}>
      {children}
    </a>
  );
}
