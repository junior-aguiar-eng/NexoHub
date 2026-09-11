import { FilePlus2, FileText, UploadCloud } from "lucide-react";
import { type DragEvent, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

type OperationalDropzoneProps = {
  onOpenStudio: () => void;
  onFileImport?: (file: File) => void;
};

export function OperationalDropzone({ onOpenStudio, onFileImport }: OperationalDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      onFileImport?.(file);
      onOpenStudio();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      onFileImport?.(file);
      onOpenStudio();
    }
  }

  return (
    <div className="operational-dropzone-card">
      <section
        className={`operational-dropzone ${isDragging ? "operational-dropzone--active" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label={translate("hero.dropzoneTitle")}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="visually-hidden"
          accept=".pdf,.docx,.txt,.md,.json,image/*"
          onChange={handleFileSelect}
          aria-label="Selecionar arquivo para dossiê"
        />
        <div className="operational-dropzone__icon-circle" aria-hidden="true">
          <UploadCloud size={28} className="operational-dropzone__icon" />
        </div>
        <div className="operational-dropzone__content">
          <strong className="operational-dropzone__title">{translate("hero.dropzoneTitle")}</strong>
          <span className="operational-dropzone__hint">{translate("hero.dropzoneHint")}</span>
        </div>

        <Button
          variant="primary"
          className="operational-select-btn"
          onClick={() => fileInputRef.current?.click()}
        >
          <FileText size={16} aria-hidden="true" />
          <span>{translate("hero.selectFiles")}</span>
        </Button>
      </section>

      <div className="operational-dropzone__secondary-action">
        <Button variant="secondary" className="operational-new-dossier-pill" onClick={onOpenStudio}>
          <FilePlus2 size={16} aria-hidden="true" />
          <span>{translate("hero.newDossier")}</span>
        </Button>
      </div>
    </div>
  );
}
