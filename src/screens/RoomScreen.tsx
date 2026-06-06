import { useEffect, useState, useCallback, useRef } from 'react';
import { HOT_ZONES, ROOM_BACKGROUNDS, PET_STAND_POINTS } from '@/data/hotzones';
import { getCollectible } from '@/data/collectibles';
import { getFurniture } from '@/data/furniture';
import { useGameStore, finalizeComputerInteraction } from '@/store/gameStore';
import { isMidnightMode, isWeekend } from '@/utils/time';
import { debounceAction } from '@/utils/debounce';
import { getSkinFilter, getHairFilter } from '@/utils/colorMapping';
import { Overlay, Toast } from '@/components/Overlay';
import { TypewriterText } from '@/components/TypewriterText';
import { CollectionPanel } from '@/components/CollectionPanel';
import { SettingsPanel } from '@/components/SettingsPanel';
import { GuideBook } from '@/components/GuideBook';
import { TutorialGuide, WelcomeModal } from '@/components/TutorialGuide';

interface ActiveOverlay { type: string; payload?: Record<string, unknown>; }

export function RoomScreen() {
  const currentRoom = useGameStore((s) => s.currentRoom);
  const shards = useGameStore((s) => s.shards);
  const petState = useGameStore((s) => s.petState);
  const profile = useGameStore((s) => s.profile);
  const catUnlocked = useGameStore((s) => s.catUnlocked);
  const missyState = useGameStore((s) => s.missyState);
  const showRandomEvent = useGameStore((s) => s.showRandomEvent);
  const pendingOffline = useGameStore((s) => s.pendingOffline);
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
  const unlockFurniture = useGameStore((s) => s.unlockFurniture);
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
  const [toast, setToast] = useState<string | null>(null);
  const [bubble, setBubble] = useState<string | null>(null);
  const [wakeConfirm, setWakeConfirm] = useState(false);
  const [errorPopup, setErrorPopup] = useState(false);
  const [fallingChars, setFallingChars] = useState<{ char: string; id: number }[]>([]);
  const [petPos, setPetPos] = useState<{ x: number; y: number }>(PET_STAND_POINTS[currentRoom]);
  const [slideAnim, setSlideAnim] = useState('');
  const charCounter = useRef(0);
  const midnight = isMidnightMode();

  useEffect(() => { triggerRandomEventOnEnter(); }, [triggerRandomEventOnEnter]);
  useEffect(() => { const t = setInterval(() => tickPetState(), 45000); return () => clearInterval(t); }, [tickPetState]);
  useEffect(() => { setPetPos(PET_STAND_POINTS[currentRoom]); }, [currentRoom]);
  useEffect(() => {
    if (petState === 'S4') {
      const iv = setInterval(() => setPetPos({ x: 20 + Math.random() * 60, y: 55 + Math.random() * 25 }), 2000);
      return () => clearInterval(iv);
    }
    setPetPos(PET_STAND_POINTS[currentRoom]);
  }, [petState, currentRoom]);
  useEffect(() => { if (missyState) setPetPos({ x: 18, y: 42 }); }, [missyState]);
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

  const onZoneClick = (zoneId: string, decorative?: boolean, decorativeMessage?: string) => {
    if (tutorialActive) return;
    if (decorative && decorativeMessage) { setBubble(decorativeMessage); setTimeout(() => setBubble(null), 5000); return; }
    const zone = HOT_ZONES.find((z) => z.id === zoneId);
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
    setSlideAnim(room === 'room_living' ? 'slide-left' : 'slide-right');
    switchRoom(room);
    setTimeout(() => setSlideAnim(''), 300);
  };

  const zones = HOT_ZONES.filter((z) => z.room === currentRoom);

  return (
    <div className="room-scene">
      <img src={ROOM_BACKGROUNDS[currentRoom]} alt="room" className={`room-bg ${midnight ? 'midnight' : ''} ${slideAnim}`} />

      <div className="hotzone-layer">
        {zones.map((zone) => {
          const disabled = !!(zone.disabledInMidnight && midnight);
          if (zone.id === 'L01' && missyState) return null;
          return (
            <button key={zone.id} className={`hotzone ${disabled ? 'disabled' : ''}`}
              style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.w}%`, height: `${zone.h}%` }}
              onClick={() => onZoneClick(zone.id, zone.decorative, zone.decorativeMessage)} aria-label={zone.label} />
          );
        })}
      </div>

      <div className="pet-layer" style={{ left: `${petPos.x}%`, top: `${petPos.y}%` }}
        onClick={() => { if (tutorialActive) return; const r = handlePetClick(); if (!r) return;
          if (r.type === 'wake_confirm') setWakeConfirm(true);
          else if (r.type === 'missy_complete') { setBubble(r.message ?? ''); setTimeout(() => setBubble(null), 5000); }
          else if (r.type === 'easter_egg') { setErrorPopup(true); showToast('成就解锁：异常抛出者'); }
          else if (r.message) { setBubble(r.message); setTimeout(() => setBubble(null), 3000); }
        }}>
        <div className={`pet-sprite ${petState === 'S5' ? 'glitching' : ''}`}>
          <img src="/DOU/images/role/default.png" alt="pet" style={{ width: '100%', height: '100%',
            filter: profile ? `${getSkinFilter(profile.appearance.skinTone)} ${getHairFilter(profile.appearance.hairColor)}` : undefined }} />
          {missyState && <img src="/DOU/images/ui/pensive.png" alt="face" className="pet-face" />}
          {petState === 'S3' && !missyState && <span style={{ position: 'absolute', top: -20, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#aaa' }}>Zzz</span>}
          {missyState && <div className="pet-hearts">{[0,1,2].map((i) => <img key={i} src="/DOU/images/ui/heart.png" alt="heart" />)}</div>}
        </div>
        {catUnlocked && <img src="/DOU/images/pet/cat.png" alt="cat" className="pet-cat" />}
      </div>

      {(showRandomEvent || bubble) && (
        <div className="bubble-text" style={{ top: `${petPos.y - 8}%`, left: `${petPos.x}%` }}>
          {showRandomEvent ? <TypewriterText text={showRandomEvent} speed={30} /> : bubble}
        </div>
      )}

      <div className="ui-layer">
        <button type="button" className="ui-help-btn" onClick={() => setShowGuideBook(true)} aria-label="探索手册">?</button>
        <div className="shard-display"><img src="/DOU/images/ui/coin.png" alt="coin" /><span>{shards}</span></div>
        <button className="ui-icon-btn ui-settings" onClick={() => { if (debounceAction('settings', 500)) setShowSettings(true); }} aria-label="设置">⚙</button>
        <img src="/DOU/images/ui/folder.png" alt="收藏柜" className="ui-icon-btn ui-folder"
          onClick={() => { if (debounceAction('collection', 500)) setShowCollection(true); }} />
        <div className="room-tabs">
          <button className={`room-tab ${currentRoom === 'room_working' ? 'active' : ''}`} onClick={() => switchRoomWithAnim('room_working')}>办公区</button>
          <button className={`room-tab ${currentRoom === 'room_living' ? 'active' : ''}`} onClick={() => switchRoomWithAnim('room_living')}>生活区</button>
        </div>
      </div>

      <InteractionOverlay overlay={overlay} onClose={closeOverlay} onUnlock={(id) => {
        if (unlockFurniture(id)) { showToast('家具解锁成功！'); closeOverlay(); } else showToast('数据碎片不足。');
      }} shards={shards} furniture={furniture} midnight={midnight} fallingChars={fallingChars} />

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
        <div className="error-popup">
          <div>SYSTEM ERROR 0x0000404</div><div>Exception thrown at pet.click()</div>
        </div>
        <p style={{ marginTop: 12, textAlign: 'center', color: '#ff6666' }}>再点我就要抛出异常了！</p>
      </Overlay>

      <WelcomeModal open={showWelcomeModal && !pendingOffline} nickname={profile?.nickname ?? ''}
        onStart={beginTutorialFromWelcome} onSkip={dismissWelcomeModal} />
      <TutorialGuide active={tutorialActive && !pendingOffline} stepIndex={tutorialStep} currentRoom={currentRoom}
        petPos={petPos} onNext={nextTutorialStep} onSkip={skipTutorial} onSwitchRoom={(room) => {
          if (room === currentRoom) return;
          setSlideAnim(room === 'room_living' ? 'slide-left' : 'slide-right');
          switchRoom(room);
          setTimeout(() => setSlideAnim(''), 300);
        }} />
      <GuideBook open={showGuideBook} onClose={() => setShowGuideBook(false)} onRestartTutorial={() => startTutorial()} />
      <CollectionPanel open={showCollection} onClose={() => setShowCollection(false)} />
      <SettingsPanel open={showSettings} onClose={() => setShowSettings(false)} onRemap={resetForRemapping}
        onToast={showToast} onRestartTutorial={() => startTutorial()} />
      <Toast message={toast} />
    </div>
  );
}

function InteractionOverlay({ overlay, onClose, onUnlock, shards, midnight, fallingChars }: {
  overlay: ActiveOverlay | null; onClose: () => void; onUnlock: (id: string) => void;
  shards: number; furniture: string[]; midnight: boolean; fallingChars: { char: string; id: number }[];
}) {
  if (!overlay) return null;
  const { type, payload = {} } = overlay;

  if (type === 'computer') return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">电脑交互</h3>
      <img src={midnight || payload.midnight ? '/DOU/images/interact/computer_simple.png' : '/DOU/images/interact/computer.png'} alt="computer" className="overlay-image" />
      <div className="falling-chars">{fallingChars.map((c, i) => <span key={c.id} className="falling-char" style={{ left: `${20 + (i % 5) * 15}%` }}>{c.char}</span>)}</div>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#888' }}>小人正在敲键盘...</p>
    </Overlay>
  );
  if (type === 'bed') return (
    <Overlay open onClose={onClose}><h3 className="panel-title">床铺特写</h3>
      <p style={{ textAlign: 'center', lineHeight: 1.8 }}>小人进入睡眠状态，持续 5 分钟。<br />所有临时 Buff 已清除。</p></Overlay>
  );
  if (type === 'fridge') {
    const result = payload.result as string;
    return (
      <Overlay open onClose={onClose}><h3 className="panel-title">冰箱</h3>
        {result === 'cola' && <><img src="/DOU/images/element/cola.png" alt="cola" className="overlay-image" /><p style={{ textAlign: 'center' }}>赛博可乐！移速提升 1.3 倍。</p>{isWeekend() && <p style={{ textAlign: 'center', color: '#ff9966', fontSize: 12 }}>周末多巴胺溢出</p>}</>}
        {result === 'expired' && <p style={{ textAlign: 'center', color: '#888' }}>过期可乐...卡 Bug 闪烁中</p>}
        {result === 'empty' && <TypewriterText text="只剩半瓶冷却液了。" />}</Overlay>
    );
  }
  if (type === 'trash') {
    if (payload.limit || payload.empty || payload.miss) return (
      <Overlay open onClose={onClose}><h3 className="panel-title">翻找垃圾桶</h3>
        <TypewriterText text={(payload.message as string) || (payload.empty ? '只剩电子灰尘了。' : '什么都没找到...')} /></Overlay>
    );
    const item = getCollectible(payload.collectibleId as string);
    return (
      <Overlay open onClose={onClose}><h3 className="panel-title">发现藏品！</h3>
        {item && <><img src={item.icon} alt={item.name} className="overlay-image" /><p style={{ textAlign: 'center', color: '#00ffcc' }}>{item.name}</p></>}</Overlay>
    );
  }
  if (type === 'furniture_unlock') return (
    <Overlay open onClose={onClose}><h3 className="panel-title">解锁家具</h3>
      <p style={{ textAlign: 'center', marginBottom: 16 }}>{payload.name as string}<br />需要 {payload.cost as number} 数据碎片</p>
      <div className="panel-actions">
        <button className="btn-primary" disabled={shards < (payload.cost as number)} onClick={() => onUnlock(payload.furnitureId as string)}>确认解锁</button>
        <button className="btn-secondary" onClick={onClose}>取消</button>
      </div></Overlay>
  );
  if (type === 'furniture_view') {
    const item = getFurniture(payload.furnitureId as string);
    return (
      <Overlay open onClose={onClose}><h3 className="panel-title">{payload.title as string}</h3>
        {item && <img src={item.icon} alt={item.name} className="overlay-image" />}
        <p style={{ textAlign: 'center', color: '#aaa' }}>{item?.name}</p></Overlay>
    );
  }
  if (type === 'desktop_bubble') return <Overlay open onClose={onClose}><TypewriterText text={payload.message as string} /></Overlay>;
  return null;
}
