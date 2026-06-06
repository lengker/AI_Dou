const MIDNIGHT_DEBUG_KEY = 'dou_force_midnight';

export function isMidnightMode(date = new Date()): boolean {
  if (typeof window !== 'undefined') {
    const forced = window.localStorage.getItem(MIDNIGHT_DEBUG_KEY);
    if (forced === '1') return true;
    if (forced === '0') return false;
  }

  // Keep normal play visuals stable. Midnight mode is now opt-in only.
  void date;
  return false;
}

export function isWeekend(date = new Date()): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function randomPick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function formatMinutes(ms: number): number {
  return Math.floor(ms / 60000);
}
