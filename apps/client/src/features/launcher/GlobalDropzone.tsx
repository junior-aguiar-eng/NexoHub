import {
  FileDigit,
  FileLock2,
  FileSearch,
  FileStack,
  FileText,
  Images,
  Scissors,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { translate } from "@/i18n";

export interface GlobalDropzoneProps {
  onSelectToolWithFiles: (toolId: string, files: File[]) => void;
}

export const GlobalDropzone: React.FC<GlobalDropzoneProps> = ({ onSelectToolWithFiles }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[] | null>(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    function handleDragEnter(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current += 1;
        setIsDragging(true);
      }
    }

    function handleDragLeave(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        dragCounter.current = Math.max(0, dragCounter.current - 1);
        if (dragCounter.current === 0) {
          setIsDragging(false);
        }
      }
    }

    function handleDragOver(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) {
        e.preventDefault();
      }
    }

    function handleDrop(e: DragEvent) {
      if (!e.dataTransfer?.types?.includes("Files")) return;
      e.preventDefault();
      dragCounter.current = 0;
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files || []);
      if (files.length === 0) return;

      const allPdf = files.every(
        (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
      );
      const allImages = files.every(
        (f) =>
          f.type.startsWith("image/") ||
          /\.(jpe?g|png|webp|avif|bmp|tiff?)$/i.test(f.name.toLowerCase()),
      );

      if (allPdf && files.length > 1) {
        onSelectToolWithFiles("pdf-merge", files);
        return;
      }

      if (allImages && files.length > 1) {
        onSelectToolWithFiles("images-to-pdf", files);
        return;
      }

      // 1 arquivo ou conjunto para seleção rápida
      setPendingFiles(files);
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        dragCounter.current = 0;
        setIsDragging(false);
        setPendingFiles(null);
      }
    }

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onSelectToolWithFiles]);

  if (!isDragging && !pendingFiles) return null;

  const handleSelectTool = (toolId: string) => {
    if (!pendingFiles) return;
    const files = pendingFiles;
    setPendingFiles(null);
    onSelectToolWithFiles(toolId, files);
  };

  const isPdf =
    pendingFiles?.[0]?.type === "application/pdf" ||
    pendingFiles?.[0]?.name.toLowerCase().endsWith(".pdf");

  return (
    <>
      {isDragging && (
        <div
          className="global-dropzone-overlay"
          role="dialog"
          aria-modal="true"
          aria-label={translate("globalDrop.overlayTitle")}
        >
          <div className="global-dropzone-content">
            <UploadCloud size={64} className="global-dropzone-icon" />
            <h2 className="global-dropzone-title">{translate("globalDrop.overlayTitle")}</h2>
            <p className="global-dropzone-subtitle">{translate("globalDrop.overlaySubtitle")}</p>
          </div>
        </div>
      )}

      {pendingFiles && (
        <div
          className="global-dropzone-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-drop-action-title"
        >
          <div className="global-dropzone-modal">
            <div className="global-dropzone-modal__header">
              <div>
                <h3 id="global-drop-action-title" className="global-dropzone-modal__title">
                  {translate("globalDrop.chooseAction")}
                </h3>
                <p className="global-dropzone-modal__subtitle">
                  {pendingFiles[0]?.name} • {translate("globalDrop.chooseActionSubtitle")}
                </p>
              </div>
              <button
                type="button"
                className="global-dropzone-modal__close"
                onClick={() => setPendingFiles(null)}
                aria-label={translate("globalDrop.cancel")}
              >
                <X size={20} />
              </button>
            </div>

            <div className="global-dropzone-modal__grid">
              {isPdf ? (
                <>
                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-compress")}
                  >
                    <Zap size={22} className="global-dropzone-action-icon text-amber-500" />
                    <span>{translate("globalDrop.quickCompress")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-split")}
                  >
                    <Scissors size={22} className="global-dropzone-action-icon text-blue-500" />
                    <span>{translate("globalDrop.quickSplit")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-ocr")}
                  >
                    <FileSearch
                      size={22}
                      className="global-dropzone-action-icon text-emerald-500"
                    />
                    <span>{translate("globalDrop.quickOcr")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-to-word")}
                  >
                    <FileText size={22} className="global-dropzone-action-icon text-indigo-500" />
                    <span>{translate("globalDrop.quickPdfToWord")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-protect")}
                  >
                    <FileLock2 size={22} className="global-dropzone-action-icon text-rose-500" />
                    <span>{translate("globalDrop.quickProtect")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-page-numbers")}
                  >
                    <FileDigit size={22} className="global-dropzone-action-icon text-cyan-500" />
                    <span>{translate("globalDrop.quickPageNumbers")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("pdf-organize")}
                  >
                    <FileStack size={22} className="global-dropzone-action-icon text-purple-500" />
                    <span>{translate("globalDrop.quickOrganize")}</span>
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("images-to-pdf")}
                  >
                    <Images size={22} className="global-dropzone-action-icon text-blue-500" />
                    <span>{translate("globalDrop.quickImagesToPdf")}</span>
                  </button>

                  <button
                    type="button"
                    className="global-dropzone-action-btn"
                    onClick={() => handleSelectTool("image-compress")}
                  >
                    <Zap size={22} className="global-dropzone-action-icon text-amber-500" />
                    <span>{translate("globalDrop.quickCompressImage")}</span>
                  </button>
                </>
              )}
            </div>

            <div className="global-dropzone-modal__footer">
              <button
                type="button"
                className="global-dropzone-cancel-btn"
                onClick={() => setPendingFiles(null)}
              >
                {translate("globalDrop.cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
