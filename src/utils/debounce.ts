const locks = new Map<string, number>();

export function debounceAction(key: string, ms = 500): boolean {
  const now = Date.now();
  const last = locks.get(key) ?? 0;
  if (now - last < ms) return false;
  locks.set(key, now);
  return true;
}
