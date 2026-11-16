import { Plus, Trash2 } from "lucide-react";
import { translate } from "@/i18n";
import { usePointerReorder } from "./usePointerReorder";

const fileKeys = new WeakMap<File, string>();
let nextFileKey = 0;

function getFileKey(file: File): string {
  let key = fileKeys.get(file);
  if (!key) {
    key = `merge-file-${++nextFileKey}`;
    fileKeys.set(file, key);
  }
  return key;
}

type MergePdfPanelProps = {
  files: File[];
  thumbnails: ReadonlyMap<File, string>;
  onRemoveFile: (index: number) => void;
  onReorderFiles: (fromIndex: number, toIndex: number) => void;
  onAddMoreFiles: () => void;
};

export function MergePdfPanel({
  files,
  thumbnails,
  onRemoveFile,
  onReorderFiles,
  onAddMoreFiles,
}: MergePdfPanelProps) {
  const { draggedIndex, dragOverIndex, getItemProps } = usePointerReorder({
    onReorder: onReorderFiles,
  });

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="ilovepdf-merge-container" data-workspace-panel>
      {/* Centro: Grid de Arquivos com Miniaturas */}
      <div className="ilovepdf-merge-preview-area" data-workspace-part="document">
        <div className="ilovepdf-merge-cards-grid">
          {files.map((file, idx) => {
            const thumb = thumbnails.get(file);
            const dragProps = getItemProps(idx);
            const isDragging = draggedIndex === idx;
            const isDragOver = dragOverIndex === idx && draggedIndex !== idx;
            return (
              <div
                key={getFileKey(file)}
                className={`ilovepdf-merge-file-card${isDragging ? " ilovepdf-merge-file-card--dragging" : ""}${isDragOver ? " ilovepdf-merge-file-card--drag-over" : ""}`}
                {...dragProps}
              >
                <div className="ilovepdf-merge-card-header">
                  <span className="ilovepdf-merge-card-badge">{idx + 1}</span>
                  <button
                    type="button"
                    className="ilovepdf-merge-card-delete"
                    onClick={() => onRemoveFile(idx)}
                    title={translate("workspace.merge.removeFile")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="ilovepdf-merge-thumb-box">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Capa de ${file.name}`}
                      className="ilovepdf-merge-img"
                      draggable={false}
                    />
                  ) : (
                    <div className="ilovepdf-merge-placeholder">PDF</div>
                  )}
                </div>

                <span className="ilovepdf-merge-filename" title={file.name}>
                  {file.name}
                </span>
                <span className="ilovepdf-merge-filesize">{formatSize(file.size)}</span>
              </div>
            );
          })}

          {/* Card para Adicionar Mais */}
          <button
            type="button"
            className="ilovepdf-merge-add-card"
            onClick={onAddMoreFiles}
            title={translate("workspace.merge.addFiles")}
          >
            <div className="ilovepdf-merge-add-icon">
              <Plus size={24} />
            </div>
            <span>{translate("workspace.merge.addFiles")}</span>
          </button>
        </div>
      </div>

      {/* Lateral: Resumo */}
      <aside className="ilovepdf-merge-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.merge.title")}</h3>
        <p className="ilovepdf-sidebar-desc">{translate("workspace.merge.desc")}</p>
        <div className="ilovepdf-merge-stats-card">
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.merge.filesCount")}</span>
            <strong>{files.length}</strong>
          </div>
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.merge.totalSize")}</span>
            <strong>{formatSize(files.reduce((acc, f) => acc + f.size, 0))}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
