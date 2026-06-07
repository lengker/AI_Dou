import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getCollectible } from '@/data/collectibles';
import { FOREST_ANIMAL_BY_ZONE, type ForestAnimalDef } from '@/data/forestAnimals';
import { getFurniture } from '@/data/furniture';
import { isWeekend } from '@/utils/time';
import { Overlay } from '@/components/Overlay';
import { TypewriterText } from '@/components/TypewriterText';
import { AiTerminal } from '@/components/AiTerminal';
import { AiNarrative } from '@/components/AiNarrative';
import {
  fetchDream, fetchFridgeFortune, fetchTrashReport,
  fetchWindowWhisper, fetchPlantWhisper, fetchBookshelfLine,
} from '@/services/aiFeatures';
import { MUSIC_BOX } from '@/data/musicBox';
import { playForRiver } from '@/utils/musicPlayer';
import { useGameStore } from '@/store/gameStore';
import type { AvatarProfile } from '@/types';

interface ActiveOverlay {
  type: string;
  payload?: Record<string, unknown>;
}

export function InteractionOverlay({
  overlay, onClose, onUnlock, onMusicBoxActivate, shards, collectibles, profile, nightDebug, fallingChars, onLoot, forestAnimals, onUnlockForestAnimal,
}: {
  overlay: ActiveOverlay | null;
  onClose: () => void;
  onUnlock: (id: string) => void;
  onMusicBoxActivate: () => boolean;
  shards: number;
  collectibles: string[];
  profile: AvatarProfile | null;
  nightDebug: boolean;
  fallingChars: { char: string; id: number }[];
  onLoot?: (amount: number) => void;
  forestAnimals: string[];
  onUnlockForestAnimal: (zoneId: string) => { success: boolean; reward: number; alreadyUnlocked: boolean };
}) {
  if (!overlay) return null;
  const { type, payload = {} } = overlay;

  if (type === 'forest_event') {
    return (
      <ForestEventOverlay
        onClose={onClose}
        payload={payload}
        forestAnimals={forestAnimals}
        onUnlockForestAnimal={onUnlockForestAnimal}
      />
    );
  }

  if (type === 'computer') {
    return (
      <Overlay open onClose={onClose} className="computer-overlay-panel">
        <h3 className="panel-title">404 神经终端</h3>
        <img
          src={nightDebug || payload.nightDebug ? './DOU/images/interact/computer_simple.png' : './DOU/images/interact/computer.png'}
          alt="computer"
          className="overlay-image overlay-image-sm"
        />
        <div className="falling-chars">{fallingChars.map((c, i) => (
          <span key={c.id} className="falling-char" style={{ left: `${20 + (i % 5) * 15}%` }}>{c.char}</span>
        ))}</div>
        <AiTerminal
          profile={profile}
          shards={shards}
          collectiblesCount={collectibles.length}
          nightDebug={!!(nightDebug || payload.nightDebug)}
          onLoot={onLoot}
        />
        <p className="ai-hint">小人同步敲键盘中 · 终端由离线文案引擎驱动</p>
      </Overlay>
    );
  }

  if (type === 'bed') return <BedOverlay onClose={onClose} profile={profile} zoneId={payload.zoneId as string | undefined} />;
  if (type === 'fridge') return <FridgeOverlay onClose={onClose} profile={profile} result={payload.result as string} zoneId={payload.zoneId as string | undefined} />;
  if (type === 'trash') return <TrashOverlay onClose={onClose} payload={payload} />;
  if (type === 'ai_whisper') return <WhisperOverlay onClose={onClose} kind={payload.kind as string} />;
  if (type === 'furniture_unlock') {
    return (
      <Overlay open onClose={onClose}>
        <h3 className="panel-title">解锁家具</h3>
        <p style={{ textAlign: 'center', marginBottom: 16 }}>{payload.name as string}<br />需要 {payload.cost as number} 数据碎片</p>
        <div className="panel-actions">
          <button className="btn-primary" disabled={shards < (payload.cost as number)} onClick={() => onUnlock(payload.furnitureId as string)}>确认解锁</button>
          <button className="btn-secondary" onClick={onClose}>取消</button>
        </div>
      </Overlay>
    );
  }
  if (type === 'furniture_view') return <FurnitureViewOverlay onClose={onClose} payload={payload} />;
  if (type === 'desktop_bubble') return <DesktopBubbleOverlay onClose={onClose} payload={payload} />;
  if (type === 'music_box') {
    return <MusicBoxOverlay onClose={onClose} shards={shards} onActivate={onMusicBoxActivate} />;
  }
  return null;
}

