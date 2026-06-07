import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { A_CLASS, B_CLASS, COLLECTIBLES } from '@/data/collectibles';
import { FOREST_ANIMALS, FOREST_ANIMAL_BY_ZONE } from '@/data/forestAnimals';
import { getFurniture, getFurnitureByHotZoneId } from '@/data/furniture';
import { HOT_ZONES } from '@/data/hotzones';
import { MUSIC_BOX } from '@/data/musicBox';
import { TUTORIAL_STEPS } from '@/data/tutorial';
import {
  CYBER_PREFIXES, EASTER_EGG_TITLES, POSITIVE_PREFIXES,
  RANDOM_EVENTS, TITLES, TITLE_EXPLANATIONS,
} from '@/data/titles';
import { pickTrashCollectible, calculateOfflineSettlement } from '@/utils/offline';
import { isMidnightMode, isWeekend, randomPick, todayKey } from '@/utils/time';
import type {
  AvatarAppearance, AvatarProfile, GameState, OfflineResult,
  FeatureUnlock, HintKey, MainlineStep, PetState, RoomId, StoryDialog, TempBuff,
} from '@/types';

const STORAGE_KEY = 'room404-save';
const LAST_OPEN_KEY = 'room404-last-open';
const MAX_ENERGY = 6;
const MAX_MOOD = 5;
const DEFAULT_MOOD = 3;

interface GameActions {
  initApp: () => void;
  recordExit: () => void;
  completeMapping: (profile: AvatarProfile) => void;
  restartGame: () => void;
  setScreen: (screen: GameState['screen']) => void;
  switchRoom: (room: RoomId) => void;
  setPetState: (state: PetState) => void;
  tickPetState: () => void;
  clearPendingOffline: () => void;
  addShards: (amount: number) => void;
  addCollectible: (id: string) => void;
  unlockAchievement: (id: string) => void;
  unlockFurniture: (furnitureId: string) => boolean;
  activateMusicBox: () => boolean;
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
  dismissStoryDialog: () => void;
  recordArcadePlay: (mode: 'coin' | 'claw') => void;
  unlockForestAnimal: (zoneId: string) => { success: boolean; reward: number; alreadyUnlocked: boolean };
  startOnboarding: () => void;
  advanceOnboarding: () => void;
  dismissOnboarding: () => void;
  completeHint: (key: HintKey) => void;
  dismissActiveHint: () => void;
}

export interface HotZoneResult {
  type: 'computer' | 'bed' | 'fridge' | 'trash' | 'arcade' | 'furniture_unlock' | 'furniture_view' | 'desktop_bubble' | 'decorative' | 'forest_event';
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

const MAINLINE_DIALOGS: Record<Exclude<MainlineStep, 'intro'>, StoryDialog> = {
  bedroom: {
    id: 'unlock-bedroom',
    speaker: '赛博分身',
    title: '卧室已接通',
    body: '这间房终于不像临时缓存了。只要能吃饭、能睡觉，我就能继续稳定运行下去。',
    hint: '已解锁「生活区」',
  },
  forest: {
    id: 'unlock-forest',
    speaker: '旁白',
    title: '数据林海开放',
    body: '休息模块完成后，你为分身接上了第一片自然场景。它终于可以离开房间，去整理这个世界的生命数据。',
    hint: '已解锁「数据林海」，户外探索会消耗体力',
  },
  atlas: {
    id: 'unlock-atlas',
    speaker: '赛博分身',
    title: '图鉴开始记录',
    body: '原来收集不是囤积杂物，而是在给这个世界补全名字。被记录下来的东西，就不算白白消失。',
    hint: '已解锁「图鉴 / 收藏柜」',
  },
  arcade: {
    id: 'unlock-arcade',
    speaker: '旁白',
    title: '娱乐模块上线',
    body: '分身已经学会探索和记录，接下来它需要一点快乐。游戏机重新亮起，赛博世界开始有了日常温度。',
    hint: '已解锁「游戏机 / 推币机」',
  },
  claw: {
    id: 'unlock-claw',
    speaker: '赛博分身',
    title: '抓娃娃机开放',
    body: '推币机很好，但我还想试试更轻松的快乐。让我看看，运气这种东西能不能也被调参。',
    hint: '已解锁「抓娃娃机」',
  },
  free: {
    id: 'mainline-free',
    speaker: '旁白',
    title: '世界开始完整',
    body: '休息、探索、收集、娱乐都已接通。赛博分身不再只是被唤醒的程序，而是在这里真正生活了起来。',
    hint: '当前阶段：自由培育赛博分身，继续完善世界',
  },
};

const ROOM_PROGRESS_ZONES: Record<RoomId, string[]> = {
  room_working: HOT_ZONES.filter((zone) => zone.room === 'room_working' && !zone.decorative).map((zone) => zone.id),
  room_living: HOT_ZONES.filter((zone) => zone.room === 'room_living' && !zone.decorative).map((zone) => zone.id),
  outdoor_forest: HOT_ZONES.filter((zone) => zone.room === 'outdoor_forest').map((zone) => zone.id),
};

const ACTIVE_PET_STATES: PetState[] = ['S1', 'S2', 'S4'];

function addUnique<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list : [...list, value];
}

