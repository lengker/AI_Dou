import { useEffect, useState, useCallback, useRef } from 'react';
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

interface ActiveOverlay { type: string; payload?: Record<string, unknown>; }
const PET_SIZE_PX = 64;

export function RoomScreen() {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const shards = useGameStore((s) => s.shards);
  const petState = useGameStore((s) => s.petState);
  const profile = useGameStore((s) => s.profile);
  const catUnlocked = useGameStore((s) => s.catUnlocked);
  const missyState = useGameStore((s) => s.missyState);
  const showRandomEvent = useGameStore((s) => s.showRandomEvent);
  const pendingOffline = useGameStore((s) => s.pendingOffline);
  const collectibles = useGameStore((s) => s.collectibles);
  const furniture = useGameStore((s) => s.furniture);
  const tutorialActive = useGameStore((s) => s.tutorialActive);
  const tutorialStep = useGameStore((s) => s.tutorialStep);
  const showWelcomeModal = useGameStore((s) => s.showWelcomeModal);

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
  const startTutorial = useGameStore((s) => s.startTutorial);

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
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [slideAnim, setSlideAnim] = useState('');
  const charCounter = useRef(0);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const midnight = isMidnightMode();
  const aiOn = isAiConfigured();

  const clampPetPos = useCallback((pos: { x: number; y: number }) => {
    if (!stageSize.width || !stageSize.height) return pos;
    const maxX = Math.max(0, 100 - (PET_SIZE_PX / stageSize.width) * 100);
    const maxY = Math.max(0, 100 - (PET_SIZE_PX / stageSize.height) * 100);
    return {
      x: Math.min(Math.max(pos.x, 0), maxX),
      y: Math.min(Math.max(pos.y, 0), maxY),
    };
  }, [stageSize.height, stageSize.width]);

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
  useEffect(() => { setPetPos(clampPetPos(PET_STAND_POINTS[currentRoom])); }, [currentRoom, clampPetPos]);
  useEffect(() => {
    if (petState === 'S4') {
      const iv = setInterval(() => {
        setPetPos(clampPetPos({ x: 20 + Math.random() * 60, y: 55 + Math.random() * 25 }));
      }, 2000);
      return () => clearInterval(iv);
    }
    setPetPos(clampPetPos(PET_STAND_POINTS[currentRoom]));
  }, [petState, currentRoom, clampPetPos]);
  useEffect(() => { if (missyState) setPetPos(clampPetPos({ x: 18, y: 42 })); }, [missyState, clampPetPos]);
  useEffect(() => { setPetPos((prev) => clampPetPos(prev)); }, [clampPetPos]);
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

  const showToast = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 2000); }, []);

  const onZoneClick = (zoneId: string, decorative?: boolean) => {
    if (tutorialActive) return;
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
    if (zone?.disabledInMidnight && midnight) return;
    const result = handleHotZone(zoneId);
    if (result) setOverlay(result);
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

  return (
    <div className="room-scene">
      <div className="room-stage" ref={stageRef}>
        <img src={ROOM_BACKGROUNDS[currentRoom]} alt="room" className={`room-bg ${midnight ? 'midnight' : ''} ${slideAnim}`} />

        <div className="hotzone-layer">
          {zones.map((zone) => {
            const disabled = !!(zone.disabledInMidnight && midnight);
            if (zone.id === 'L01' && missyState) return null;
            return (
              <button key={zone.id} className={`hotzone ${disabled ? 'disabled' : ''}`}
                style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
                onClick={() => onZoneClick(zone.id, zone.decorative)} aria-label={zone.label} />
            );
          })}
        </div>

        <div className="pet-layer" style={{ left: `${petPos.x}%`, top: `${petPos.y}%` }}
          onClick={() => {
            if (tutorialActive) return;
            const r = handlePetClick();
            if (!r) return;
            if (r.type === 'wake_confirm') setWakeConfirm(true);
            else if (r.type === 'missy_complete') { setBubble(r.message ?? ''); setTimeout(() => setBubble(null), 5000); }
            else if (r.type === 'easter_egg') { setErrorPopup(true); showToast('成就解锁：异常抛出者'); }
            else if (r.message) { setBubble(r.message); setTimeout(() => setBubble(null), 3000); }
          }}>
          <div className={`pet-sprite ${petState === 'S5' ? 'glitching' : ''}`}>
            <img src="/DOU/images/role/default.png" alt="pet" style={{ width: '100%', height: '100%',
              filter: profile ? `${getSkinFilter(profile.appearance.skinTone)} ${getHairFilter(profile.appearance.hairColor)}` : undefined }} />
            {missyState && <img src="/DOU/images/ui/pensive.png" alt="face" className="pet-face" />}
            {petState === 'S3' && !missyState && <span className="pet-zzz">Zzz</span>}
            {missyState && <div className="pet-hearts">{[0,1,2].map((i) => <img key={i} src="/DOU/images/ui/heart.png" alt="heart" />)}</div>}
          </div>
          {catUnlocked && <img src="/DOU/images/pet/cat.png" alt="cat" className="pet-cat" />}
        </div>

        {(showRandomEvent || bubble) && (
          <div className="bubble-text" style={{ top: `${petPos.y - 8}%`, left: `${petPos.x}%` }}>
            {showRandomEvent ? <TypewriterText text={showRandomEvent} speed={30} /> : bubble}
          </div>
        )}
      </div>

      <div className="ui-layer">
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
        <img src="/DOU/images/ui/folder.png" alt="收藏柜" className="ui-icon-btn ui-folder"
          onClick={() => { if (debounceAction('collection', 500)) setShowCollection(true); }} />
        <div className="room-tabs">
          {ROOM_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`room-tab ${currentRoom === tab.id ? 'active' : ''}`}
              onClick={() => switchRoomWithAnim(tab.id)}
            >
              {tab.label}
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
        midnight={midnight}
        fallingChars={fallingChars}
        onLoot={(n) => { addShards(n); showToast(`终端漏洞赏金 +${n} 碎片！`); }}
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
        <p style={{ marginBottom: 16, lineHeight: 1.6 }}>警告：当前操作严重消耗我的虚拟脑细胞。</p>
        <div className="panel-actions">
          <button className="btn-primary" onClick={() => { confirmWake(); setWakeConfirm(false); }}>确认唤醒</button>
          <button className="btn-secondary" onClick={() => setWakeConfirm(false)}>取消</button>
        </div>
      </Overlay>

      <Overlay open={errorPopup} onClose={() => setErrorPopup(false)}>
        <div className="error-popup"><div>SYSTEM ERROR 0x0000404</div><div>Exception thrown at pet.click()</div></div>
        <p style={{ marginTop: 12, textAlign: 'center', color: '#ff6666' }}>再点我就要抛出异常了！</p>
      </Overlay>

      <WelcomeModal open={showWelcomeModal && !pendingOffline} nickname={profile?.nickname ?? ''}
        onStart={beginTutorialFromWelcome} onSkip={dismissWelcomeModal} />
      <TutorialGuide active={tutorialActive && !pendingOffline} stepIndex={tutorialStep} currentRoom={currentRoom}
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
