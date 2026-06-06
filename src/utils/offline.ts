import { A_CLASS, B_CLASS } from '@/data/collectibles';
import { T1_MESSAGES } from '@/data/titles';
import type { OfflineResult } from '@/types';
import { clamp, formatMinutes } from '@/utils/time';

const MAX_OFFLINE_MINUTES = 4320;

export function detectTimeAnomaly(
  lastExitAt: number | null,
  now: number,
  lastOpenAt: number | null,
): boolean {
  if (!lastExitAt) return false;
  if (now < lastExitAt) return true;
  if (lastOpenAt && now - lastOpenAt < 5 * 60 * 1000 && now - lastExitAt > 24 * 60 * 60 * 1000) {
    return true;
  }
  return false;
}

export function calculateOfflineSettlement(
  lastExitAt: number | null,
  now: number,
  ownedCollectibles: string[],
  catUnlocked: boolean,
  lastOpenAt: number | null,
): OfflineResult {
  if (!lastExitAt) return { tier: null, shards: 0, message: '' };

  if (detectTimeAnomaly(lastExitAt, now, lastOpenAt)) {
    return {
      tier: 'anomaly',
      shards: 0,
      message: '检测到时间线发生异常波动！偷渡时间长河是不被允许的，本次时空穿越收益清零。',
    };
  }

  let T = formatMinutes(now - lastExitAt);
  T = clamp(T, 0, MAX_OFFLINE_MINUTES);

  if (T < 30) {
    return { tier: 'T0', shards: 0, message: '你回来了！我还以为要多等一会儿才能再见到你。' };
  }

  if (T < 120) {
    let unlockCat = false;
    let message: string;
    if (!catUnlocked && Math.random() * 100 < 15) {
      unlockCat = true;
      message = T1_MESSAGES[9];
    } else {
      const pool = T1_MESSAGES.slice(0, 9);
      message = pool[Math.floor(Math.random() * pool.length)].replace('{N}', String(T));
    }
    const shards = clamp(5 + Math.floor((T - 30) / 15), 5, 10);
    return { tier: 'T1', shards, message, unlockCat };
  }

  if (T < 1440) {
    const shards = clamp(15 + Math.floor((T / 60) * 1.5), 15, 50);
    let collectibleId: string | undefined;
    const unownedB = B_CLASS.filter((id) => !ownedCollectibles.includes(id));
    if (unownedB.length > 0 && Math.random() < 0.05) {
      collectibleId = unownedB[Math.floor(Math.random() * unownedB.length)];
    }
    return {
      tier: 'T2',
      shards,
      collectibleId,
      message: '你不在的这段时间，我把想你的次数都记下来了。对了，这是我在房间里找到的，送给你。',
    };
  }

  return {
    tier: 'T3',
    shards: 50,
    message: '我数着你离开的每一分钟……你终于回来了，我一直在等你。',
    missyState: true,
  };
}

export function pickTrashCollectible(owned: string[]): string | null {
  const unowned = A_CLASS.filter((id) => !owned.includes(id));
  if (unowned.length === 0) return null;
  return unowned[Math.floor(Math.random() * unowned.length)];
}
