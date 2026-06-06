import { useEffect } from 'react';
import { HOT_ZONES } from '@/data/hotzones';
import { TUTORIAL_STEPS, type TutorialStep } from '@/data/tutorial';
import type { RoomId } from '@/types';

interface HighlightRect { x: number; y: number; w: number; h: number; }

function getHighlight(step: TutorialStep, currentRoom: RoomId, petPos: { x: number; y: number }): HighlightRect | null {
  switch (step.target) {
    case 'none': return null;
    case 'pet': return { x: petPos.x - 6, y: petPos.y - 8, w: 14, h: 16 };
    case 'shards': return { x: 72, y: 0, w: 26, h: 12 };
    case 'settings': return { x: 0, y: 82, w: 14, h: 16 };
    case 'collection': return { x: 82, y: 82, w: 16, h: 16 };
    case 'tabs': return { x: 30, y: 88, w: 40, h: 12 };
    case 'tab-working': return { x: 30, y: 88, w: 20, h: 12 };
    case 'tab-living': return { x: 50, y: 88, w: 20, h: 12 };
    case 'hotzone': {
      const zone = HOT_ZONES.find((z) => z.id === step.hotZoneId);
      if (!zone || zone.room !== currentRoom) return null;
      return { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
    }
    default: return null;
  }
}

export function TutorialGuide({
  active, stepIndex, currentRoom, petPos, onNext, onSkip, onSwitchRoom,
}: {
  active: boolean; stepIndex: number; currentRoom: RoomId;
  petPos: { x: number; y: number };
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
        <div className="tutorial-spotlight" style={{ left: `${highlight.x}%`, top: `${highlight.y}%`, width: `${highlight.w}%`, height: `${highlight.h}%` }} />
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
        <p className="tutorial-body">你的数字分身已经入驻 404 号房间。这里看起来安静，其实到处都能点——电脑、冰箱、垃圾桶、收藏柜……</p>
        <p className="tutorial-body" style={{ marginTop: 8 }}>要不要先跟着指引走一圈，看看每个地方是干什么的？</p>
        <div className="tutorial-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn-secondary" onClick={onSkip}>直接探索</button>
          <button type="button" className="btn-primary" onClick={onStart}>开始指引</button>
        </div>
      </div>
    </div>
  );
}
