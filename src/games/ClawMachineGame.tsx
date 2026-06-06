import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setupPixelCanvas } from '@/games/pixelCanvas';
import { CLAW_PRIZES, type ClawPrizeDef } from '@/data/clawPrizes';
import { vibrate } from '@/utils/sound';

const W = 360;
const H = 520;
const GRABS = 6;
const LANE_X = [54, 117, 180, 243, 306];
const STACK_Y = [248, 312, 376];
const CLAW_TOP_Y = 62;
const EMPTY_DROP_Y = 392;
const PRIZE_JITTER = [
  [{ x: -4, y: 2 }, { x: 3, y: -4 }, { x: -2, y: 5 }],
  [{ x: 5, y: -1 }, { x: -6, y: 4 }, { x: 4, y: -5 }],
  [{ x: -3, y: 4 }, { x: 2, y: -5 }, { x: -5, y: 2 }],
  [{ x: 4, y: 3 }, { x: -4, y: -3 }, { x: 3, y: 5 }],
  [{ x: -5, y: -2 }, { x: 4, y: 5 }, { x: -3, y: -4 }],
] as const;

type Phase = 'move' | 'drop' | 'grab' | 'rise';

interface ClawMachineGameProps {
  onExit: (shardsEarned: number) => void;
}

interface LanePrizeTarget {
  prize: ClawPrizeDef;
  row: number;
}

function loadPrizeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function drawUiText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  align: CanvasTextAlign = 'center',
) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px "Noto Sans SC", sans-serif`;
  ctx.textAlign = align;
  ctx.fillText(text, x, y);
}

function drawPrizeSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  box: number,
) {
  const scale = Math.min(box / image.width, box / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
}

export function ClawMachineGame({ onExit }: ClawMachineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clawLane = useRef(2);
  const clawY = useRef(CLAW_TOP_Y);
  const phase = useRef<Phase>('move');
  const grabbed = useRef<ClawPrizeDef | null>(null);
  const prizeTaken = useRef<Set<string>>(new Set());
  const activeTarget = useRef<LanePrizeTarget | null>(null);
  const targetDropY = useRef(EMPTY_DROP_Y);
  const spriteMap = useRef<Record<string, HTMLImageElement>>({});
  const animRef = useRef(0);

  const [grabsLeft, setGrabsLeft] = useState(GRABS);
  const [totalShards, setTotalShards] = useState(0);
  const [message, setMessage] = useState('左右换列，对准玩偶后按抓取');
  const [showResult, setShowResult] = useState(false);
  const [clawPhase, setClawPhase] = useState<Phase>('move');
  const [loading, setLoading] = useState(true);
  const [caughtPrizeIds, setCaughtPrizeIds] = useState<string[]>([]);
  const grabsLeftRef = useRef(GRABS);
  const totalRef = useRef(0);
  const laneColumns = useMemo(() => (
    Array.from({ length: 5 }, (_, laneIndex) =>
      CLAW_PRIZES.filter((_, prizeIndex) => prizeIndex % 5 === laneIndex),
    )
  ), []);
  const caughtPrizes = caughtPrizeIds
    .map((id) => CLAW_PRIZES.find((prize) => prize.id === id))
    .filter((prize): prize is ClawPrizeDef => !!prize);
  const getLaneTarget = useCallback((laneIndex: number) => {
    const lane = laneColumns[laneIndex];
    const available = lane
      .map((prize, row) => ({ prize, row }))
      .filter(({ prize }) => !prizeTaken.current.has(prize.id));
    if (available.length === 0) return null;
    return available[Math.floor(Math.random() * available.length)];
  }, [laneColumns]);

  const moveLane = useCallback((delta: number) => {
    if (phase.current !== 'move') return;
    clawLane.current = Math.max(0, Math.min(LANE_X.length - 1, clawLane.current + delta));
  }, []);

  const tryGrab = useCallback(() => {
    if (phase.current !== 'move' || grabsLeftRef.current <= 0 || loading) return;
    const target = getLaneTarget(clawLane.current);
    activeTarget.current = target;
    targetDropY.current = target ? STACK_Y[target.row] - 42 : EMPTY_DROP_Y;
    phase.current = 'drop';
    setClawPhase('drop');
    setMessage(target ? '爪子下放中，随机锁定了一只玩偶...' : '这一列空了，碰碰运气');
  }, [getLaneTarget, loading]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveLane(-1);
      if (e.key === 'ArrowRight') moveLane(1);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tryGrab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveLane, tryGrab]);

  useEffect(() => {
    let alive = true;
    Promise.all(CLAW_PRIZES.map((prize) => loadPrizeImage(prize.image)))
      .then((images) => {
        if (!alive) return;
        spriteMap.current = Object.fromEntries(images.map((image, index) => [CLAW_PRIZES[index].id, image]));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setMessage('玩偶装柜失败，返回大厅后可重新进入。');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = setupPixelCanvas(canvas, W, H);

    const step = () => {
      const clawX = LANE_X[clawLane.current];
      const targetPrize = activeTarget.current;
      if (phase.current === 'drop') {
        clawY.current += 5;
        if (clawY.current >= targetDropY.current) {
          phase.current = 'grab';
          setClawPhase('grab');
          if (targetPrize) {
            if (Math.random() < 0.5) {
              grabbed.current = targetPrize.prize;
              prizeTaken.current.add(targetPrize.prize.id);
              setMessage(`抓到了 ${targetPrize.prize.name}！`);
              vibrate(40);
            } else {
              grabbed.current = null;
              setMessage(`${targetPrize.prize.name} 从爪边滑走了，再试一次`);
            }
          } else {
            grabbed.current = null;
            setMessage('这一列已经空了，换一列再试');
          }
          phase.current = 'rise';
          setClawPhase('rise');
        }
      } else if (phase.current === 'rise') {
        clawY.current -= 4;
        if (clawY.current <= CLAW_TOP_Y) {
          phase.current = 'move';
          setClawPhase('move');
          clawY.current = CLAW_TOP_Y;
          grabsLeftRef.current -= 1;
          setGrabsLeft(grabsLeftRef.current);
          const settledPrize = grabbed.current;
          if (settledPrize) {
            totalRef.current += settledPrize.shards;
            setTotalShards(totalRef.current);
            setCaughtPrizeIds((current) => [...current, settledPrize.id]);
          }
          grabbed.current = null;
          activeTarget.current = null;
          if (grabsLeftRef.current <= 0 || prizeTaken.current.size >= CLAW_PRIZES.length) {
            setShowResult(true);
            setMessage('本局结束');
          } else {
            setMessage(`剩余 ${grabsLeftRef.current} 次，换列继续抓`);
          }
        }
      }

      ctx.fillStyle = '#12071b';
      ctx.fillRect(0, 0, W, H);

      ctx.fillStyle = '#2b1440';
      ctx.fillRect(20, 22, W - 40, H - 44);
      ctx.fillStyle = '#1a0b28';
      ctx.fillRect(34, 48, W - 68, H - 120);
      ctx.strokeStyle = '#6f4a86';
      ctx.lineWidth = 4;
      ctx.strokeRect(34, 48, W - 68, H - 120);

      ctx.fillStyle = '#3c1e58';
      ctx.fillRect(46, 76, W - 92, 324);
      ctx.fillStyle = '#67f4ef22';
      ctx.fillRect(46, 76, W - 92, 324);
      ctx.strokeStyle = '#ff8cd8';
      ctx.lineWidth = 2;
      ctx.strokeRect(46, 76, W - 92, 324);

      ctx.fillStyle = '#4f2f74';
      ctx.fillRect(52, 96, W - 104, 10);
      for (let index = 0; index < LANE_X.length; index += 1) {
        ctx.fillStyle = index === clawLane.current ? '#9ffef4' : '#6f6a90';
        ctx.fillRect(LANE_X[index] - 12, 95, 24, 12);
      }

      ctx.fillStyle = '#f5f2d6';
      ctx.fillRect(56, 414, W - 112, 50);
      ctx.fillStyle = '#c886ff22';
      ctx.fillRect(56, 414, W - 112, 50);
      ctx.strokeStyle = '#ffcb66';
      ctx.strokeRect(56, 414, W - 112, 50);

      drawUiText(ctx, '赛博抓娃娃机', W / 2, 38, '#ffe2fb', 16);
      drawUiText(ctx, `玩偶池 ${CLAW_PRIZES.length - prizeTaken.current.size}/${CLAW_PRIZES.length}`, 52, 64, '#92efe7', 11, 'left');
      drawUiText(ctx, `碎片 +${totalRef.current}`, W - 52, 64, '#ffd86b', 11, 'right');
      drawUiText(ctx, `剩余 ${grabsLeftRef.current} 次`, W / 2, 428, '#402650', 13);
      drawUiText(ctx, '回收槽', W / 2, 448, '#7d4f16', 11);

      for (let laneIndex = 0; laneIndex < laneColumns.length; laneIndex += 1) {
        const lane = laneColumns[laneIndex];
        for (let row = lane.length - 1; row >= 0; row -= 1) {
          const prize = lane[row];
          if (prizeTaken.current.has(prize.id)) continue;
          const jitter = PRIZE_JITTER[laneIndex][row] ?? { x: 0, y: 0 };
          const x = LANE_X[laneIndex] + jitter.x;
          const y = STACK_Y[row] + jitter.y;
          const image = spriteMap.current[prize.id];
          ctx.fillStyle = 'rgba(0, 0, 0, 0.16)';
          ctx.fillRect(x - 18, y + 16, 36, 7);
          if (image) drawPrizeSprite(ctx, image, x, y, row === 0 ? 40 : row === 1 ? 38 : 36);
          drawUiText(ctx, `+${prize.shards}`, x, y + 30, '#fef4c6', 9);
        }
      }

      ctx.strokeStyle = '#b6b0c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(clawX, 108);
      ctx.lineTo(clawX, clawY.current - 12);
      ctx.stroke();

      ctx.fillStyle = '#d9d8e8';
      ctx.fillRect(clawX - 18, clawY.current - 10, 36, 10);
      ctx.fillStyle = '#b2b0c9';
      ctx.fillRect(clawX - 4, clawY.current, 8, 8);
      ctx.strokeStyle = '#d9d8e8';
      ctx.beginPath();
      ctx.moveTo(clawX - 10, clawY.current + 4);
      ctx.lineTo(clawX - 18, clawY.current + 18);
      ctx.moveTo(clawX + 10, clawY.current + 4);
      ctx.lineTo(clawX + 18, clawY.current + 18);
      ctx.moveTo(clawX, clawY.current + 4);
      ctx.lineTo(clawX, clawY.current + 20);
      ctx.stroke();

      if (grabbed.current && (phase.current === 'grab' || phase.current === 'rise')) {
        const image = spriteMap.current[grabbed.current.id];
        if (image) drawPrizeSprite(ctx, image, clawX, clawY.current + 34, 34);
      }

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [laneColumns, loading]);

  return (
    <div className="arcade-game-wrap claw-game-wrap">
      <button type="button" className="btn-secondary arcade-game-back" onClick={() => onExit(totalRef.current)}>
        ← 返回大厅
      </button>
      <div className="claw-canvas-shell">
        <canvas ref={canvasRef} className="arcade-canvas claw-canvas" />
        <div className="claw-overlay-controls">
          <button type="button" className="btn-secondary claw-btn claw-btn-overlay" onClick={() => moveLane(-1)}>◀</button>
          <button type="button" className="btn-primary claw-btn grab-btn claw-btn-overlay claw-grab-overlay" onClick={tryGrab} disabled={grabsLeft <= 0 || clawPhase !== 'move' || loading}>
            抓取
          </button>
          <button type="button" className="btn-secondary claw-btn claw-btn-overlay" onClick={() => moveLane(1)}>▶</button>
        </div>
      </div>
      <div className="arcade-game-actions">
        <button type="button" className="btn-secondary" onClick={() => onExit(totalRef.current)}>
          收手结算 (+{totalShards})
        </button>
      </div>
      {showResult && (
        <div className="arcade-result-overlay">
          <div className="arcade-result-card crt-enter">
            <h3>抓娃娃结算</h3>
            <p className="arcade-result-shards">+{totalShards} 数据碎片</p>
            <div className="claw-result-grid">
              {caughtPrizes.length > 0 ? caughtPrizes.map((prize) => (
                <div key={prize.id} className="claw-result-item">
                  <img src={prize.image} alt={prize.name} />
                  <span>{prize.name}</span>
                </div>
              )) : <p className="claw-result-empty">这次没抓到玩偶，下次再来。</p>}
            </div>
            <button type="button" className="btn-primary" onClick={() => onExit(totalRef.current)}>
              收入囊中
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
