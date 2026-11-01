/**
 * Lembra o e-mail só entre pedir o link e abri-lo no mesmo navegador, para não pedir o endereço de
 * novo. Expira em uma hora e é apagado ao concluir o login ou sair. Em outro aparelho não existe,
 * e o endereço volta a ser pedido, como o Firebase exige.
 */
const KEY = "nexohub.cloud.emailLink";
export const EMAIL_MEMORY_TTL_MS = 60 * 60 * 1000;

export const emailMemory = {
  save(email: string, now = Date.now()): void {
    try {
      localStorage.setItem(KEY, JSON.stringify({ email, at: now }));
    } catch {
      // Sem armazenamento disponível, o e-mail simplesmente é pedido de novo.
    }
  },
  read(now = Date.now()): string | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const value = JSON.parse(raw) as { email?: unknown; at?: unknown } | null;
      if (
        typeof value?.email !== "string" ||
        typeof value.at !== "number" ||
        value.at > now ||
        now - value.at > EMAIL_MEMORY_TTL_MS
      ) {
        emailMemory.clear();
        return null;
      }
      return value.email;
    } catch {
      emailMemory.clear();
      return null;
    }
  },
  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // nada a apagar
    }
  },
};