function MusicBoxOverlay({
  onClose,
  shards,
  onActivate,
}: {
  onClose: () => void;
  shards: number;
  onActivate: () => boolean;
}) {
  const unlocked = useGameStore((s) => s.musicBoxUnlocked);
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState('');
  const { copy } = MUSIC_BOX;

  const handleStart = async () => {
    setError('');
    if (!onActivate()) return;
    try {
      await playForRiver(MUSIC_BOX.audioSrc);
      setPlaying(true);
    } catch {
      setError(copy.playError);
    }
  };

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{copy.overlayTitle}</h3>
      <p style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 10 }}>{copy.tagline}</p>
      <img src={MUSIC_BOX.image} alt="留声机" className="overlay-image overlay-image-sm" />
      {playing ? (
        <>
          <p style={{ textAlign: 'center', lineHeight: 1.7, marginBottom: 8, color: '#d6efe8' }}>
            {copy.playing}
          </p>
          <p style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 16 }}>{copy.payHint}</p>
          <div className="panel-actions">
            <button className="btn-primary" type="button" onClick={onClose}>{copy.closePanel}</button>
          </div>
        </>
      ) : (
        <>
          <p style={{ textAlign: 'center', lineHeight: 1.7, marginBottom: 12, fontSize: 12, color: '#ccc' }}>
            {unlocked ? copy.unlockedNote : copy.intro}
          </p>
          {!unlocked && (
            <p style={{ textAlign: 'center', marginBottom: 8 }}>
              需要 <strong style={{ color: '#ffd166' }}>{MUSIC_BOX.costShards}</strong> 数据碎片
            </p>
          )}
          <p style={{ textAlign: 'center', fontSize: 11, color: '#888', marginBottom: 12 }}>{copy.payHint}</p>
          {error && <p style={{ textAlign: 'center', color: '#ff8866', fontSize: 12, marginBottom: 8 }}>{error}</p>}
          <div className="panel-actions">
            <button
              className="btn-primary"
              type="button"
              disabled={!unlocked && shards < MUSIC_BOX.costShards}
              onClick={() => void handleStart()}
            >
              {unlocked ? copy.playButton : copy.unlockButton}
            </button>
            <button className="btn-secondary" type="button" onClick={onClose}>{copy.cancel}</button>
          </div>
        </>
      )}
    </Overlay>
  );
}

function BedOverlay({ onClose, profile, zoneId }: { onClose: () => void; profile: AvatarProfile | null; zoneId?: string }) {
  const [loading, setLoading] = useState(true);
  const [dream, setDream] = useState<string | null>(null);

  useEffect(() => {
    fetchDream(profile).then(setDream).finally(() => setLoading(false));
  }, [profile]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{zoneId === 'F02' ? '林间小憩' : '梦境注入'}</h3>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 12 }}>分身进入 5 分钟休息状态 · 临时 Buff 已清除</p>
      <AiNarrative title="正在读取梦境缓存..." loading={loading} text={dream} loadingHint="潜入 REM 层..." />
    </Overlay>
  );
}

