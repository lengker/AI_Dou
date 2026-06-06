import { useEffect, useState } from 'react';
import { getCollectible } from '@/data/collectibles';
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
import type { AvatarProfile } from '@/types';

interface ActiveOverlay {
  type: string;
  payload?: Record<string, unknown>;
}

export function InteractionOverlay({
  overlay, onClose, onUnlock, shards, collectibles, profile, midnight, fallingChars, onLoot,
}: {
  overlay: ActiveOverlay | null;
  onClose: () => void;
  onUnlock: (id: string) => void;
  shards: number;
  collectibles: string[];
  profile: AvatarProfile | null;
  midnight: boolean;
  fallingChars: { char: string; id: number }[];
  onLoot?: (amount: number) => void;
}) {
  if (!overlay) return null;
  const { type, payload = {} } = overlay;

  if (type === 'computer') {
    return (
      <Overlay open onClose={onClose} className="computer-overlay-panel">
        <h3 className="panel-title">404 神经终端</h3>
        <img
          src={midnight || payload.midnight ? '/DOU/images/interact/computer_simple.png' : '/DOU/images/interact/computer.png'}
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
          midnight={!!(midnight || payload.midnight)}
          onLoot={onLoot}
        />
        <p className="ai-hint">小人同步敲键盘中 · 终端由千问驱动</p>
      </Overlay>
    );
  }

  if (type === 'bed') return <BedOverlay onClose={onClose} profile={profile} />;
  if (type === 'fridge') return <FridgeOverlay onClose={onClose} profile={profile} result={payload.result as string} />;
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
  if (type === 'desktop_bubble') return <Overlay open onClose={onClose}><TypewriterText text={payload.message as string} /></Overlay>;
  return null;
}

function BedOverlay({ onClose, profile }: { onClose: () => void; profile: AvatarProfile | null }) {
  const [loading, setLoading] = useState(true);
  const [dream, setDream] = useState<string | null>(null);

  useEffect(() => {
    fetchDream(profile).then(setDream).finally(() => setLoading(false));
  }, [profile]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">🌙 梦境注入</h3>
      <p style={{ textAlign: 'center', fontSize: 12, color: '#888', marginBottom: 12 }}>小人入睡 5 分钟 · Buff 已清除</p>
      <AiNarrative title="正在读取梦境缓存..." loading={loading} text={dream} loadingHint="潜入 REM 层..." />
    </Overlay>
  );
}

function FridgeOverlay({ onClose, profile, result }: { onClose: () => void; profile: AvatarProfile | null; result: string }) {
  const [loading, setLoading] = useState(true);
  const [fortune, setFortune] = useState<string | null>(null);

  useEffect(() => {
    fetchFridgeFortune(profile, result).then(setFortune).finally(() => setLoading(false));
  }, [profile, result]);

  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">冰箱 · 赛博签</h3>
      {result === 'cola' && (
        <>
          <img src="/DOU/images/element/cola.png" alt="cola" className="overlay-image" />
          <p style={{ textAlign: 'center' }}>赛博可乐！移速 ×1.3</p>
          {isWeekend() && <p style={{ textAlign: 'center', color: '#ff9966', fontSize: 12 }}>周末多巴胺溢出</p>}
        </>
      )}
      {result === 'expired' && <p style={{ textAlign: 'center', color: '#888' }}>过期可乐...卡 Bug 闪烁中</p>}
      {result === 'empty' && <p style={{ textAlign: 'center', color: '#888', marginBottom: 8 }}>只剩半瓶冷却液了。</p>}
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
        <h3 className="panel-title">翻找垃圾桶</h3>
        <TypewriterText text={(payload.message as string) || (payload.empty ? '只剩电子灰尘了。' : '什么都没找到...')} />
      </Overlay>
    );
  }

  const item = getCollectible(payload.collectibleId as string);
  return (
    <Overlay open onClose={onClose}>
      <h3 className="panel-title">🔍 电子考古报告</h3>
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
