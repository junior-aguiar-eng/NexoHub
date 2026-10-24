import { useEffect, useRef, useState } from "react";
import {
  type ImageBatchEntry,
  imageBatchExceedsLimits,
  inspectImageBatch,
} from "@/platform/image-batch";

export function useImageBatch(files: readonly File[], selectedIndex: number) {
  const cache = useRef(new WeakMap<File, ImageBatchEntry>());
  const [state, setState] = useState<{
    files: readonly File[];
    entries: readonly ImageBatchEntry[];
  }>({ files: [], entries: [] });
  const limitExceeded = imageBatchExceedsLimits(files);
  useEffect(() => {
    const controller = new AbortController();
    if (limitExceeded) {
      setState({ files, entries: [] });
      return;
    }
    const publish = () =>
      setState({
        files,
        entries: files.flatMap((file) => {
          const item = cache.current.get(file);
          return item ? [item] : [];
        }),
      });
    publish();
    const missing = files.filter((file) => !cache.current.has(file));
    void inspectImageBatch(missing, controller.signal, (entry) => {
      cache.current.set(entry.file, entry);
      publish();
    }).catch(() => {});
    return () => controller.abort();
  }, [files, limitExceeded]);
  const entries = files.map((file) =>
    state.files === files
      ? (state.entries.find((entry) => entry.file === file) ?? { file })
      : { file },
  );
  const selected = entries[Math.min(selectedIndex, Math.max(0, files.length - 1))];
  const selectedFile = selected?.metadata ? selected.file : undefined;
  const [preview, setPreview] = useState<{ file: File; url: string }>();
  useEffect(() => {
    if (!selectedFile) {
      setPreview(undefined);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreview({ file: selectedFile, url });
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);
  return {
    entries,
    selected,
    previewUrl: preview?.file === selectedFile ? preview?.url : undefined,
    pending: !limitExceeded && entries.some((entry) => !entry.metadata && !entry.error),
    invalid: limitExceeded || entries.some((entry) => Boolean(entry.error)),
    limitExceeded,
  };
}
