import { useEffect, useState } from "react";
import type { CloudProfile } from "@/platform/cloud-identity";

const INLINE_IMAGE = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;

/** Só `https:` sem credenciais ou `data:` de imagem raster; qualquer outra coisa vira a inicial. */
export function safePictureSource(value: string | undefined): string | null {
  if (!value) return null;
  if (INLINE_IMAGE.test(value)) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function AccountAvatar({
  profile,
  email,
  size,
}: {
  profile: CloudProfile | null;
  email?: string;
  size: "sm" | "lg";
}) {
  const source = safePictureSource(profile?.picture);
  const [failed, setFailed] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nova foto reabilita a tentativa de carregar
  useEffect(() => setFailed(false), [source]);
  const initial = Array.from((profile?.name ?? email ?? "").trim())[0]?.toUpperCase() ?? "?";
  return (
    <span className={`account-avatar account-avatar--${size}`} aria-hidden="true">
      {source && !failed ? (
        <img src={source} alt="" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </span>
  );
}
