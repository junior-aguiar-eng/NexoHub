export function parsePageRange(
  input: string,
  maxPages: number,
): { pages: number[]; valid: boolean } {
  if (!input.trim()) return { pages: [], valid: true };
  const pages = new Set<number>();
  for (const part of input.split(",").map((value) => value.trim())) {
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(part)) return { pages: [], valid: false };
    const [first, last = first] = part.split("-").map(Number);
    if (
      ![first, last, maxPages].every(Number.isSafeInteger) ||
      first < 1 ||
      last < 1 ||
      first > maxPages ||
      last > maxPages
    )
      return { pages: [], valid: false };
    for (let p = Math.min(first, last); p <= Math.max(first, last); p++) pages.add(p);
  }
  return { pages: [...pages].sort((a, b) => a - b), valid: true };
}