function hasFeature(list: FeatureUnlock[], feature: FeatureUnlock): boolean {
  return list.includes(feature);
}

function addHint(list: HintKey[], value: HintKey): HintKey[] {
  return list.includes(value) ? list : [...list, value];
}

function getNextActiveHint(completedHints: HintKey[], key: HintKey): HintKey | null {
  return completedHints.includes(key) ? null : key;
}

function getForestProgressCount(discoveredZones: string[]): number {
  return ROOM_PROGRESS_ZONES.outdoor_forest.filter((id) => discoveredZones.includes(id)).length;
}

function isForcedSleepActive(tempBuff: GameState['tempBuff']): boolean {
  return !!tempBuff.forcedSleep && Date.now() < tempBuff.forcedSleep.expiresAt;
}

function normalizeUnlockedFeatures(state: GameState): FeatureUnlock[] {
  let unlockedFeatures = [...(state.unlockedFeatures ?? [])];
  const completedHints = state.completedHints ?? [];
  const discoveredZones = state.discoveredZones ?? [];
  const forestAnimals = state.forestAnimals ?? [];

  const hasArcadeProgress = forestAnimals.length >= 3
    || state.mainlineStep === 'arcade'
    || state.mainlineStep === 'claw'
    || state.mainlineStep === 'free'
    || discoveredZones.includes('L05')
    || discoveredZones.includes('F05')
    || completedHints.includes('arcade_entry')
    || completedHints.includes('arcade_coin')
    || completedHints.includes('arcade_claw')
    || state.activeHint === 'arcade_entry'
    || state.activeHint === 'arcade_coin'
    || state.activeHint === 'arcade_claw';

  const hasClawProgress = state.mainlineStep === 'claw'
    || state.mainlineStep === 'free'
    || completedHints.includes('arcade_claw')
    || state.activeHint === 'arcade_claw';

  if (hasArcadeProgress) {
    unlockedFeatures = addUnique(addUnique(unlockedFeatures, 'arcade'), 'coin');
  }

  if (hasClawProgress) {
    unlockedFeatures = addUnique(addUnique(addUnique(unlockedFeatures, 'arcade'), 'coin'), 'claw');
  }

  return unlockedFeatures;
}

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

function createInitialState(): GameState {
  return {
    hasCompletedMapping: false, profile: null, shards: 0, collectibles: [], furniture: [],
    achievements: [], catUnlocked: false, currentRoom: 'room_working', petState: 'S1',
    missyState: false, missyClicks: 0, lastMissyClickAt: 0, petClickCount: 0, petClickWindowStart: 0,
    lastExitAt: null, daily: { date: todayKey(), trashSearchCount: 0, randomEventCount: 0, easterEggTriggered: false },
    tempBuff: {}, pendingOffline: null, showRandomEvent: null, computerSessionEnd: null,
    screen: 'mapping', returnRoom: null,
    tutorialCompleted: false, tutorialActive: false, tutorialStep: 0, tutorialReplayMode: false, showWelcomeModal: false,
    energy: MAX_ENERGY, maxEnergy: MAX_ENERGY, mood: DEFAULT_MOOD, maxMood: MAX_MOOD,
    discoveredZones: [], unlockedRooms: ['room_working'], unlockedFeatures: [],
    mainlineStep: 'intro', storyDialog: null,
    forestAnimals: [],
    onboardingActive: false,
    onboardingStep: 0,
    activeHint: null,
    completedHints: [],
    musicBoxUnlocked: false,
  };
}

