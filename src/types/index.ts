export type Screen = 'mapping' | 'room' | 'arcade';

export type RoomId = 'room_working' | 'room_living' | 'outdoor_forest';
export type FeatureUnlock = 'collection' | 'arcade' | 'coin' | 'claw';
export type MainlineStep = 'intro' | 'bedroom' | 'forest' | 'atlas' | 'arcade' | 'claw' | 'free';
export type HintKey =
  | 'pet'
  | 'tab_living'
  | 'tab_forest'
  | 'collection'
  | 'forest_interact'
  | 'arcade_entry'
  | 'arcade_coin'
  | 'arcade_claw';

export type PetState = 'S1' | 'S2' | 'S3' | 'S4' | 'S5';

export type SkinTone = 'light' | 'standard' | 'dark';
export type HairColor = 'light' | 'dark';

export interface AvatarAppearance {
  clothingColor: string;
  skinTone: SkinTone;
  hairColor: HairColor;
  isDefault: boolean;
}

export interface AvatarProfile {
  nickname: string;
  fullTitle: string;
  titleExplanation: string;
  prefix: string;
  title: string;
  appearance: AvatarAppearance;
  isAbnormal: boolean;
  isHiddenArchitect: boolean;
  isDefaultVisitor: boolean;
}

export interface TempBuff {
  speedBoost?: { expiresAt: number; multiplier: number };
  keyboardBoost?: { expiresAt: number; multiplier: number };
  forcedSleep?: { expiresAt: number };
  glitch?: { expiresAt: number };
}

export interface OfflineResult {
  tier: 'T0' | 'T1' | 'T2' | 'T3' | 'anomaly' | null;
  shards: number;
  collectibleId?: string;
  message: string;
  unlockCat?: boolean;
  missyState?: boolean;
}

export interface HotZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  room: RoomId;
  disabledInNightDebug?: boolean;
  decorative?: boolean;
  decorativeMessage?: string;
}

export interface CollectibleDef {
  id: string;
  name: string;
  description: string;
  category: 'A' | 'B' | 'C';
  icon: string;
}

export interface FurnitureDef {
  id: string;
  name: string;
  cost: number;
  room: RoomId;
  hotZoneId: string;
  icon: string;
  overlayTitle: string;
}

export interface DailyStats {
  date: string;
  trashSearchCount: number;
  randomEventCount: number;
  easterEggTriggered: boolean;
}

export interface StoryDialog {
  id: string;
  speaker: string;
  title: string;
  body: string;
  hint?: string;
}

export interface GameState {
  hasCompletedMapping: boolean;
  profile: AvatarProfile | null;
  shards: number;
  collectibles: string[];
  furniture: string[];
  achievements: string[];
  catUnlocked: boolean;
  currentRoom: RoomId;
  petState: PetState;
  missyState: boolean;
  missyClicks: number;
  lastMissyClickAt: number;
  petClickCount: number;
  petClickWindowStart: number;
  lastExitAt: number | null;
  daily: DailyStats;
  tempBuff: TempBuff;
  pendingOffline: OfflineResult | null;
  showRandomEvent: string | null;
  computerSessionEnd: number | null;
  screen: Screen;
  returnRoom: RoomId | null;
  tutorialCompleted: boolean;
  tutorialActive: boolean;
  tutorialStep: number;
  showWelcomeModal: boolean;
  energy: number;
  maxEnergy: number;
  mood: number;
  maxMood: number;
  discoveredZones: string[];
  unlockedRooms: RoomId[];
  unlockedFeatures: FeatureUnlock[];
  mainlineStep: MainlineStep;
  storyDialog: StoryDialog | null;
  forestAnimals: string[];
  onboardingActive: boolean;
  onboardingStep: number;
  activeHint: HintKey | null;
  completedHints: HintKey[];
}
