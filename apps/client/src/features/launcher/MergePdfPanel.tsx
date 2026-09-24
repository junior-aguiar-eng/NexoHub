import { ArrowLeft, ArrowRight, Plus, Trash2 } from "lucide-react";

type MergePdfPanelProps = {
  files: File[];
  thumbnails: Record<string, string>;
  onRemoveFile: (index: number) => void;
  onMoveFile: (index: number, direction: "left" | "right") => void;
  onAddMoreFiles: () => void;
};

export function MergePdfPanel({
  files,
  thumbnails,
  onRemoveFile,
  onMoveFile,
  onAddMoreFiles,
}: MergePdfPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="ilovepdf-merge-container">
      {/* Centro: Grid de Arquivos com Miniaturas */}
      <div className="ilovepdf-merge-preview-area">
        <div className="ilovepdf-merge-cards-grid">
          {files.map((file, idx) => {
            const thumb = thumbnails[file.name];
            return (
              <div
                key={`${file.name}-${file.size}-${file.lastModified}`}
                className="ilovepdf-merge-file-card"
              >
                <div className="ilovepdf-merge-card-header">
                  <span className="ilovepdf-merge-card-badge">{idx + 1}</span>
                  <button
                    type="button"
                    className="ilovepdf-merge-card-delete"
                    onClick={() => onRemoveFile(idx)}
                    title="Remover arquivo"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="ilovepdf-merge-thumb-box">
                  {thumb ? (
                    <img src={thumb} alt={`Capa de ${file.name}`} className="ilovepdf-merge-img" />
                  ) : (
                    <div className="ilovepdf-merge-placeholder">PDF</div>
                  )}
                </div>

                <span className="ilovepdf-merge-filename" title={file.name}>
                  {file.name}
                </span>
                <span className="ilovepdf-merge-filesize">{formatSize(file.size)}</span>

                <div className="ilovepdf-merge-card-actions">
                  <button
                    type="button"
                    className="ilovepdf-merge-move-btn"
                    disabled={idx === 0}
                    onClick={() => onMoveFile(idx, "left")}
                    title="Mover para esquerda"
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    type="button"
                    className="ilovepdf-merge-move-btn"
                    disabled={idx === files.length - 1}
                    onClick={() => onMoveFile(idx, "right")}
                    title="Mover para direita"
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          {/* Card para Adicionar Mais */}
          <button
            type="button"
            className="ilovepdf-merge-add-card"
            onClick={onAddMoreFiles}
            title="Adicionar mais arquivos"
          >
            <div className="ilovepdf-merge-add-icon">
              <Plus size={24} />
            </div>
            <span>Adicionar mais arquivos</span>
          </button>
        </div>
      </div>

      {/* Lateral: Resumo */}
      <aside className="ilovepdf-merge-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">Juntar PDF</h3>
        <p className="ilovepdf-sidebar-desc">
          Para alterar a ordem dos PDFs, utilize as setas nos cartões para organizar a sequência
          desejada antes de mesclar.
        </p>
        <div className="ilovepdf-merge-stats-card">
          <div className="ilovepdf-merge-stat-item">
            <span>Arquivos a juntar:</span>
            <strong>{files.length}</strong>
          </div>
          <div className="ilovepdf-merge-stat-item">
            <span>Tamanho total:</span>
            <strong>{formatSize(files.reduce((acc, f) => acc + f.size, 0))}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
