import { useEffect, useRef, useState } from "react";
import type { ImageWatermarkOptions } from "@/platform/image-engine";
import { processImage } from "@/platform/image-processing";

/** Prévia efêmera: usa a mesma operação do export, cancela versões obsoletas e não persiste arquivos. */
export function useWatermarkPreview(
  source: string | undefined,
  options: ImageWatermarkOptions,
  suspended: boolean,
) {
  const [url, setUrl] = useState<string>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  const { type, text, color, opacity, rotation, position, watermarkBlob } = options;
  const previousSource = useRef(source);
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  useEffect(() => {
    if (previousSource.current !== source) {
      previousSource.current = source;
      setUrl(undefined);
    }
    if (!source || suspended || (type === "image" && !watermarkBlob)) {
      setPending(false);
      if (type === "image" && !watermarkBlob) setUrl(undefined);
      return;
    }
    const controller = new AbortController();
    setPending(true);
    setError(false);
    const timer = setTimeout(async () => {
      try {
        // A origem é o object URL local criado ao selecionar o arquivo, nunca um upload remoto.
        if (!source.startsWith("blob:") && !source.startsWith("data:"))
          throw new Error("PREVIA_LOCAL_INVALIDA");
        const response = await fetch(source, { signal: controller.signal });
        if (!response.ok) throw new Error("PREVIA_LOCAL_INVALIDA");
        const blob = await response.blob();
        const output = await processImage(
          {
            kind: "watermark",
            blob,
            options: {
              type,
              text,
              color,
              opacity,
              rotation,
              position,
              watermarkBlob,
              mimeType: "image/png",
            },
          },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setUrl(URL.createObjectURL(output));
          setPending(false);
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setPending(false);
          setUrl(undefined);
        }
      }
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [source, suspended, type, text, color, opacity, rotation, position, watermarkBlob]);
  return { url, pending, error };
}