function FridgeOverlay({ onClose, profile, result, zoneId }: { onClose: () => void; profile: AvatarProfile | null; result: string; zoneId?: string }) {
  const [loading, setLoading] = useState(true);
  const [fortune, setFortune] = useState<string | null>(null);

  useEffect(() => {
    fetchFridgeFortune(profile, result).then(setFortune).finally(() => setLoading(false));
  }, [profile, result]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{zoneId === 'F03' ? '清泉取水' : '冰箱 · 赛博签'}</h3>
      {result === 'cola' && (
        <>
          <img src="./DOU/images/element/cola.png" alt="cola" className="overlay-image" />
          <p style={{ textAlign: 'center' }}>赛博可乐！移速 ×1.3</p>
          {isWeekend() && <p style={{ textAlign: 'center', color: '#ff9966', fontSize: 12 }}>周末多巴胺溢出</p>}
        </>
      )}
      {result === 'expired' && <p style={{ textAlign: 'center', color: '#888' }}>过期可乐...卡 Bug 闪烁中</p>}
      {result === 'empty' && <p style={{ textAlign: 'center', color: '#888', marginBottom: 8 }}>{zoneId === 'F03' ? '泉水里只剩半瓶冷却液了。' : '只剩半瓶冷却液了。'}</p>}
      <AiNarrative title="📜 今日签文" loading={loading} text={fortune} loadingHint="签文生成中..." />
    </Overlay>
  );
}

function TrashOverlay({ onClose, payload }: { onClose: () => void; payload: Record<string, unknown> }) {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  useEffect(() => {
    if (payload.collectibleId) {
      const item = getCollectible(payload.collectibleId as string);
      if (item) {
        setLoading(true);
        fetchTrashReport(item.name, item.description).then(setReport).finally(() => setLoading(false));
      }
    }
  }, [payload.collectibleId]);

  if (payload.limit || payload.empty || payload.miss) {
    return (
      <Overlay open onClose={onClose}>
        <h3 className="panel-title">{payload.zoneId === 'F04' ? '翻找木堆' : '翻找垃圾桶'}</h3>
        <TypewriterText text={(payload.message as string) || (payload.empty ? '只剩电子灰尘了。' : '什么都没找到...')} />
      </Overlay>
    );
  }

  const item = getCollectible(payload.collectibleId as string);
  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{payload.zoneId === 'F04' ? '腐木发现报告' : '🔍 电子考古报告'}</h3>
      {item && (
        <>
          <img src={item.icon} alt={item.name} className="overlay-image" />
          <p style={{ textAlign: 'center', color: '#00ffcc', marginBottom: 8 }}>{item.name}</p>
          <p style={{ fontSize: 11, color: '#666', textAlign: 'center', marginBottom: 12 }}>{item.description}</p>
        </>
      )}
      <AiNarrative title="鉴定报告" loading={loading} text={report} loadingHint="碳14像素测定中..." />
    </Overlay>
  );
}

function WhisperOverlay({ onClose, kind }: { onClose: () => void; kind: string }) {
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState<string | null>(null);
  const title = kind === 'window' ? '🌊 数据海低语' : '🌿 绿植心语';

  useEffect(() => {
    const fn = kind === 'window' ? fetchWindowWhisper : fetchPlantWhisper;
    fn().then(setText).finally(() => setLoading(false));
  }, [kind]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{title}</h3>
      <AiNarrative title="" loading={loading} text={text} loadingHint="接收信号..." />
    </Overlay>
  );
}

function FurnitureViewOverlay({ onClose, payload }: { onClose: () => void; payload: Record<string, unknown> }) {
  const item = getFurniture(payload.furnitureId as string);
  const hotZoneId = payload.hotZoneId as string | undefined;
  const [loading, setLoading] = useState(hotZoneId === 'W05');
  const [bookLine, setBookLine] = useState<string | null>(null);

  useEffect(() => {
    if (hotZoneId === 'W05') {
      fetchBookshelfLine().then(setBookLine).finally(() => setLoading(false));
    }
  }, [hotZoneId]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">{payload.title as string}</h3>
      {item && <img src={item.icon} alt={item.name} className="overlay-image" />}
      <p style={{ textAlign: 'center', color: '#aaa', marginBottom: 8 }}>{item?.name}</p>
      {hotZoneId === 'W05' && (
        <AiNarrative title="📚 书架 AI 荐书" loading={loading} text={bookLine} loadingHint="检索藏书索引..." />
      )}
    </Overlay>
  );
}

