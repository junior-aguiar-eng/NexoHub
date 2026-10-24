import { translate } from "@/i18n";
import { type ImageResultItem, summarizeImageResults } from "@/platform/image-results";

function bytes(value: number) {
  return value < 1024
    ? `${value} B`
    : value < 1024 * 1024
      ? `${(value / 1024).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} KiB`
      : `${(value / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} MiB`;
}
function format(mime: string) {
  return mime === "image/jpeg"
    ? "JPG"
    : mime === "image/png"
      ? "PNG"
      : mime === "image/webp"
        ? "WebP"
        : mime;
}
export function ImageResultsPanel({
  items,
  originalUrl,
  resultUrl,
  archiveBytes,
}: {
  items: readonly ImageResultItem[];
  originalUrl?: string;
  resultUrl?: string;
  archiveBytes?: number;
}) {
  const totals = summarizeImageResults(items);
  const delta =
    totals.savedBytes === 0
      ? translate("imageResults.unchanged")
      : translate(
          totals.savedBytes > 0 ? "imageResults.reduction" : "imageResults.increase",
        ).replace(
          "{percent}",
          totals.percent === 0 ? "<0,1" : Math.abs(totals.percent).toLocaleString("pt-BR"),
        );
  return (
    <section className="image-export-results" aria-label={translate("imageResults.title")}>
      <h2>{translate("imageResults.title")}</h2>
      <p className="image-export-totals">
        <strong>
          {bytes(totals.beforeBytes)} → {bytes(totals.afterBytes)}
        </strong>
        <span>{delta}</span>
      </p>
      {archiveBytes !== undefined && (
        <p>{translate("imageResults.archive").replace("{bytes}", bytes(archiveBytes))}</p>
      )}
      <p className="image-export-note">{translate("imageResults.note")}</p>
      {items.length === 1 && originalUrl && resultUrl && (
        <div className="image-export-comparison">
          <figure>
            <img src={originalUrl} alt={translate("imageResults.original")} />
            <figcaption>{translate("imageResults.original")}</figcaption>
          </figure>
          <figure>
            <img src={resultUrl} alt={translate("imageResults.processed")} />
            <figcaption>{translate("imageResults.processed")}</figcaption>
          </figure>
        </div>
      )}
      <ol className="image-export-list">
        {items.map((item) => (
          <li key={item.outputName}>
            <h3>{item.sourceName}</h3>
            <dl>
              <div>
                <dt>{translate("imageResults.before")}</dt>
                <dd>
                  {bytes(item.before.sizeBytes)} · {format(item.before.mimeType)}
                  <br />
                  {item.before.width} × {item.before.height} px
                </dd>
              </div>
              <div>
                <dt>{translate("imageResults.after")}</dt>
                <dd>
                  {bytes(item.after.sizeBytes)} · {format(item.after.mimeType)}
                  <br />
                  {item.after.width} × {item.after.height} px
                </dd>
              </div>
            </dl>
            <p>{item.outputName}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
