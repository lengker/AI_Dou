import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { A_CLASS, B_CLASS, COLLECTIBLES } from '@/data/collectibles';
import { getFurniture, getFurnitureByHotZoneId } from '@/data/furniture';
import { TUTORIAL_STEPS } from '@/data/tutorial';
import {
  CYBER_PREFIXES, EASTER_EGG_TITLES, POSITIVE_PREFIXES,
  RANDOM_EVENTS, TITLES, TITLE_EXPLANATIONS,
} from '@/data/titles';
import { pickTrashCollectible, calculateOfflineSettlement } from '@/utils/offline';
import { isMidnightMode, isWeekend, randomPick, todayKey } from '@/utils/time';
import type {
  AvatarAppearance, AvatarProfile, GameState, OfflineResult,
  PetState, RoomId, TempBuff,
} from '@/types';

const STORAGE_KEY = 'room404-save';
const LAST_OPEN_KEY = 'room404-last-open';

interface GameActions {
  initApp: () => void;
  recordExit: () => void;
  completeMapping: (profile: AvatarProfile) => void;
  setScreen: (screen: GameState['screen']) => void;
  switchRoom: (room: RoomId) => void;
  setPetState: (state: PetState) => void;
  tickPetState: () => void;
  clearPendingOffline: () => void;
  addShards: (amount: number) => void;
  addCollectible: (id: string) => void;
  unlockAchievement: (id: string) => void;
  unlockFurniture: (furnitureId: string) => boolean;
  handleHotZone: (zoneId: string) => HotZoneResult | null;
  handlePetClick: () => PetClickResult | null;
  confirmWake: () => void;
  dismissRandomEvent: () => void;
  setRandomEventMessage: (message: string) => void;
  triggerRandomEventOnEnter: () => boolean;
  startRemapping: () => boolean;
  resetForRemapping: () => void;
  startTutorial: () => void;
  nextTutorialStep: () => void;
  skipTutorial: () => void;
  dismissWelcomeModal: () => void;
  beginTutorialFromWelcome: () => void;
}

export interface HotZoneResult {
  type: 'computer' | 'bed' | 'fridge' | 'trash' | 'arcade' | 'furniture_unlock' | 'furniture_view' | 'desktop_bubble' | 'decorative';
  payload?: Record<string, unknown>;
}

export interface PetClickResult {
  type: 'missy_progress' | 'missy_complete' | 'wake_confirm' | 'easter_egg' | 'easter_cooldown' | 'angry';
  message?: string;
}

const FOREST_FURNITURE_TITLES: Record<string, string> = {
  F06: '青苔阵特写',
  F07: '铃兰萤光特写',
  F08: '林间神龛特写',
};

function ensureDaily(daily: GameState['daily']): GameState['daily'] {
  const today = todayKey();
  if (daily.date === today) return daily;
  return { date: today, trashSearchCount: 0, randomEventCount: 0, easterEggTriggered: false };
}

function checkCollectibleAchievements(collectibles: string[], achievements: string[]): string[] {
  const next = [...achievements];
  if (collectibles.length >= 8 && !next.includes('ach_collector')) next.push('ach_collector');
  if (collectibles.length >= 15 && !next.includes('ach_full')) next.push('ach_full');
  return next;
}

function maybeGrantC015(collectibles: string[]): string[] {
  const allExceptC015 = COLLECTIBLES.filter((c) => c.id !== 'C015').map((c) => c.id);
  if (allExceptC015.every((id) => collectibles.includes(id)) && !collectibles.includes('C015')) {
    return [...collectibles, 'C015'];
  }
  return collectibles;
}

export function generateTitle(isAbnormal: boolean) {
  if (isAbnormal) {
    return { prefix: '', title: '面目模糊的异常数据体', fullTitle: '面目模糊的异常数据体', titleExplanation: TITLE_EXPLANATIONS['面目模糊的异常数据体'] };
  }
  const prefix = randomPick([...POSITIVE_PREFIXES, ...CYBER_PREFIXES]);
  let title = randomPick(TITLES);
  const roll = Math.random();
  if (roll < EASTER_EGG_TITLES[0].probability) title = EASTER_EGG_TITLES[0].title;
  else if (roll < EASTER_EGG_TITLES[0].probability + EASTER_EGG_TITLES[1].probability) title = EASTER_EGG_TITLES[1].title;
  return { prefix, title, fullTitle: `${prefix}${title}`, titleExplanation: TITLE_EXPLANATIONS[title] ?? '' };
}

