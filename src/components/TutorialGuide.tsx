import { useEffect } from 'react';
import { HOT_ZONES } from '@/data/hotzones';
import { TUTORIAL_STEPS, type TutorialStep } from '@/data/tutorial';
import type { RoomId } from '@/types';

interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
  scope?: 'stage' | 'viewport';
}

interface StageFrame {
  left: number;
  top: number;
  width: number;
  height: number;
}

const OPENING_MAINLINE_STEPS = [
  '先让分身在 404 号房间稳定运行，接通办公区与生活区。',
  '继续前往数据林海，记录动物与场景信息，补全这个世界缺失的生命数据。',
  '解锁娱乐模块，让分身学会休息、探索与快乐，完成日常循环。',
];

function getHotzoneSpotlight(step: TutorialStep, currentRoom: RoomId): HighlightRect | null {
  if (step.hotZoneId === 'W01' && currentRoom === 'room_working') {
    return { x: 28, y: 34, w: 16, h: 17, scope: 'stage' };
  }

  const zone = HOT_ZONES.find((z) => z.id === step.hotZoneId);
  if (!zone || zone.room !== currentRoom) return null;
  return { x: zone.x, y: zone.y, w: zone.w, h: zone.h, scope: 'stage' };
}

function getHighlight(step: TutorialStep, currentRoom: RoomId, petPos: { x: number; y: number }): HighlightRect | null {
  switch (step.target) {
    case 'none': return null;
    case 'pet': return { x: petPos.x - 6, y: petPos.y - 8, w: 14, h: 16, scope: 'stage' };
    case 'shards': return { x: 72, y: 0, w: 26, h: 12 };
    case 'settings': return { x: 0, y: 82, w: 14, h: 16 };
    case 'collection': return { x: 82, y: 82, w: 16, h: 16 };
    case 'tabs': return { x: 30, y: 88, w: 40, h: 12 };
    case 'tab-working': return { x: 30, y: 88, w: 20, h: 12 };
    case 'tab-living': return { x: 50, y: 88, w: 20, h: 12 };
    case 'hotzone': return getHotzoneSpotlight(step, currentRoom);
    default: return null;
  }
}

function getHighlightStyle(rect: HighlightRect, stageFrame: StageFrame) {
  if (rect.scope === 'stage') {
    return {
      left: `${stageFrame.left + (stageFrame.width * rect.x) / 100}px`,
      top: `${stageFrame.top + (stageFrame.height * rect.y) / 100}px`,
      width: `${(stageFrame.width * rect.w) / 100}px`,
      height: `${(stageFrame.height * rect.h) / 100}px`,
    };
  }

  return {
    left: `${rect.x}%`,
    top: `${rect.y}%`,
    width: `${rect.w}%`,
    height: `${rect.h}%`,
  };
}

export function TutorialGuide({
  active, stepIndex, currentRoom, petPos, stageFrame, onNext, onSkip, onSwitchRoom,
}: {
  active: boolean; stepIndex: number; currentRoom: RoomId;
  petPos: { x: number; y: number };
  stageFrame: StageFrame;
  onNext: () => void; onSkip: () => void; onSwitchRoom: (room: RoomId) => void;
}) {
  const step = TUTORIAL_STEPS[stepIndex];
  const total = TUTORIAL_STEPS.length;

  useEffect(() => {
    if (!active || !step?.switchToRoom || currentRoom === step.switchToRoom) return;
    onSwitchRoom(step.switchToRoom);
  }, [active, step, currentRoom, onSwitchRoom]);

  if (!active || !step) return null;

  const highlight = getHighlight(step, currentRoom, petPos);
  const isLast = stepIndex >= total - 1;

  return (
    <div className="tutorial-overlay">
      {highlight ? (
        <div className="tutorial-spotlight" style={getHighlightStyle(highlight, stageFrame)} />
      ) : (
        <div className="tutorial-dim-full" />
      )}
      <div className={`tutorial-card ${highlight ? 'tutorial-card-positioned' : 'tutorial-card-center'}`}>
        <div className="tutorial-progress">
          <span className="tutorial-step-label">探索指引 {stepIndex + 1}/{total}</span>
          <div className="tutorial-progress-bar">
            <div className="tutorial-progress-fill" style={{ width: `${((stepIndex + 1) / total) * 100}%` }} />
          </div>
        </div>
        <h3 className="tutorial-title">{step.title}</h3>
        <p className="tutorial-body">{step.body}</p>
        {step.tip && <p className="tutorial-tip">💡 {step.tip}</p>}
        {step.target === 'hotzone' && <p className="tutorial-hint">👆 高亮区域可点击探索</p>}
        <div className="tutorial-actions">
          <button type="button" className="btn-secondary tutorial-skip" onClick={onSkip}>跳过指引</button>
          <button type="button" className="btn-primary" onClick={onNext}>{isLast ? '开始探索' : '下一步'}</button>
        </div>
      </div>
    </div>
  );
}

export function WelcomeModal({ open, nickname, onStart, onSkip }: {
  open: boolean; nickname: string; onStart: () => void; onSkip: () => void;
}) {
  if (!open) return null;
  return (
    <div className="tutorial-overlay">
      <div className="tutorial-dim-full" />
      <div className="tutorial-card tutorial-card-center welcome-card">
        <div className="welcome-badge">NEW</div>
        <h2 className="tutorial-title">入住成功，{nickname || '新住户'}！</h2>
        <div className="opening-story-card">
          <div className="opening-story-label">故事引子</div>
          <p className="tutorial-body">
            你并不是凭空诞生在这里的住户，而是一段从损坏归档中被重新唤醒的赛博分身。
            系统把你送进 404 号房间，不是为了暂住，而是要你在这里重新接通生活、整理记忆碎片，
            让这个差点失真的小世界恢复稳定运行。
          </p>
        </div>
        <p className="tutorial-body">你的数字分身已经入驻 404 号房间。这里看起来安静，其实到处都能点——电脑、冰箱、垃圾桶、收藏柜……</p>
        <div className="opening-objective-panel">
          <section className="opening-objective-block">
            <div className="opening-objective-title">当前主线</div>
            <ul className="opening-objective-list">
              {OPENING_MAINLINE_STEPS.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </section>
          <section className="opening-objective-block opening-objective-block-final">
            <div className="opening-objective-title">最终目标</div>
            <p className="tutorial-body">
              收集全部 15 件赛博藏品后，系统会自动补全终极藏品「像素之魂」。
              那意味着这名赛博分身不再只是临时数据，而是真正在 404 号房间留下了完整的存在证明。
            </p>
          </section>
        </div>
        <p className="tutorial-body" style={{ marginTop: 8 }}>要不要先跟着指引走一圈，看看每个地方是干什么的？</p>
        <div className="tutorial-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn-secondary" onClick={onSkip}>直接探索</button>
          <button type="button" className="btn-primary" onClick={onStart}>开始指引</button>
        </div>
      </div>
    </div>
  );
}
