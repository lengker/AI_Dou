export function isMidnightMode(date = new Date()): boolean {
  const hour = date.getHours();
  return hour >= 23 || hour < 6;
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