export function applyHiddenName(nickname: string, base: ReturnType<typeof generateTitle>) {
  if (nickname.trim().toLowerCase() === 'wang yu') {
    return { prefix: '', title: '404号房间首席架构师', fullTitle: '404号房间首席架构师', titleExplanation: TITLE_EXPLANATIONS['404号房间首席架构师'], isHiddenArchitect: true };
  }
  return { ...base, isHiddenArchitect: false };
}

const initialState: GameState = {
  hasCompletedMapping: false, profile: null, shards: 0, collectibles: [], furniture: [],
  achievements: [], catUnlocked: false, currentRoom: 'room_working', petState: 'S1',
  missyState: false, missyClicks: 0, lastMissyClickAt: 0, petClickCount: 0, petClickWindowStart: 0,
  lastExitAt: null, daily: { date: todayKey(), trashSearchCount: 0, randomEventCount: 0, easterEggTriggered: false },
  tempBuff: {}, pendingOffline: null, showRandomEvent: null, computerSessionEnd: null,
  screen: 'mapping', returnRoom: null,
  tutorialCompleted: false, tutorialActive: false, tutorialStep: 0, showWelcomeModal: false,
};

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      initApp: () => {
        const state = get();
        const daily = ensureDaily(state.daily);
        const now = Date.now();
        const lastOpenAt = Number(localStorage.getItem(LAST_OPEN_KEY) || 0) || null;

        if (!state.hasCompletedMapping) {
          set({ screen: 'mapping', daily });
          localStorage.setItem(LAST_OPEN_KEY, String(now));
          return;
        }

        if (state.tutorialCompleted === undefined) {
          set({ tutorialCompleted: true });
        }

        let pendingOffline: OfflineResult | null = null;
        if (state.lastExitAt) {
          pendingOffline = calculateOfflineSettlement(state.lastExitAt, now, state.collectibles, state.catUnlocked, lastOpenAt);
          if (pendingOffline.tier === 'T2' && !pendingOffline.collectibleId) {
            const unownedB = B_CLASS.filter((id) => !state.collectibles.includes(id));
            if (unownedB.length === 0 && Math.random() < 0.05) {
              pendingOffline = { ...pendingOffline, shards: pendingOffline.shards + 10 };
            }
          }
        }

        const updates: Partial<GameState> = { daily, screen: 'room', pendingOffline };
        if (pendingOffline?.missyState) { updates.missyState = true; updates.petState = 'S3'; }
        else if (isMidnightMode()) updates.petState = 'S3';
        else updates.petState = randomPick<PetState>(['S1', 'S2', 'S3', 'S4']);

        if (pendingOffline && pendingOffline.tier !== 'anomaly' && pendingOffline.tier !== null) {
          let shards = state.shards + pendingOffline.shards;
          let collectibles = [...state.collectibles];
          let catUnlocked = state.catUnlocked;
          let achievements = [...state.achievements];
          if (pendingOffline.collectibleId) collectibles = maybeGrantC015([...collectibles, pendingOffline.collectibleId]);
          if (pendingOffline.unlockCat) catUnlocked = true;
          achievements = checkCollectibleAchievements(collectibles, achievements);
          Object.assign(updates, { shards, collectibles, catUnlocked, achievements });
        }

        localStorage.setItem(LAST_OPEN_KEY, String(now));
        set(updates);
      },

      recordExit: () => set({ lastExitAt: Date.now() }),

      completeMapping: (profile) => {
        let collectibles = [...get().collectibles];
        let achievements = [...get().achievements];
        if (profile.isAbnormal && !collectibles.includes('C011')) collectibles.push('C011');
        if (profile.isHiddenArchitect && !collectibles.includes('C012')) collectibles.push('C012');
        if (profile.isAbnormal && !achievements.includes('ach_abnormal')) achievements.push('ach_abnormal');
        if (profile.isHiddenArchitect && !achievements.includes('ach_architect')) achievements.push('ach_architect');
        collectibles = maybeGrantC015(collectibles);
        achievements = checkCollectibleAchievements(collectibles, achievements);
        set({
          hasCompletedMapping: true, profile, collectibles, achievements, screen: 'room',
          petState: randomPick<PetState>(['S1', 'S2', 'S3', 'S4']),
          showWelcomeModal: true, tutorialActive: false, tutorialStep: 0,
        });
      },

      setScreen: (screen) => set({ screen }),
      switchRoom: (room) => set({ currentRoom: room }),
      setPetState: (petState) => set({ petState }),

      tickPetState: () => {
        const s = get();
        if (s.missyState || isMidnightMode()) return;
        if (s.tempBuff.forcedSleep && Date.now() < s.tempBuff.forcedSleep.expiresAt) return;
        set({ petState: randomPick<PetState>(['S1', 'S2', 'S3', 'S4']) });
      },

      clearPendingOffline: () => set({ pendingOffline: null }),
      addShards: (amount) => set({ shards: get().shards + amount }),

      addCollectible: (id) => {
        if (get().collectibles.includes(id)) return;
        const collectibles = maybeGrantC015([...get().collectibles, id]);
        set({ collectibles, achievements: checkCollectibleAchievements(collectibles, get().achievements) });
      },

      unlockAchievement: (id) => {
        if (!get().achievements.includes(id)) set({ achievements: [...get().achievements, id] });
      },

      unlockFurniture: (furnitureId) => {
        const item = getFurniture(furnitureId);
        if (!item || get().furniture.includes(item.id) || get().shards < item.cost) return false;
        set({ shards: get().shards - item.cost, furniture: [...get().furniture, item.id] });
        return true;
      },

      handleHotZone: (zoneId) => {
        const s = get();
        const daily = ensureDaily(s.daily);

        if (zoneId === 'W01' || zoneId === 'W02' || zoneId === 'F01') {
          set({ petState: 'S2', computerSessionEnd: Date.now() + 10000 });
          return { type: 'computer', payload: { zoneId, midnight: isMidnightMode() } };
        }
        if (zoneId === 'L01' || zoneId === 'F02') {
          if (s.missyState) return null;
          set({ petState: 'S3', tempBuff: { forcedSleep: { expiresAt: Date.now() + 5 * 60 * 1000 } } });
          return { type: 'bed', payload: { zoneId } };
        }
        if (zoneId === 'L04' || zoneId === 'F03') {
          const weekend = isWeekend();
          const roll = Math.random() * 100;
          let result: 'cola' | 'expired' | 'empty';
          if (weekend) result = roll < 70 ? 'cola' : roll < 85 ? 'expired' : 'empty';
          else result = roll < 40 ? 'cola' : roll < 70 ? 'expired' : 'empty';
          const buff: TempBuff = { ...s.tempBuff };
          if (result === 'cola') {
            buff.speedBoost = { expiresAt: Date.now() + 2 * 60 * 1000, multiplier: 1.3 };
            const key = `weekend-cola-${todayKey()}`;
            if (weekend && !localStorage.getItem(key)) {
              localStorage.setItem(key, '1');
              buff.keyboardBoost = { expiresAt: Date.now() + 2 * 60 * 1000, multiplier: 2 };
            }
          } else if (result === 'expired') {
            buff.glitch = { expiresAt: Date.now() + 3000 };
            set({ petState: 'S5' });
            setTimeout(() => { if (get().petState === 'S5') get().setPetState('S1'); }, 3000);
          }
          set({ tempBuff: buff, daily });
          return { type: 'fridge', payload: { result, zoneId } };
        }
        if (zoneId === 'L05' || zoneId === 'F05') {
          set({ screen: 'arcade', returnRoom: s.currentRoom });
          return { type: 'arcade' };
        }
        if (zoneId === 'L06' || zoneId === 'F04') {
          if (daily.trashSearchCount >= 3) return { type: 'trash', payload: { limit: true, message: '今日翻找次数已达上限。' } };
          daily.trashSearchCount += 1;
          set({ daily });
          const unownedA = A_CLASS.filter((id) => !s.collectibles.includes(id));
          if (unownedA.length === 0) return { type: 'trash', payload: { empty: true, message: '只剩电子灰尘了。' } };
          if (Math.random() < 0.2) {
            set({ petState: 'S5' });
            setTimeout(() => { if (get().petState === 'S5') get().setPetState('S1'); }, 3000);
            return { type: 'trash', payload: { miss: true } };
          }
          const found = pickTrashCollectible(s.collectibles)!;
          get().addCollectible(found);
          return { type: 'trash', payload: { collectibleId: found, zoneId } };
        }
        if (zoneId === 'W04') return { type: 'desktop_bubble', payload: { message: '这里暂时什么都没有。' } };

        const furniture = getFurnitureByHotZoneId(zoneId);
        if (furniture) {
          if (!s.furniture.includes(furniture.id)) {
            return { type: 'furniture_unlock', payload: { furnitureId: furniture.id, cost: furniture.cost, name: furniture.name } };
          }
          return {
            type: 'furniture_view',
            payload: {
              furnitureId: furniture.id,
              title: FOREST_FURNITURE_TITLES[zoneId] ?? furniture.overlayTitle,
              icon: furniture.icon,
              hotZoneId: zoneId,
            },
          };
        }
        return null;
      },

      handlePetClick: () => {
        const s = get();
        const now = Date.now();
        const daily = ensureDaily(s.daily);
        if (isMidnightMode() && s.petState === 'S3' && !s.missyState) return { type: 'wake_confirm' };
        if (s.missyState) {
          if (now - s.lastMissyClickAt > 2000) { set({ missyClicks: 1, lastMissyClickAt: now }); return { type: 'missy_progress' }; }
          const clicks = s.missyClicks + 1;
          if (clicks >= 3) { set({ missyState: false, missyClicks: 0, petState: 'S1' }); return { type: 'missy_complete', message: '你回来了，我就知道你会回来。' }; }
          set({ missyClicks: clicks, lastMissyClickAt: now });
          return { type: 'missy_progress' };
        }
        if (daily.easterEggTriggered) return { type: 'easter_cooldown', message: '今天已经抛过了。' };
        let { petClickCount, petClickWindowStart } = s;
        if (now - petClickWindowStart > 10000) { petClickCount = 0; petClickWindowStart = now; }
        petClickCount += 1;
        set({ petClickCount, petClickWindowStart });
        if (petClickCount >= 20) {
          daily.easterEggTriggered = true;
          get().addCollectible('C014');
          get().unlockAchievement('ach_throw');
          set({ daily, petClickCount: 0 });
          return { type: 'easter_egg' };
        }
        if (petClickCount > 10) return { type: 'angry', message: '再点我就要抛出异常了！' };
        return null;
      },

      confirmWake: () => set({ petState: 'S1' }),
      dismissRandomEvent: () => set({ showRandomEvent: null }),

      setRandomEventMessage: (message) => {
        set({ showRandomEvent: message });
        setTimeout(() => get().dismissRandomEvent(), 8000);
      },

      triggerRandomEventOnEnter: () => {
        const daily = ensureDaily(get().daily);
        if (daily.randomEventCount >= 3 || Math.random() * 100 >= 30) return false;
        daily.randomEventCount += 1;
        set({ daily });
        return true;
      },

      startRemapping: () => {
        if (get().shards < 30) return false;
        set({ shards: get().shards - 30 });
        return true;
      },

      resetForRemapping: () => set({ screen: 'mapping' }),

      startTutorial: () => set({ tutorialActive: true, tutorialStep: 0, tutorialCompleted: false, showWelcomeModal: false }),

      nextTutorialStep: () => {
        const { tutorialStep } = get();
        if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
          set({ tutorialActive: false, tutorialCompleted: true, tutorialStep: 0, showWelcomeModal: false });
        } else {
          set({ tutorialStep: tutorialStep + 1 });
        }
      },

      skipTutorial: () => set({ tutorialActive: false, tutorialCompleted: true, tutorialStep: 0, showWelcomeModal: false }),
      dismissWelcomeModal: () => set({ showWelcomeModal: false }),
      beginTutorialFromWelcome: () => set({ showWelcomeModal: false, tutorialActive: true, tutorialStep: 0 }),
    }),
    { name: STORAGE_KEY },
  ),
);

export function finalizeComputerInteraction(): string | null {
  const store = useGameStore.getState();
  if (!store.collectibles.includes('C013') && Math.random() < 0.03) {
    store.addCollectible('C013');
    return 'C013';
  }
  return null;
}

export function createDefaultVisitorProfile(): AvatarProfile {
  return {
    nickname: '访客', fullTitle: '默认访客', titleExplanation: TITLE_EXPLANATIONS['默认访客'],
    prefix: '', title: '默认访客',
    appearance: { clothingColor: '#888888', skinTone: 'standard', hairColor: 'dark', isDefault: true },
    isAbnormal: false, isHiddenArchitect: false, isDefaultVisitor: true,
  };
}

export function createProfileFromMapping(nickname: string, appearance: AvatarAppearance, isAbnormal: boolean): AvatarProfile {
  const base = generateTitle(isAbnormal);
  const hidden = applyHiddenName(nickname, base);
  return {
    nickname: nickname.trim() || '匿名分身',
    fullTitle: hidden.fullTitle, titleExplanation: hidden.titleExplanation,
    prefix: hidden.prefix, title: hidden.title, appearance, isAbnormal,
    isHiddenArchitect: hidden.isHiddenArchitect ?? false, isDefaultVisitor: false,
  };
}