function DesktopBubbleOverlay({ onClose, payload }: { onClose: () => void; payload: Record<string, unknown> }) {
  return (
    <Overlay open onClose={onClose}>
      <TypewriterText text={payload.message as string} />
    </Overlay>
  );
}

function ForestEventOverlay({
  onClose, payload, forestAnimals, onUnlockForestAnimal,
}: {
  onClose: () => void;
  payload: Record<string, unknown>;
  forestAnimals: string[];
  onUnlockForestAnimal: (zoneId: string) => { success: boolean; reward: number; alreadyUnlocked: boolean };
}) {
  const zoneId = payload.zoneId as string;
  const animal = FOREST_ANIMAL_BY_ZONE[zoneId];
  const alreadyUnlocked = forestAnimals.includes(zoneId);
  const [tapCount, setTapCount] = useState(0);
  const [holdCount, setHoldCount] = useState(0);
  const [sequenceIndex, setSequenceIndex] = useState(0);
  const [alternatingIndex, setAlternatingIndex] = useState(0);
  const [status, setStatus] = useState<'playing' | 'success'>('playing');
  const [reward, setReward] = useState(0);
  const [hint, setHint] = useState('');
  const [timingValue, setTimingValue] = useState(0);
  const [timingDirection, setTimingDirection] = useState(1);
  const holdIntervalRef = useRef<number | null>(null);
  const holdActiveRef = useRef(false);

  useEffect(() => {
    if (!animal || animal.method !== 'timing' || alreadyUnlocked || status === 'success') return;
    const iv = setInterval(() => {
      setTimingValue((prev) => {
        let next = prev + timingDirection * 6;
        if (next >= 100) {
          next = 100;
          setTimingDirection(-1);
        } else if (next <= 0) {
          next = 0;
          setTimingDirection(1);
        }
        return next;
      });
    }, 60);
    return () => clearInterval(iv);
  }, [animal, alreadyUnlocked, status, timingDirection]);

  const animalProgress = useMemo(() => `${forestAnimals.length}/10`, [forestAnimals.length]);

  if (!animal) return null;

  const finishUnlock = () => {
    const result = onUnlockForestAnimal(zoneId);
    setReward(result.reward);
    setStatus('success');
  };

  const stopHold = useCallback(() => {
    holdActiveRef.current = false;
    if (holdIntervalRef.current !== null) {
      window.clearInterval(holdIntervalRef.current);
      holdIntervalRef.current = null;
    }
  }, []);

  const startHold = useCallback(() => {
    if (holdActiveRef.current || alreadyUnlocked || status === 'success') return;
    holdActiveRef.current = true;
    holdIntervalRef.current = window.setInterval(() => {
      setHoldCount((prev) => {
        const next = Math.min(100, prev + 10);
        if (next >= 100) {
          stopHold();
          finishUnlock();
        }
        return next;
      });
    }, 90);
  }, [alreadyUnlocked, status, stopHold]);

  useEffect(() => stopHold, [stopHold]);

  const renderGame = (config: ForestAnimalDef) => {
    switch (config.method) {
      case 'tap':
        return (
          <>
            <p className="forest-mini-copy">当前节奏 {tapCount}/{config.target}</p>
            <button type="button" className="btn-primary forest-mini-btn" onClick={() => {
              const next = tapCount + 1;
              setTapCount(next);
              if (next >= (config.target ?? 1)) finishUnlock();
            }}>轻拍一下</button>
          </>
        );
      case 'hold':
        return (
          <>
            <p className="forest-mini-copy">安静度 {holdCount}%</p>
            <button
              type="button"
              className="btn-primary forest-mini-btn"
              onPointerDown={startHold}
              onPointerUp={stopHold}
              onPointerCancel={stopHold}
              onPointerLeave={stopHold}
              onTouchStart={startHold}
              onTouchEnd={stopHold}
              onTouchCancel={stopHold}
              onMouseDown={startHold}
              onMouseUp={stopHold}
              onMouseLeave={stopHold}
              onContextMenu={(e) => e.preventDefault()}
            >
              按住屏息等待
            </button>
          </>
        );
      case 'pick':
        return (
          <div className="forest-option-grid">
            {config.options?.map((option, index) => (
              <button
                key={option}
                type="button"
                className="btn-secondary forest-option-btn"
                onClick={() => {
                  if (index === config.correctIndex) finishUnlock();
                  else setHint('扑空了，再换一边试试。');
                }}
              >
                {option}
              </button>
            ))}
          </div>
        );
      case 'timing': {
        const [start, end] = config.timingTarget ?? [40, 60];
        return (
          <>
            <div className="forest-timing-track">
              <div className="forest-timing-hit" style={{ left: `${start}%`, width: `${end - start}%` }} />
              <div className="forest-timing-pointer" style={{ left: `${timingValue}%` }} />
            </div>
            <button type="button" className="btn-primary forest-mini-btn" onClick={() => {
              if (timingValue >= start && timingValue <= end) finishUnlock();
              else setHint('节奏差了一点，再试一次。');
            }}>现在收网</button>
          </>
        );
      }
      case 'sequence':
        return (
          <>
            <p className="forest-mini-copy">按顺序点亮：{config.sequence?.join(' -> ')}</p>
            <div className="forest-option-grid">
              {['蓝花', '白花', '黄花'].map((option) => (
                <button
                  key={option}
                  type="button"
                  className="btn-secondary forest-option-btn"
                  onClick={() => {
                    const expected = config.sequence?.[sequenceIndex];
                    if (option === expected) {
                      const next = sequenceIndex + 1;
                      if (next >= (config.sequence?.length ?? 0)) finishUnlock();
                      else setSequenceIndex(next);
                    } else {
                      setSequenceIndex(0);
                      setHint('顺序乱掉了，花光重新暗了下去。');
                    }
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        );
      case 'alternate':
        return (
          <>
            <p className="forest-mini-copy">跟着脚印节奏左右交替 {alternatingIndex}/{config.target}</p>
            <div className="forest-option-grid">
              {['左拍', '右拍'].map((option, index) => (
                <button
                  key={option}
                  type="button"
                  className="btn-secondary forest-option-btn"
                  onClick={() => {
                    const expected = alternatingIndex % 2;
                    if (index === expected) {
                      const next = alternatingIndex + 1;
                      setAlternatingIndex(next);
                      if (next >= (config.target ?? 1)) finishUnlock();
                    } else {
                      setAlternatingIndex(0);
                      setHint('脚印节奏断了，从头再来。');
                    }
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          </>
        );
      default:
        return null;
    }
  };

  return (
    <Overlay open onClose={onClose} className="forest-event-panel">
      <div className="story-speaker">数据林海 · 动物观察</div>
      <h3 className="panel-title">{animal.hotspotName}</h3>
      <p className="story-hint" style={{ marginTop: -8, marginBottom: 12 }}>林海图鉴 {animalProgress}</p>
      <img src={animal.image} alt={animal.name} className="overlay-image overlay-image-sm" />
      <p style={{ textAlign: 'center', color: '#00ffcc', marginBottom: 6 }}>{animal.name}</p>
      <p className="forest-mini-copy">{animal.intro}</p>
      {alreadyUnlocked || status === 'success' ? (
        <>
          <p className="forest-success-text">{alreadyUnlocked ? '这只小动物已经被你记录到图鉴里。' : animal.successText}</p>
          {!alreadyUnlocked && <p className="forest-reward-text">图鉴更新 +{reward} 数据碎片</p>}
          <div className="panel-actions">
            <button type="button" className="btn-primary" onClick={onClose}>知道了</button>
          </div>
        </>
      ) : (
        <>
          {renderGame(animal)}
          {hint && <p className="forest-mini-hint">{hint}</p>}
        </>
      )}
    </Overlay>
  );
}
