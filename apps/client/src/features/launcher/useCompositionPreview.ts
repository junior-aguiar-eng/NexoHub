import { useEffect, useState } from "react";
import type { ImageCompositionSnapshot } from "@/platform/image-composition-types";
import { processImage } from "@/platform/image-processing";
export function useCompositionPreview(
  source: Blob,
  snapshot: ImageCompositionSnapshot,
  suspended: boolean,
) {
  const { objects } = snapshot;
  const [result, setResult] = useState<{
    source: Blob;
    objects: ImageCompositionSnapshot["objects"];
    url?: string;
    error?: boolean;
  }>();
  useEffect(
    () => () => {
      if (result?.url) URL.revokeObjectURL(result.url);
    },
    [result],
  );
  useEffect(() => {
    if (suspended) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void processImage(
        { kind: "composition", blob: source, options: { objects } },
        controller.signal,
      )
        .then((blob) => {
          if (!controller.signal.aborted)
            setResult({ source, objects: objects, url: URL.createObjectURL(blob) });
        })
        .catch(() => {
          if (!controller.signal.aborted) setResult({ source, objects: objects, error: true });
        });
    }, 120);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, objects, suspended]);
  const current = result?.source === source && result?.objects === objects;
  return {
    url: current ? result.url : undefined,
    error: current && result.error,
    ready: current && Boolean(result.url),
  };
}
