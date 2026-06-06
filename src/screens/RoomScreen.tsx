import { useEffect, useState, useCallback, useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { HOT_ZONES, ROOM_BACKGROUNDS, PET_STAND_POINTS, ROOM_TABS } from '@/data/hotzones';
import { getCollectible } from '@/data/collectibles';
import { useGameStore, finalizeComputerInteraction } from '@/store/gameStore';
import { isMidnightMode } from '@/utils/time';
import { debounceAction } from '@/utils/debounce';
import { getSkinFilter, getHairFilter } from '@/utils/colorMapping';
import { fetchRandomMood } from '@/services/aiFeatures';
import { isAiConfigured } from '@/services/qwen';
import { getAiRemaining } from '@/utils/aiQuota';
import { RANDOM_EVENTS } from '@/data/titles';
import { randomPick } from '@/utils/time';
import { Overlay, Toast } from '@/components/Overlay';
import { TypewriterText } from '@/components/TypewriterText';
import { CollectionPanel } from '@/components/CollectionPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { GuideBook } from '@/components/GuideBook';
import { TutorialGuide, WelcomeModal } from '@/components/TutorialGuide';
import { PetChatPanel } from '@/components/PetChatPanel';
import { InteractionOverlay } from '@/components/InteractionOverlay';
import type { HintKey, RoomId } from '@/types';

interface ActiveOverlay { type: string; payload?: Record<string, unknown>; }
const PET_SIZE_PX = 96;
const PET_MOVE_SPEED_PX = 90;
const PET_LONG_PRESS_MS = 240;
const PET_DOUBLE_TAP_MS = 260;
type OnboardingTarget = 'pet' | 'tabs' | 'collection' | 'hotzone';
interface Point { x: number; y: number; }

const PET_EMOTICONS = ['(≧▽≦)', '(｡>ω<｡)', '(๑>◡<๑)', '(˶ˆᗜˆ˵)', '(づ｡◕‿‿◕｡)づ', '(ฅ^oωo^ ฅ)', '(｡･ω･｡)', '(◕‿◕✿)', '(っ˘ω˘ς )', '(*^▽^*)'];
const PET_GREETINGS = [
  '今天也要一起发光呀。',
  '你来啦，我一直在等你。',
  '摸摸头，今天也辛苦啦。',
  '我们一起把房间照顾好吧。',
  '看到你，我的心情就变好了。',
  '要不要先陪我走两步呀。',
  '嘿嘿，我今天状态很不错。',
  '欢迎回来，先休息一下吧。',
  '有你在，这里就更温暖了。',
  '准备好继续冒险了吗？',
];

const INDOOR_FLOOR_POLYGON: Point[] = [
  { x: 8, y: 77 },
  { x: 44, y: 54 },
  { x: 90, y: 71 },
  { x: 55, y: 94 },
];

const ROOM_MOVEMENT_AREAS: Record<RoomId, Point[]> = {
  room_working: INDOOR_FLOOR_POLYGON,
  room_living: INDOOR_FLOOR_POLYGON,
  outdoor_forest: [
    { x: 50, y: 10 },
    { x: 86, y: 28 },
    { x: 86, y: 80 },
    { x: 50, y: 92 },
    { x: 14, y: 80 },
    { x: 14, y: 28 },
  ],
};

const ACTIVE_HINT_COPY: Record<HintKey, string> = {
  pet: '点一下赛博分身，它会给你即时反馈。',
  tab_living: '生活区已解锁，先过去补充体力，稳定分身状态。',
  tab_forest: '数据林海已开放，去户外记录生物会消耗体力。',
  collection: '图鉴开始记录了，右下角可以查看赛博藏品和林海图鉴。',
  forest_interact: '林海里发光的区域都能探索，首次记录会更新图鉴。',
  arcade_entry: '娱乐模块已上线，去街机大厅玩一局可以提升心情。',
  arcade_coin: '先从推币机开始，完成一局后会开放抓娃娃机。',
  arcade_claw: '抓娃娃机已开放，回街机大厅试试新的高回报机器。',
};

const ONBOARDING_STEPS: Array<{
  title: string;
  body: string;
  target: OnboardingTarget;
  hotZoneId?: string;
  room?: RoomId;
}> = [
  {
    title: '先点场景里的交互区',
    body: '透明热区就是当前房间的操作入口。先从电脑开始，主线和房间解锁都会往前推进。',
    target: 'hotzone',
    hotZoneId: 'W01',
    room: 'room_working',
  },
  {
    title: '分身本体也能互动',
    body: '点一下房间里的分身会得到反馈，连续点太多还会触发隐藏彩蛋。',
    target: 'pet',
  },
  {
    title: '底部标签负责切场景',
    body: '新房间和新场景解锁后，底部标签会亮起并出现短提示，跟着它切换就不会迷路。',
    target: 'tabs',
  },
  {
    title: '右下角会记录收集',
    body: '图鉴和收藏柜开放后，从右下角进入查看赛博藏品和林海记录。',
    target: 'collection',
  },
];

function getOnboardingHighlight(
  step: (typeof ONBOARDING_STEPS)[number] | undefined,
  currentRoom: RoomId,
  petPos: { x: number; y: number },
) {
  if (!step) return null;
  if (step.target === 'pet') return { x: petPos.x - 6, y: petPos.y - 8, w: 14, h: 16 };
  if (step.target === 'tabs') return { x: 29, y: 87, w: 42, h: 12 };
  if (step.target === 'collection') return { x: 82, y: 82, w: 16, h: 16 };
  if (step.target === 'hotzone' && step.hotZoneId && step.room === currentRoom) {
    const zone = HOT_ZONES.find((item) => item.id === step.hotZoneId);
    if (!zone) return null;
    return { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
  }
  return null;
}

function isPointInsidePolygon(point: Point, polygon: Point[]) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect = ((yi > point.y) !== (yj > point.y))
      && (point.x < ((xj - xi) * (point.y - yi)) / ((yj - yi) || 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function getClosestPointOnSegment(point: Point, start: Point, end: Point): Point {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return start;

  const t = Math.max(0, Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared));
  return {
    x: start.x + dx * t,
    y: start.y + dy * t,
  };
}

function projectPointToPolygon(point: Point, polygon: Point[]) {
  let bestPoint = polygon[0];
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let i = 0; i < polygon.length; i += 1) {
    const start = polygon[i];
    const end = polygon[(i + 1) % polygon.length];
    const candidate = getClosestPointOnSegment(point, start, end);
    const distance = Math.hypot(candidate.x - point.x, candidate.y - point.y);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestPoint = candidate;
    }
  }

  return bestPoint;
}

export function RoomScreen() {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const shards = useGameStore((s) => s.shards);
  const energy = useGameStore((s) => s.energy);
  const maxEnergy = useGameStore((s) => s.maxEnergy);
  const mood = useGameStore((s) => s.mood);
  const maxMood = useGameStore((s) => s.maxMood);
  const petState = useGameStore((s) => s.petState);
  const profile = useGameStore((s) => s.profile);
  const catUnlocked = useGameStore((s) => s.catUnlocked);
  const missyState = useGameStore((s) => s.missyState);
  const showRandomEvent = useGameStore((s) => s.showRandomEvent);
  const pendingOffline = useGameStore((s) => s.pendingOffline);
  const collectibles = useGameStore((s) => s.collectibles);
  const furniture = useGameStore((s) => s.furniture);
  const discoveredZones = useGameStore((s) => s.discoveredZones);
  const forestAnimals = useGameStore((s) => s.forestAnimals);
  const unlockedRooms = useGameStore((s) => s.unlockedRooms);
  const unlockedFeatures = useGameStore((s) => s.unlockedFeatures);
  const storyDialog = useGameStore((s) => s.storyDialog);
  const tutorialActive = useGameStore((s) => s.tutorialActive);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const showWelcomeModal = useGameStore((s) => s.showWelcomeModal);
  const onboardingActive = useGameStore((s) => s.onboardingActive);
  const onboardingStep = useGameStore((s) => s.onboardingStep);
  const activeHint = useGameStore((s) => s.activeHint);
  const completedHints = useGameStore((s) => s.completedHints);
  const tempBuff = useGameStore((s) => s.tempBuff);

  const switchRoom = useGameStore((s) => s.switchRoom);
  const handleHotZone = useGameStore((s) => s.handleHotZone);
  const handlePetClick = useGameStore((s) => s.handlePetClick);
  const confirmWake = useGameStore((s) => s.confirmWake);
  const tickPetState = useGameStore((s) => s.tickPetState);
  const clearPendingOffline = useGameStore((s) => s.clearPendingOffline);
  const triggerRandomEventOnEnter = useGameStore((s) => s.triggerRandomEventOnEnter);
  const setRandomEventMessage = useGameStore((s) => s.setRandomEventMessage);
  const unlockFurniture = useGameStore((s) => s.unlockFurniture);
  const addShards = useGameStore((s) => s.addShards);
  const resetForRemapping = useGameStore((s) => s.resetForRemapping);
  const nextTutorialStep = useGameStore((s) => s.nextTutorialStep);
  const skipTutorial = useGameStore((s) => s.skipTutorial);
  const beginTutorialFromWelcome = useGameStore((s) => s.beginTutorialFromWelcome);
  const dismissWelcomeModal = useGameStore((s) => s.dismissWelcomeModal);
  const dismissStoryDialog = useGameStore((s) => s.dismissStoryDialog);
  const startTutorial = useGameStore((s) => s.startTutorial);
  const unlockForestAnimal = useGameStore((s) => s.unlockForestAnimal);
  const advanceOnboarding = useGameStore((s) => s.advanceOnboarding);
  const dismissOnboarding = useGameStore((s) => s.dismissOnboarding);
  const completeHint = useGameStore((s) => s.completeHint);
  const dismissActiveHint = useGameStore((s) => s.dismissActiveHint);

  const [overlay, setOverlay] = useState<ActiveOverlay | null>(null);
  const [showCollection, setShowCollection] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGuideBook, setShowGuideBook] = useState(false);
  const [showPetChat, setShowPetChat] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [wakeConfirm, setWakeConfirm] = useState(false);
  const [errorPopup, setErrorPopup] = useState(false);
  const [fallingChars, setFallingChars] = useState<{ char: string; id: number }[]>([]);
  const [petPos, setPetPos] = useState<{ x: number; y: number }>(PET_STAND_POINTS[currentRoom]);
  const [petTarget, setPetTarget] = useState<{ x: number; y: number }>(PET_STAND_POINTS[currentRoom]);
  const [petDragging, setPetDragging] = useState(false);
  const [petJumping, setPetJumping] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [slideAnim, setSlideAnim] = useState('');
  const charCounter = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const petLongPressTimerRef = useRef<number | null>(null);
  const petTapTimerRef = useRef<number | null>(null);
  const petBubbleTimerRef = useRef<number | null>(null);
  const petJumpTimerRef = useRef<number | null>(null);
  const petPointerIdRef = useRef<number | null>(null);
  const draggingPetRef = useRef(false);
  const nightDebug = isMidnightMode();
  const aiOn = isAiConfigured();
  const forcedSleepActive = !!tempBuff.forcedSleep && Date.now() < tempBuff.forcedSleep.expiresAt;
  const showSleepBadge = petState === 'S3' && !missyState && (forcedSleepActive || nightDebug);

  const clampPetPos = useCallback((pos: { x: number; y: number }) => {
    if (!stageSize.width || !stageSize.height) return pos;
    const maxX = Math.max(0, 100 - (PET_SIZE_PX / stageSize.width) * 100);
    const maxY = Math.max(0, 100 - (PET_SIZE_PX / stageSize.height) * 100);
    return {
      x: Math.min(Math.max(pos.x, 0), maxX),
      y: Math.min(Math.max(pos.y, 0), maxY),
    };
  }, [stageSize.height, stageSize.width]);

  const clampPetToPlayableArea = useCallback((pos: { x: number; y: number }) => {
    const stageClamped = clampPetPos(pos);
    if (!stageSize.width || !stageSize.height) return stageClamped;

    const polygon = ROOM_MOVEMENT_AREAS[currentRoom];
    if (!polygon) return stageClamped;

    const footPoint = {
      x: stageClamped.x + ((PET_SIZE_PX * 0.5) / stageSize.width) * 100,
      y: stageClamped.y + ((PET_SIZE_PX * 0.94) / stageSize.height) * 100,
    };

    if (isPointInsidePolygon(footPoint, polygon)) return stageClamped;

    const projectedFootPoint = projectPointToPolygon(footPoint, polygon);
    return clampPetPos({
      x: projectedFootPoint.x - ((PET_SIZE_PX * 0.5) / stageSize.width) * 100,
      y: projectedFootPoint.y - ((PET_SIZE_PX * 0.94) / stageSize.height) * 100,
    });
  }, [clampPetPos, currentRoom, stageSize.height, stageSize.width]);

  const getStagePetPosFromClient = useCallback((clientX: number, clientY: number) => {
    if (!stageRef.current) return null;
    const rect = stageRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    const targetX = ((clientX - rect.left) / rect.width) * 100 - ((PET_SIZE_PX * 0.5) / rect.width) * 100;
    const targetY = ((clientY - rect.top) / rect.height) * 100 - ((PET_SIZE_PX * 0.78) / rect.height) * 100;
    return clampPetToPlayableArea({ x: targetX, y: targetY });
  }, [clampPetToPlayableArea]);

  useEffect(() => {
    if (!stageRef.current) return;
    const updateSize = () => {
      if (!stageRef.current) return;
      setStageSize({
        width: stageRef.current.clientWidth,
        height: stageRef.current.clientHeight,
      });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stageRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (tutorialActive) return;
    if (triggerRandomEventOnEnter()) {
      if (aiOn && getAiRemaining() > 0) {
        fetchRandomMood(profile).then(setRandomEventMessage);
      } else {
        setRandomEventMessage(randomPick(RANDOM_EVENTS));
      }
    }
  }, [triggerRandomEventOnEnter, setRandomEventMessage, profile, tutorialActive, aiOn]);

  useEffect(() => { const t = setInterval(() => tickPetState(), 45000); return () => clearInterval(t); }, [tickPetState]);
  useEffect(() => {
    const standPoint = clampPetToPlayableArea(PET_STAND_POINTS[currentRoom]);
    setPetPos(standPoint);
    setPetTarget(standPoint);
  }, [petState, currentRoom, clampPetToPlayableArea]);
  useEffect(() => {
    if (!missyState) return;
    const missyPos = clampPetToPlayableArea({ x: 18, y: 42 });
    setPetPos(missyPos);
    setPetTarget(missyPos);
  }, [missyState, clampPetToPlayableArea]);
  useEffect(() => {
    setPetPos((prev) => clampPetToPlayableArea(prev));
    setPetTarget((prev) => clampPetToPlayableArea(prev));
  }, [clampPetToPlayableArea]);
  useEffect(() => {
    if (draggingPetRef.current || missyState) return undefined;
    let frameId = 0;
    let lastTs = 0;

    const moveStep = (ts: number) => {
      if (!lastTs) lastTs = ts;
      const deltaSec = (ts - lastTs) / 1000;
      lastTs = ts;

      setPetPos((prev) => {
        const dxPx = ((petTarget.x - prev.x) / 100) * stageSize.width;
        const dyPx = ((petTarget.y - prev.y) / 100) * stageSize.height;
        const distancePx = Math.hypot(dxPx, dyPx);
        if (distancePx <= 1) return petTarget;

        const stepPx = PET_MOVE_SPEED_PX * deltaSec;
        const ratio = Math.min(1, stepPx / distancePx);

        return clampPetToPlayableArea({
          x: prev.x + (petTarget.x - prev.x) * ratio,
          y: prev.y + (petTarget.y - prev.y) * ratio,
        });
      });

      frameId = window.requestAnimationFrame(moveStep);
    };

    frameId = window.requestAnimationFrame(moveStep);
    return () => window.cancelAnimationFrame(frameId);
  }, [clampPetPos, clampPetToPlayableArea, missyState, petTarget, stageSize.height, stageSize.width]);
  useEffect(() => {
    if (overlay?.type === 'computer') {
      const iv = setInterval(() => {
        charCounter.current += 1;
        setFallingChars((p) => [...p.slice(-10), { char: charCounter.current % 2 === 0 ? '1' : '0', id: Date.now() }]);
      }, 1000);
      return () => clearInterval(iv);
    }
    setFallingChars([]);
  }, [overlay?.type]);
  useEffect(() => () => {
    if (petTapTimerRef.current) window.clearTimeout(petTapTimerRef.current);
    if (petBubbleTimerRef.current) window.clearTimeout(petBubbleTimerRef.current);
    if (petJumpTimerRef.current) window.clearTimeout(petJumpTimerRef.current);
  }, []);

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);

  const showPetBubble = useCallback((text: string, duration = 2600) => {
    setBubble(text);
    if (petBubbleTimerRef.current) window.clearTimeout(petBubbleTimerRef.current);
    petBubbleTimerRef.current = window.setTimeout(() => setBubble(null), duration);
  }, []);

  const handlePetInteract = useCallback(() => {
    if (tutorialActive || onboardingActive) return;
    completeHint('pet');
    const r = handlePetClick();
    if (!r) return;
    if (r.type === 'wake_confirm') setWakeConfirm(true);
    else if (r.type === 'missy_complete') { showPetBubble(r.message ?? '', 5000); }
    else if (r.type === 'easter_egg') { setErrorPopup(true); showToast('成就解锁：异常抛出者'); }
    else if (r.message) { showPetBubble(r.message, 3000); }
  }, [completeHint, handlePetClick, onboardingActive, showPetBubble, showToast, tutorialActive]);

  const triggerPetDoubleTapEffect = useCallback(() => {
    const effectType = Math.floor(Math.random() * 3);
    if (effectType === 0) {
      showPetBubble(randomPick(PET_EMOTICONS), 2200);
      return;
    }
    if (effectType === 1) {
      setPetJumping(false);
      if (petJumpTimerRef.current) window.clearTimeout(petJumpTimerRef.current);
      window.requestAnimationFrame(() => setPetJumping(true));
      petJumpTimerRef.current = window.setTimeout(() => setPetJumping(false), 620);
      return;
    }
    showPetBubble(randomPick(PET_GREETINGS), 3200);
  }, [showPetBubble]);

  const handleStageClick = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (tutorialActive || onboardingActive || missyState || draggingPetRef.current) return;
    const target = event.target as HTMLElement;
    if (target.closest('.hotzone') || target.closest('.pet-layer')) return;
    const nextPos = getStagePetPosFromClient(event.clientX, event.clientY);
    if (!nextPos) return;
    setPetTarget(nextPos);
  }, [getStagePetPosFromClient, missyState, onboardingActive, tutorialActive]);

  const clearPetLongPress = useCallback(() => {
    if (petLongPressTimerRef.current) {
      window.clearTimeout(petLongPressTimerRef.current);
      petLongPressTimerRef.current = null;
    }
  }, []);

  const handlePetPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (tutorialActive || onboardingActive || missyState) return;
    event.stopPropagation();
    clearPetLongPress();
    petPointerIdRef.current = event.pointerId;
    petLongPressTimerRef.current = window.setTimeout(() => {
      draggingPetRef.current = true;
      setPetDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }, PET_LONG_PRESS_MS);
  }, [clearPetLongPress, missyState, onboardingActive, tutorialActive]);

  const handlePetPointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingPetRef.current) return;
    event.stopPropagation();
    const nextPos = getStagePetPosFromClient(event.clientX, event.clientY);
    if (!nextPos) return;
    setPetPos(nextPos);
    setPetTarget(nextPos);
  }, [getStagePetPosFromClient]);

  const finishPetPointer = useCallback((event: ReactPointerEvent<HTMLDivElement>, treatAsTap: boolean) => {
    event.stopPropagation();
    clearPetLongPress();

    if (draggingPetRef.current) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      draggingPetRef.current = false;
      petPointerIdRef.current = null;
      setPetDragging(false);
      return;
    }

    petPointerIdRef.current = null;
    if (!treatAsTap) return;

    if (petTapTimerRef.current) {
      window.clearTimeout(petTapTimerRef.current);
      petTapTimerRef.current = null;
      triggerPetDoubleTapEffect();
      return;
    }

    petTapTimerRef.current = window.setTimeout(() => {
      petTapTimerRef.current = null;
      handlePetInteract();
    }, PET_DOUBLE_TAP_MS);
  }, [clearPetLongPress, handlePetInteract, triggerPetDoubleTapEffect]);

  const onZoneClick = (zoneId: string, decorative?: boolean) => {
    if (tutorialActive || onboardingActive) return;
    const zone = HOT_ZONES.find((z) => z.id === zoneId);
    if (decorative) {
      if (zone?.room === 'outdoor_forest' && zone.decorativeMessage) {
        setOverlay({ type: 'desktop_bubble', payload: { message: zone.decorativeMessage, zoneId } });
        return;
      }
      const kind = zoneId === 'L07' ? 'window' : 'plant';
      setOverlay({ type: 'ai_whisper', payload: { kind } });
      return;
    }
    if (zone?.disabledInNightDebug && nightDebug) return;
    const result = handleHotZone(zoneId);
    if (result) {
      if (result.type === 'arcade') completeHint('arcade_entry');
      setOverlay(result);
    }
  };

  const closeOverlay = () => {
    if (overlay?.type === 'computer' && finalizeComputerInteraction()) showToast('获得藏品：神秘磁盘！');
    setOverlay(null);
    setFallingChars([]);
  };

  const switchRoomWithAnim = (room: typeof currentRoom) => {
    if (room === currentRoom || !debounceAction('room-tab', 500)) return;
    const currentIndex = ROOM_TABS.findIndex((tab) => tab.id === currentRoom);
    const nextIndex = ROOM_TABS.findIndex((tab) => tab.id === room);
    setSlideAnim(nextIndex > currentIndex ? 'slide-left' : 'slide-right');
    switchRoom(room);
    setTimeout(() => setSlideAnim(''), 300);
  };

  const zones = HOT_ZONES.filter((z) => z.room === currentRoom);
  const completedHintSet = new Set(completedHints);
  const onboardingCurrent = ONBOARDING_STEPS[onboardingStep];
  const onboardingHighlight = getOnboardingHighlight(onboardingCurrent, currentRoom, petPos);
  const hintMessage = activeHint && !completedHintSet.has(activeHint) ? ACTIVE_HINT_COPY[activeHint] : null;
  const forestHintZoneId = currentRoom === 'outdoor_forest'
    ? zones.find((zone) => !zone.decorative && !forestAnimals.includes(zone.id))?.id ?? null
    : null;
  const sceneProgressTotal = currentRoom === 'outdoor_forest' ? 10 : zones.length;
  const sceneProgressDone = currentRoom === 'outdoor_forest'
    ? forestAnimals.length
    : zones.filter((zone) => discoveredZones.includes(zone.id)).length;
  const sceneProgress = sceneProgressTotal > 0 ? Math.round((sceneProgressDone / sceneProgressTotal) * 100) : 0;
  const shouldShowTutorialGuide = tutorialActive
    && !pendingOffline
    && completedHints.length === 0
    && discoveredZones.length === 0
    && unlockedRooms.length <= 1
    && collectibles.length === 0;
  const shouldShowOnboardingOverlay = onboardingActive
    && !!onboardingCurrent
    && !pendingOffline
    && completedHints.length === 0
    && discoveredZones.length === 0
    && unlockedRooms.length <= 1;

  const getZoneHintLabel = (zoneId: string) => {
    if ((zoneId === 'L05' || zoneId === 'F05') && unlockedFeatures.includes('arcade') && !completedHintSet.has('arcade_entry')) {
      return '新玩法';
    }
    if ((zoneId === 'L01' || zoneId === 'L04') && currentRoom === 'room_living' && energy < maxEnergy) {
      return '补体力';
    }
    return null;
  };

  return (
    <div className="room-scene">
      <div className="room-stage" ref={stageRef} onClick={handleStageClick}>
        <img src={ROOM_BACKGROUNDS[currentRoom]} alt="room" className={`room-bg ${nightDebug ? 'low-light-debug' : ''} ${slideAnim}`} />

        <div className="hotzone-layer">
          {zones.map((zone) => {
            const disabled = !!(zone.disabledInNightDebug && nightDebug);
            if (zone.id === 'L01' && missyState) return null;
            const zoneHintLabel = getZoneHintLabel(zone.id);
            return (
              <button
                key={zone.id}
                className={`hotzone ${disabled ? 'disabled' : ''} ${zoneHintLabel ? 'hinted' : ''} ${activeHint === 'arcade_entry' && (zone.id === 'L05' || zone.id === 'F05') ? 'hint-focus' : ''}`}
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
                onClick={() => onZoneClick(zone.id, zone.decorative)}
                aria-label={zone.label}
              >
                {zoneHintLabel && <span className="hint-badge hint-badge-hotzone">{zoneHintLabel}</span>}
              </button>
            );
          })}
        </div>

        <div
          className={`pet-layer ${petDragging ? 'dragging' : ''}`}
          style={{ left: `${petPos.x}%`, top: `${petPos.y}%` }}
          onPointerDown={handlePetPointerDown}
          onPointerMove={handlePetPointerMove}
          onPointerUp={(event) => finishPetPointer(event, true)}
          onPointerCancel={(event) => finishPetPointer(event, false)}
        >
          <div className={`pet-sprite ${petState === 'S5' ? 'glitching' : ''} ${petJumping ? 'pet-jumping' : ''}`}>
            <img src="/DOU/images/role/default.png" alt="pet" style={{ width: '100%', height: '100%',
              filter: profile ? `${getSkinFilter(profile.appearance.skinTone)} ${getHairFilter(profile.appearance.hairColor)}` : undefined }} />
            {missyState && <img src="/DOU/images/ui/pensive.png" alt="face" className="pet-face" />}
            {showSleepBadge && <span className="pet-state-badge">{forcedSleepActive ? '休息中' : '低光调试'}</span>}
            {missyState && <div className="pet-hearts">{[0,1,2].map((i) => <img key={i} src="/DOU/images/ui/heart.png" alt="heart" />)}</div>}
          </div>
          {catUnlocked && <img src="/DOU/images/pet/cat.png" alt="cat" className="pet-cat" />}
          {!completedHintSet.has('pet') && <span className="hint-badge hint-badge-pet">点我</span>}
        </div>

        {(showRandomEvent || bubble) && (
          <div className="bubble-text" style={{ top: `${petPos.y - 8}%`, left: `${petPos.x}%` }}>
            {showRandomEvent ? <TypewriterText text={showRandomEvent} speed={30} /> : bubble}
          </div>
        )}
      </div>

      <div className="ui-layer">
        <div className="mainline-hud">
          <div className="mainline-stat">
            <span className="mainline-stat-label">体力</span>
            <div className="mainline-pips">
              {Array.from({ length: maxEnergy }).map((_, i) => (
                <span key={`energy-${i}`} className={`mainline-pip ${i < energy ? 'active energy' : ''}`} />
              ))}
            </div>
          </div>
          <div className="mainline-stat">
            <span className="mainline-stat-label">心情</span>
            <div className="mainline-pips">
              {Array.from({ length: maxMood }).map((_, i) => (
                <span key={`mood-${i}`} className={`mainline-pip ${i < mood ? 'active mood' : ''}`} />
              ))}
            </div>
          </div>
          <div className="scene-progress">
            <div className="scene-progress-head">
              <span>{ROOM_TABS.find((tab) => tab.id === currentRoom)?.label ?? '当前场景'}</span>
              <span>{sceneProgressDone}/{sceneProgressTotal}</span>
            </div>
            <div className="scene-progress-track">
              <div className="scene-progress-fill" style={{ width: `${sceneProgress}%` }} />
            </div>
          </div>
        </div>
        {hintMessage && (
          <div className="floating-hint-card">
            <p>{hintMessage}</p>
            <button type="button" className="floating-hint-close" onClick={dismissActiveHint}>知道了</button>
          </div>
        )}
        <button type="button" className="ui-help-btn" onClick={() => setShowGuideBook(true)} aria-label="探索手册">?</button>
        {aiOn && (
          <button type="button" className="ui-neural-btn" onClick={() => { if (debounceAction('neural', 500)) setShowPetChat(true); }} title="神经链接">
            ⚡
          </button>
        )}
        <div className="shard-display">
          <img src="/DOU/images/ui/coin.png" alt="coin" /><span>{shards}</span>
          {aiOn && <span className="ai-badge">{getAiRemaining()}</span>}
        </div>
        <button className="ui-icon-btn ui-settings" onClick={() => { if (debounceAction('settings', 500)) setShowSettings(true); }} aria-label="设置">⚙</button>
        <div className="ui-folder-wrap">
          <img src="/DOU/images/ui/folder.png" alt="收藏柜" className="ui-icon-btn ui-folder"
            style={{ opacity: unlockedFeatures.includes('collection') ? 1 : 0.45 }}
            onClick={() => {
              if (!debounceAction('collection', 500)) return;
              if (!unlockedFeatures.includes('collection')) { showToast('先完成一次有效收集，图鉴才会开始记录。'); return; }
              completeHint('collection');
              setShowCollection(true);
            }} />
          {unlockedFeatures.includes('collection') && !completedHintSet.has('collection') && <span className="hint-badge hint-badge-ui">新图鉴</span>}
        </div>
        <div className="room-tabs">
          {ROOM_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`room-tab ${currentRoom === tab.id ? 'active' : ''}`}
              disabled={!unlockedRooms.includes(tab.id)}
              onClick={() => {
                if (!unlockedRooms.includes(tab.id)) { showToast('主线尚未推进到这里。'); return; }
                switchRoomWithAnim(tab.id);
              }}
            >
              {tab.label}
              {tab.id === 'room_living' && unlockedRooms.includes(tab.id) && !completedHintSet.has('tab_living') && <span className="hint-badge hint-badge-tab">去休整</span>}
              {tab.id === 'outdoor_forest' && unlockedRooms.includes(tab.id) && !completedHintSet.has('tab_forest') && <span className="hint-badge hint-badge-tab">去探索</span>}
            </button>
          ))}
        </div>
      </div>

      <InteractionOverlay
        overlay={overlay}
        onClose={closeOverlay}
        onUnlock={(id) => { if (unlockFurniture(id)) { showToast('家具解锁成功！'); closeOverlay(); } else showToast('数据碎片不足。'); }}
        shards={shards}
        collectibles={collectibles}
        profile={profile}
        nightDebug={nightDebug}
        fallingChars={fallingChars}
        onLoot={(n) => { addShards(n); showToast(`终端漏洞赏金 +${n} 碎片！`); }}
        forestAnimals={forestAnimals}
        onUnlockForestAnimal={(zoneId) => {
          const result = unlockForestAnimal(zoneId);
          if (result.success && !result.alreadyUnlocked) {
            completeHint('forest_interact');
            showToast(`林海图鉴更新 +${result.reward} 碎片`);
          }
          return result;
        }}
      />

      <Overlay open={!!pendingOffline} onClose={() => {
        if (pendingOffline?.tier === 'anomaly') { useGameStore.setState({ petState: 'S5' }); setTimeout(() => useGameStore.getState().setPetState('S1'), 5000); }
        clearPendingOffline();
      }}>
        {pendingOffline && (
          <>
            <h3 className="panel-title">{pendingOffline.tier === 'anomaly' ? '⚠ 时间异常' : '欢迎回来'}</h3>
            {pendingOffline.shards > 0 && <p style={{ textAlign: 'center', marginBottom: 12, color: '#ffd700' }}>+{pendingOffline.shards} 数据碎片</p>}
            {pendingOffline.collectibleId && <p style={{ textAlign: 'center', marginBottom: 12, color: '#00ffcc' }}>获得藏品：{getCollectible(pendingOffline.collectibleId)?.name}</p>}
            {pendingOffline.unlockCat && <p style={{ textAlign: 'center', marginBottom: 12, color: '#ff9966' }}>🐱 偷偷养的小猫已解锁！</p>}
            <TypewriterText text={pendingOffline.message} />
            <div className="panel-actions"><button className="btn-primary" onClick={() => clearPendingOffline()}>知道了</button></div>
          </>
        )}
      </Overlay>

      <Overlay open={wakeConfirm} onClose={() => setWakeConfirm(false)}>
        <p style={{ marginBottom: 16, lineHeight: 1.6 }}>现在要提前叫醒分身吗？这会立刻结束当前休息状态。</p>
        <div className="panel-actions">
          <button className="btn-primary" onClick={() => { confirmWake(); setWakeConfirm(false); }}>提前叫醒</button>
          <button className="btn-secondary" onClick={() => setWakeConfirm(false)}>取消</button>
        </div>
      </Overlay>

      <Overlay open={errorPopup} onClose={() => setErrorPopup(false)}>
        <div className="error-popup"><div>SYSTEM ERROR 0x0000404</div><div>Exception thrown at pet.click()</div></div>
        <p style={{ marginTop: 12, textAlign: 'center', color: '#ff6666' }}>再点我就要抛出异常了！</p>
      </Overlay>

      <Overlay open={!!storyDialog} onClose={dismissStoryDialog}>
        {storyDialog && (
          <>
            <div className="story-speaker">{storyDialog.speaker}</div>
            <h3 className="panel-title">{storyDialog.title}</h3>
            <TypewriterText text={storyDialog.body} />
            {storyDialog.hint && <p className="story-hint">{storyDialog.hint}</p>}
            <div className="panel-actions">
              <button className="btn-primary" onClick={dismissStoryDialog}>继续</button>
            </div>
          </>
        )}
      </Overlay>

      <WelcomeModal open={showWelcomeModal && !pendingOffline} nickname={profile?.nickname ?? ''}
        onStart={beginTutorialFromWelcome} onSkip={dismissWelcomeModal} />
      {shouldShowOnboardingOverlay && onboardingCurrent && (
        <div className="tutorial-overlay">
          {onboardingHighlight ? (
            <div
              className="tutorial-spotlight"
              style={{
                left: `${onboardingHighlight.x}%`,
                top: `${onboardingHighlight.y}%`,
                width: `${onboardingHighlight.w}%`,
                height: `${onboardingHighlight.h}%`,
              }}
            />
          ) : (
            <div className="tutorial-dim-full" />
          )}
          <div className={`tutorial-card ${onboardingHighlight ? 'tutorial-card-positioned' : 'tutorial-card-center'}`}>
            <div className="tutorial-progress">
              <span className="tutorial-step-label">上手指引 {onboardingStep + 1}/{ONBOARDING_STEPS.length}</span>
              <div className="tutorial-progress-bar">
                <div className="tutorial-progress-fill" style={{ width: `${((onboardingStep + 1) / ONBOARDING_STEPS.length) * 100}%` }} />
              </div>
            </div>
            <h3 className="tutorial-title">{onboardingCurrent.title}</h3>
            <p className="tutorial-body">{onboardingCurrent.body}</p>
            <div className="tutorial-actions">
              <button type="button" className="btn-secondary" onClick={dismissOnboarding}>
                跳过
              </button>
              <button type="button" className="btn-primary" onClick={advanceOnboarding}>
                {onboardingStep >= ONBOARDING_STEPS.length - 1 ? '开始探索' : '下一步'}
              </button>
            </div>
          </div>
        </div>
      )}
      <TutorialGuide active={shouldShowTutorialGuide} stepIndex={tutorialStep} currentRoom={currentRoom}
        petPos={petPos} onNext={nextTutorialStep} onSkip={skipTutorial} onSwitchRoom={(room) => {
          if (room === currentRoom) return;
          const currentIndex = ROOM_TABS.findIndex((tab) => tab.id === currentRoom);
          const nextIndex = ROOM_TABS.findIndex((tab) => tab.id === room);
          setSlideAnim(nextIndex > currentIndex ? 'slide-left' : 'slide-right');
          switchRoom(room);
          setTimeout(() => setSlideAnim(''), 300);
        }} />
      <GuideBook open={showGuideBook} onClose={() => setShowGuideBook(false)} onRestartTutorial={() => startTutorial()} />
      <PetChatPanel open={showPetChat} onClose={() => setShowPetChat(false)} profile={profile} />
      <CollectionPanel open={showCollection} onClose={() => setShowCollection(false)} />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} onRemap={resetForRemapping}
        onToast={showToast} onRestartTutorial={() => startTutorial()} />
      <Toast message={toast} />
    </div>
  );
}
