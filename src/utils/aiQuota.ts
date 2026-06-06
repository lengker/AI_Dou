import { todayKey } from '@/utils/time';

const QUOTA_KEY = 'room404-ai-quota';
const DAILY_LIMIT = 40;

interface QuotaState {
  date: string;
  used: number;
}

function load(): QuotaState {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as QuotaState;
      if (parsed.date === todayKey()) return parsed;
    }
  } catch {
    // ignore
  }
  return { date: todayKey(), used: 0 };
}

function save(state: QuotaState) {
  localStorage.setItem(QUOTA_KEY, JSON.stringify(state));
}

export function getAiRemaining(): number {
  const s = load();
  return Math.max(0, DAILY_LIMIT - s.used);
}

export function canUseAi(): boolean {
  return getAiRemaining() > 0;
}

export function consumeAiCredit(count = 1): boolean {
  const s = load();
  if (s.used + count > DAILY_LIMIT) return false;
  save({ date: todayKey(), used: s.used + count });
  return true;
}

export const AI_DAILY_LIMIT = DAILY_LIMIT;