const initialState: GameState = createInitialState();

export const useGameStore = create<GameState & GameActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      initApp: () => {
        const state = get();
        const daily = ensureDaily(state.daily);
        const now = Date.now();
        const lastOpenAt = Number(localStorage.getItem(LAST_OPEN_KEY) || 0) || null;
        const unlockedFeatures = normalizeUnlockedFeatures(state);
        const progressedSave = (state.discoveredZones?.length ?? 0) > 0
          || (state.completedHints?.length ?? 0) > 0
          || (state.unlockedRooms?.length ?? 1) > 1
          || (state.collectibles?.length ?? 0) > 0
          || state.mainlineStep !== 'intro';

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

        const updates: Partial<GameState> = {
          daily,
          screen: 'room',
          pendingOffline,
          energy: state.energy ?? MAX_ENERGY,
          maxEnergy: state.maxEnergy ?? MAX_ENERGY,
          mood: state.mood ?? DEFAULT_MOOD,
          maxMood: state.maxMood ?? MAX_MOOD,
          discoveredZones: state.discoveredZones ?? [],
          forestAnimals: state.forestAnimals ?? [],
          unlockedRooms: state.unlockedRooms,
          unlockedFeatures,
          mainlineStep: state.mainlineStep,
          storyDialog: state.storyDialog ?? null,
          tutorialActive: progressedSave ? false : (state.tutorialActive ?? false),
          tutorialStep: progressedSave ? 0 : (state.tutorialStep ?? 0),
          tutorialReplayMode: false,
          showWelcomeModal: progressedSave ? false : (state.showWelcomeModal ?? false),
          onboardingActive: progressedSave ? false : (state.onboardingActive ?? false),
          onboardingStep: progressedSave ? 0 : (state.onboardingStep ?? 0),
          activeHint: state.activeHint ?? null,
          completedHints: state.completedHints ?? [],
        };
        if (pendingOffline?.missyState) { updates.missyState = true; updates.petState = 'S3'; }
        else if (isForcedSleepActive(state.tempBuff ?? {})) updates.petState = 'S3';
        else if (isMidnightMode()) updates.petState = 'S3';
        else updates.petState = randomPick(ACTIVE_PET_STATES);

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

      restartGame: () => set(createInitialState()),

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
          petState: randomPick(ACTIVE_PET_STATES),
          showWelcomeModal: true, tutorialActive: false, tutorialStep: 0, tutorialReplayMode: false,
          currentRoom: 'room_working',
          energy: MAX_ENERGY, maxEnergy: MAX_ENERGY, mood: DEFAULT_MOOD, maxMood: MAX_MOOD,
          discoveredZones: [], unlockedRooms: ['room_working'], unlockedFeatures: [],
          mainlineStep: 'intro', storyDialog: null, forestAnimals: [],
          onboardingActive: false, onboardingStep: 0, activeHint: null, completedHints: [],
        });
      },

      setScreen: (screen) => set({ screen }),
      switchRoom: (room) => {
        if (!get().unlockedRooms.includes(room)) return;
        const state = get();
        const completedHints = room === 'room_living'
          ? addHint(state.completedHints, 'tab_living')
          : room === 'outdoor_forest'
            ? addHint(state.completedHints, 'tab_forest')
            : state.completedHints;
        set({
          currentRoom: room,
          completedHints,
          activeHint: state.activeHint === 'tab_living' || state.activeHint === 'tab_forest' ? null : state.activeHint,
        });
      },
      setPetState: (petState) => set({ petState }),

      tickPetState: () => {
        const s = get();
        if (s.missyState || isMidnightMode()) return;
        if (s.tempBuff.forcedSleep && Date.now() < s.tempBuff.forcedSleep.expiresAt) return;
        set({ petState: randomPick(ACTIVE_PET_STATES) });
      },

      clearPendingOffline: () => set({ pendingOffline: null }),
      addShards: (amount) => set({ shards: get().shards + amount }),

      addCollectible: (id) => {
        const state = get();
        if (state.collectibles.includes(id)) return;
        const collectibles = maybeGrantC015([...state.collectibles, id]);
        const achievements = checkCollectibleAchievements(collectibles, state.achievements);
        let unlockedFeatures = state.unlockedFeatures;
        let mainlineStep = state.mainlineStep;
        let storyDialog = state.storyDialog;

        if (!hasFeature(unlockedFeatures, 'collection')) {
          unlockedFeatures = addUnique(unlockedFeatures, 'collection');
          if (mainlineStep === 'forest') mainlineStep = 'atlas';
          storyDialog = MAINLINE_DIALOGS.atlas;
        }

        set({
          collectibles,
          achievements,
          unlockedFeatures,
          mainlineStep,
          storyDialog,
          activeHint: !state.completedHints.includes('collection') ? 'collection' : state.activeHint,
        });
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

      activateMusicBox: () => {
        const s = get();
        if (s.musicBoxUnlocked) return true;
        if (s.shards < MUSIC_BOX.costShards) return false;
        set({ shards: s.shards - MUSIC_BOX.costShards, musicBoxUnlocked: true });
        return true;
      },

      handleHotZone: (zoneId) => {
        const s = get();
        const daily = ensureDaily(s.daily);
        const zone = HOT_ZONES.find((item) => item.id === zoneId);
        if (!zone) return null;

        if (zone.room === 'outdoor_forest') {
          if (s.energy <= 0) {
            return { type: 'desktop_bubble', payload: { message: '体力耗尽了，先回卧室吃饭或睡觉恢复，再继续外出探索。', zoneId } };
          }
          return {
            type: 'forest_event',
            payload: {
              zoneId,
              unlocked: s.forestAnimals.includes(zoneId),
              animalId: FOREST_ANIMAL_BY_ZONE[zoneId]?.id,
            },
          };
        }

        if ((zoneId === 'L05' || zoneId === 'F05') && !hasFeature(s.unlockedFeatures, 'arcade')) {
          return { type: 'desktop_bubble', payload: { message: '娱乐模块还在校准中，先继续完善分身的生活环境吧。' } };
        }

        let shards = s.shards;
        let energy = s.energy;
        let unlockedRooms = s.unlockedRooms;
        let unlockedFeatures = s.unlockedFeatures;
        let mainlineStep = s.mainlineStep;
        let storyDialog = s.storyDialog;
        let discoveredZones = s.discoveredZones;
        let activeHint = s.activeHint;

        if (!zone.decorative && !discoveredZones.includes(zoneId)) {
          discoveredZones = [...discoveredZones, zoneId];
          shards += 1;
        }

        if (zone.room === 'room_working' && mainlineStep === 'intro') {
          unlockedRooms = addUnique(unlockedRooms, 'room_living');
          mainlineStep = 'bedroom';
          storyDialog = MAINLINE_DIALOGS.bedroom;
          activeHint = getNextActiveHint(s.completedHints, 'tab_living');
        }

        const commitProgress = (extra: Partial<GameState> = {}) => {
          set({
            shards,
            energy,
            unlockedRooms,
            unlockedFeatures,
            mainlineStep,
            storyDialog,
            discoveredZones,
            activeHint,
            ...extra,
          });
        };

        if (zoneId === 'W01' || zoneId === 'W02' || zoneId === 'F01') {
          commitProgress({ petState: 'S2', computerSessionEnd: Date.now() + 10000, daily });
          return { type: 'computer', payload: { zoneId, nightDebug: isMidnightMode() } };
        }
        if (zoneId === 'L01' || zoneId === 'F02') {
          if (s.missyState) return null;
          energy = s.maxEnergy;
          if (zone.room === 'room_living' && mainlineStep === 'bedroom') {
            unlockedRooms = addUnique(unlockedRooms, 'outdoor_forest');
            mainlineStep = 'forest';
            storyDialog = MAINLINE_DIALOGS.forest;
            activeHint = getNextActiveHint(s.completedHints, 'tab_forest');
          }
          commitProgress({ petState: 'S3', tempBuff: { forcedSleep: { expiresAt: Date.now() + 5 * 60 * 1000 } }, daily });
          return { type: 'bed', payload: { zoneId } };
        }
        if (zoneId === 'L04' || zoneId === 'F03') {
          if (zone.room === 'room_living' && mainlineStep === 'bedroom') {
            unlockedRooms = addUnique(unlockedRooms, 'outdoor_forest');
            mainlineStep = 'forest';
            storyDialog = MAINLINE_DIALOGS.forest;
            activeHint = getNextActiveHint(s.completedHints, 'tab_forest');
          }
          if (zone.room === 'room_living') energy = Math.min(s.maxEnergy, energy + 2);
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
            commitProgress({ petState: 'S5', tempBuff: buff, daily });
            setTimeout(() => { if (get().petState === 'S5') get().setPetState('S1'); }, 3000);
            return { type: 'fridge', payload: { result, zoneId } };
          }
          commitProgress({ tempBuff: buff, daily });
          return { type: 'fridge', payload: { result, zoneId } };
        }
        if (zoneId === 'L05' || zoneId === 'F05') {
          commitProgress({ screen: 'arcade', returnRoom: s.currentRoom, daily });
          return { type: 'arcade' };
        }
        if (zoneId === 'L06' || zoneId === 'F04') {
          if (daily.trashSearchCount >= 3) return { type: 'trash', payload: { limit: true, message: '今日翻找次数已达上限。' } };
          daily.trashSearchCount += 1;
          commitProgress({ daily });
          const unownedA = A_CLASS.filter((id) => !s.collectibles.includes(id));
          if (unownedA.length === 0) return { type: 'trash', payload: { empty: true, message: '只剩电子灰尘了。' } };
          if (Math.random() < 0.2) {
            commitProgress({ petState: 'S5', daily });
            setTimeout(() => { if (get().petState === 'S5') get().setPetState('S1'); }, 3000);
            return { type: 'trash', payload: { miss: true } };
          }
          const found = pickTrashCollectible(s.collectibles)!;
          get().addCollectible(found);
          return { type: 'trash', payload: { collectibleId: found, zoneId } };
        }
        if (zoneId === 'W04') {
          commitProgress({ daily });
          return { type: 'desktop_bubble', payload: { message: '这里暂时什么都没有。' } };
        }

        const furniture = getFurnitureByHotZoneId(zoneId);
        if (furniture) {
          if (!s.furniture.includes(furniture.id)) {
            commitProgress({ daily });
            return { type: 'furniture_unlock', payload: { furnitureId: furniture.id, cost: furniture.cost, name: furniture.name } };
          }
          commitProgress({ daily });
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
        commitProgress({ daily });
        return null;
      },

      handlePetClick: () => {
        const s = get();
        const now = Date.now();
        const daily = ensureDaily(s.daily);
        if ((isForcedSleepActive(s.tempBuff) || isMidnightMode()) && s.petState === 'S3' && !s.missyState) {
          return { type: 'wake_confirm' };
        }
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

      confirmWake: () => {
        const { forcedSleep, ...restBuff } = get().tempBuff;
        void forcedSleep;
        set({ petState: 'S1', tempBuff: restBuff });
      },
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

      startTutorial: () => set({
        tutorialActive: true,
        tutorialStep: 0,
        tutorialCompleted: false,
        tutorialReplayMode: true,
        showWelcomeModal: false,
      }),

      nextTutorialStep: () => {
        const { tutorialStep } = get();
        if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
          set({
            tutorialActive: false,
            tutorialCompleted: true,
            tutorialStep: 0,
            tutorialReplayMode: false,
            showWelcomeModal: false,
          });
        } else {
          set({ tutorialStep: tutorialStep + 1 });
        }
      },

      skipTutorial: () => set({
        tutorialActive: false,
        tutorialCompleted: true,
        tutorialStep: 0,
        tutorialReplayMode: false,
        showWelcomeModal: false,
      }),
      dismissWelcomeModal: () => set({ showWelcomeModal: false, onboardingActive: true, onboardingStep: 0 }),
      beginTutorialFromWelcome: () => set({ showWelcomeModal: false, onboardingActive: true, onboardingStep: 0 }),
      dismissStoryDialog: () => set({ storyDialog: null }),
      recordArcadePlay: (mode) => {
        const state = get();
        let unlockedFeatures = state.unlockedFeatures;
        let mainlineStep = state.mainlineStep;
        let storyDialog = state.storyDialog;
        let activeHint = state.activeHint;
        let completedHints = state.completedHints;

        if (mode === 'coin' && !hasFeature(unlockedFeatures, 'claw')) {
          unlockedFeatures = addUnique(unlockedFeatures, 'claw');
          if (mainlineStep === 'arcade') mainlineStep = 'claw';
          storyDialog = MAINLINE_DIALOGS.claw;
          activeHint = getNextActiveHint(completedHints, 'arcade_claw');
        } else if (mode === 'claw' && mainlineStep === 'claw') {
          mainlineStep = 'free';
          storyDialog = MAINLINE_DIALOGS.free;
        }

        completedHints = addHint(completedHints, mode === 'coin' ? 'arcade_coin' : 'arcade_claw');
        if (mode === 'coin' && activeHint === 'arcade_coin') activeHint = null;
        if (mode === 'claw' && activeHint === 'arcade_claw') activeHint = null;

        set({
          mood: Math.min(state.maxMood, state.mood + 1),
          unlockedFeatures,
          mainlineStep,
          storyDialog,
          completedHints,
          activeHint,
        });
      },
      unlockForestAnimal: (zoneId) => {
        const state = get();
        const animal = FOREST_ANIMAL_BY_ZONE[zoneId];
        if (!animal) return { success: false, reward: 0, alreadyUnlocked: false };
        if (state.forestAnimals.includes(zoneId)) return { success: true, reward: 0, alreadyUnlocked: true };

        const forestAnimals = [...state.forestAnimals, zoneId];
        const discoveredZones = addUnique(state.discoveredZones, zoneId);
        let unlockedFeatures = state.unlockedFeatures;
        let mainlineStep = state.mainlineStep;
        let storyDialog = state.storyDialog;
        let activeHint = state.activeHint;
        const completedHints = addHint(state.completedHints, 'forest_interact');

        if (!hasFeature(unlockedFeatures, 'collection')) {
          unlockedFeatures = addUnique(unlockedFeatures, 'collection');
          if (mainlineStep === 'forest') mainlineStep = 'atlas';
          storyDialog = MAINLINE_DIALOGS.atlas;
          activeHint = getNextActiveHint(completedHints, 'collection');
        }

        if (forestAnimals.length >= 3 && !hasFeature(unlockedFeatures, 'arcade')) {
          unlockedFeatures = addUnique(addUnique(unlockedFeatures, 'arcade'), 'coin');
          if (mainlineStep === 'forest' || mainlineStep === 'atlas') mainlineStep = 'arcade';
          storyDialog = MAINLINE_DIALOGS.arcade;
          activeHint = getNextActiveHint(completedHints, 'arcade_entry');
        }

        set({
          forestAnimals,
          discoveredZones,
          energy: Math.max(0, state.energy - 1),
          mood: Math.min(state.maxMood, state.mood + 1),
          shards: state.shards + animal.rewardShards,
          unlockedFeatures,
          mainlineStep,
          storyDialog,
          completedHints,
          activeHint: state.activeHint === 'forest_interact' ? null : activeHint,
        });
        return { success: true, reward: animal.rewardShards, alreadyUnlocked: false };
      },
      startOnboarding: () => set({ onboardingActive: true, onboardingStep: 0 }),
      advanceOnboarding: () => {
        const state = get();
        if (state.onboardingStep >= 3) {
          set({
            onboardingActive: false,
            onboardingStep: 0,
            activeHint: getNextActiveHint(state.completedHints, 'pet') ?? state.activeHint,
          });
          return;
        }
        set({ onboardingStep: state.onboardingStep + 1 });
      },
      dismissOnboarding: () => set({ onboardingActive: false, onboardingStep: 0 }),
      completeHint: (key) => {
        const state = get();
        set({
          completedHints: addHint(state.completedHints, key),
          activeHint: state.activeHint === key ? null : state.activeHint,
        });
      },
      dismissActiveHint: () => set({ activeHint: null }),
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
