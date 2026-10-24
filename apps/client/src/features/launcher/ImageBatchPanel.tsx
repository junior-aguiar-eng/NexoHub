import { Plus, X } from "lucide-react";
import { useRef } from "react";
import { type MessageKey, translate } from "@/i18n";
import type { ImageBatchEntry } from "@/platform/image-batch";

interface Props {
  readonly entries: readonly ImageBatchEntry[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly onRemove: (index: number) => void;
  readonly onAdd: () => void;
  readonly disabled?: boolean;
  readonly limitExceeded?: boolean;
}

function inspectionMessage(code: string) {
  const messages: Record<string, MessageKey> = {
    IMAGEM_MUITO_GRANDE: "imageProcessing.errorLarge",
    FORMATO_IMAGEM_NAO_SUPORTADO: "imageProcessing.errorFormat",
    ANIMACAO_IMAGEM_NAO_SUPORTADA: "imageProcessing.errorFormat",
  };
  return translate(messages[code] ?? "imageBatch.invalidFile");
}

export function ImageBatchPanel({
  entries,
  selectedIndex,
  onSelect,
  onRemove,
  onAdd,
  disabled,
  limitExceeded,
}: Props) {
  const list = useRef<HTMLOListElement>(null);
  const fileKeys = useRef(new WeakMap<File, string>());
  const nextKey = useRef(0);
  const occurrences = new Map<File, number>();
  const rows = entries.map((entry) => {
    let key = fileKeys.current.get(entry.file);
    if (!key) {
      key = String(++nextKey.current);
      fileKeys.current.set(entry.file, key);
    }
    const occurrence = occurrences.get(entry.file) ?? 0;
    occurrences.set(entry.file, occurrence + 1);
    return { entry, key: `${key}-${occurrence}` };
  });
  return (
    <section className="image-batch-panel" aria-label={translate("imageBatch.title")}>
      <div className="image-batch-heading">
        <div>
          <h2>
            {translate("imageBatch.title")} <span>({entries.length})</span>
          </h2>
          <p>{translate("imageBatch.sharedOptions")}</p>
        </div>
        <button type="button" className="image-batch-add" onClick={onAdd} disabled={disabled}>
          <Plus size={16} aria-hidden="true" />
          {translate("imageBatch.add")}
        </button>
      </div>
      <ol ref={list} className="image-batch-list">
        {rows.map(({ entry, key }, index) => (
          <li key={key}>
            <button
              type="button"
              className="image-batch-select"
              aria-pressed={index === selectedIndex}
              aria-label={`${translate("imageBatch.select")} ${index + 1}: ${entry.file.name}`}
              onClick={() => onSelect(index)}
              disabled={disabled}
            >
              <span className="image-batch-index" aria-hidden="true">
                {index + 1}
              </span>
              <span className="image-batch-file">
                <strong title={entry.file.name}>{entry.file.name}</strong>
                <span>
                  {entry.error
                    ? translate("imageBatch.invalidFile")
                    : entry.metadata
                      ? `${entry.metadata.width} × ${entry.metadata.height} px`
                      : translate("imageBatch.inspecting")}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="image-batch-remove"
              onClick={() => {
                onRemove(index);
                requestAnimationFrame(() => {
                  const next =
                    list.current?.querySelectorAll<HTMLButtonElement>(".image-batch-select");
                  next?.[Math.min(index, next.length - 1)]?.focus();
                });
              }}
              disabled={disabled}
              aria-label={`${translate("imageBatch.remove")} ${index + 1}: ${entry.file.name}`}
            >
              <X size={17} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      {entries.some((entry) => entry.error) && (
        <div className="image-batch-warning" role="alert">
          <ul>
            {rows.flatMap(({ entry, key }, index) =>
              entry.error ? (
                <li key={key}>
                  {index + 1}. {entry.file.name}: {inspectionMessage(entry.error)}
                </li>
              ) : (
                []
              ),
            )}
          </ul>
        </div>
      )}
      {limitExceeded && <p role="alert">{translate("imageProcessing.errorBatch")}</p>}
    </section>
  );
}
