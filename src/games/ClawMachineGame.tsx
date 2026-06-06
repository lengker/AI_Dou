import { useCallback, useEffect, useRef, useState } from 'react';
import { setupPixelCanvas, drawPixelText } from '@/games/pixelCanvas';
import { vibrate } from '@/utils/sound';

const W = 360;
const H = 520;
const GRABS = 6;
const PRIZES = [
  { id: 0, name: '像素猫', color: '#ff8844', emoji: '🐱', shards: 3 },
  { id: 1, name: '数据云', color: '#88ccff', emoji: '☁', shards: 2 },
  { id: 2, name: '故障星', color: '#ffdd44', emoji: '★', shards: 4 },
  { id: 3, name: '赛博心', color: '#ff6688', emoji: '♥', shards: 2 },
  { id: 4, name: 'CPU块', color: '#aaaaaa', emoji: '▣', shards: 5 },
  { id: 5, name: '神秘盒', color: '#cc88ff', emoji: '?', shards: 3 },
];

type Phase = 'move' | 'drop' | 'grab' | 'rise' | 'result';

interface ClawMachineGameProps {
  onExit: (shardsEarned: number) => void;
}

export function ClawMachineGame({ onExit }: ClawMachineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clawX = useRef(W / 2);
  const clawY = useRef(48);
  const phase = useRef<Phase>('move');
  const grabbed = useRef<typeof PRIZES[0] | null>(null);
  const prizeTaken = useRef<Set<number>>(new Set());
  const animRef = useRef(0);

  const [grabsLeft, setGrabsLeft] = useState(GRABS);
  const [totalShards, setTotalShards] = useState(0);
  const [message, setMessage] = useState('← → 移动 · 空格/按钮抓取');
  const [showResult, setShowResult] = useState(false);
  const [clawPhase, setClawPhase] = useState<Phase>('move');
  const grabsLeftRef = useRef(GRABS);
  const totalRef = useRef(0);

  const drawPrize = (
    ctx: CanvasRenderingContext2D,
    p: (typeof PRIZES)[0],
    x: number,
    y: number,
    scale = 1,
  ) => {
    const s = 28 * scale;
    ctx.fillStyle = p.color;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
    ctx.strokeStyle = '#00000044';
    ctx.lineWidth = 2;
    ctx.strokeRect(x - s / 2, y - s / 2, s, s);
    ctx.fillStyle = '#fff';
    ctx.font = `${14 * scale}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(p.emoji, x, y + 5);
  };

  const prizePositions = useCallback(() => {
    const positions: { p: (typeof PRIZES)[0]; x: number; y: number }[] = [];
    PRIZES.forEach((p, i) => {
      if (prizeTaken.current.has(p.id)) return;
      const col = i % 3;
      const row = Math.floor(i / 3);
      positions.push({ p, x: 70 + col * 110, y: 320 + row * 70 });
    });
    return positions;
  }, []);

  const tryGrab = useCallback(() => {
    if (phase.current !== 'move' || grabsLeftRef.current <= 0) return;
    phase.current = 'drop';
    setClawPhase('drop');
    setMessage('下放中...');
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') clawX.current = Math.max(40, clawX.current - 18);
      if (e.key === 'ArrowRight') clawX.current = Math.min(W - 40, clawX.current + 18);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tryGrab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tryGrab]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = setupPixelCanvas(canvas, W, H);

    const step = () => {
      if (phase.current === 'drop') {
        clawY.current += 4;
        if (clawY.current >= 280) {
          phase.current = 'grab';
          setClawPhase('grab');
          const positions = prizePositions();
          let hit: (typeof positions)[0] | null = null;
          let best = 999;
          for (const pos of positions) {
            const d = Math.abs(pos.x - clawX.current);
            if (d < 36 && d < best) {
              best = d;
              hit = pos;
            }
          }
          if (hit && Math.random() < 0.42 + (36 - best) / 80) {
            grabbed.current = hit.p;
            prizeTaken.current.add(hit.p.id);
            setMessage(`抓住了 ${hit.p.name}！`);
            vibrate(40);
          } else {
            grabbed.current = null;
            setMessage('滑掉了…再试一次');
          }
          phase.current = 'rise';
          setClawPhase('rise');
        }
      } else if (phase.current === 'rise') {
        clawY.current -= 3;
        if (clawY.current <= 48) {
          phase.current = 'move';
          setClawPhase('move');
          grabsLeftRef.current -= 1;
          setGrabsLeft(grabsLeftRef.current);
          if (grabbed.current) {
            totalRef.current += grabbed.current.shards;
            setTotalShards(totalRef.current);
          }
          grabbed.current = null;
          if (grabsLeftRef.current <= 0) {
            setShowResult(true);
            setMessage('本局结束');
          } else {
            setMessage(`剩余 ${grabsLeftRef.current} 次 · ← → 移动`);
          }
        }
      }

      ctx.fillStyle = '#1a0a20';
      ctx.fillRect(0, 0, W, H);

      // 玻璃罩
      ctx.fillStyle = '#2d1a40';
      ctx.fillRect(12, 60, W - 24, H - 120);
      ctx.strokeStyle = '#00ffcc55';
      ctx.lineWidth = 3;
      ctx.strokeRect(12, 60, W - 24, H - 120);

      drawPixelText(ctx, '赛博抓娃娃机', W / 2, 32, '#ff88cc', 10);
      drawPixelText(ctx, `碎片 +${totalRef.current}  剩余 ${grabsLeftRef.current} 次`, W / 2, 52, '#aaa', 7);

      // 轨道
      ctx.fillStyle = '#444';
      ctx.fillRect(20, 44, W - 40, 8);

      // 线索
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(clawX.current, 52);
      ctx.lineTo(clawX.current, clawY.current - 16);
      ctx.stroke();

      // 爪子
      const open = phase.current === 'grab' ? 8 : 18;
      ctx.fillStyle = '#ccc';
      ctx.fillRect(clawX.current - 20, clawY.current - 8, 40, 10);
      ctx.fillStyle = '#aaa';
      ctx.fillRect(clawX.current - open, clawY.current + 2, 12, 14);
      ctx.fillRect(clawX.current + open - 12, clawY.current + 2, 12, 14);

      if (grabbed.current && (phase.current === 'rise' || phase.current === 'grab')) {
        drawPrize(ctx, grabbed.current, clawX.current, clawY.current + 24, 0.8);
      }

      for (const { p, x, y } of prizePositions()) {
        drawPrize(ctx, p, x, y, 1);
        ctx.fillStyle = '#ffffff66';
        ctx.font = '7px monospace';
        ctx.fillText(`+${p.shards}`, x, y + 22);
      }

      // 出口槽
      ctx.fillStyle = '#ffd70022';
      ctx.fillRect(W / 2 - 40, H - 72, 80, 36);
      drawPixelText(ctx, '出口', W / 2, H - 48, '#ffd700', 8);

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [prizePositions]);

  return (
    <div className="arcade-game-wrap">
      <button type="button" className="btn-secondary arcade-game-back" onClick={() => onExit(totalRef.current)}>
        ← 返回大厅
      </button>
      <canvas ref={canvasRef} className="arcade-canvas" />
      <p className="arcade-hint">{message}</p>
      <div className="arcade-claw-controls">
        <button type="button" className="btn-secondary claw-btn" onClick={() => { clawX.current = Math.max(40, clawX.current - 24); }}>◀</button>
        <button type="button" className="btn-primary claw-btn grab-btn" onClick={tryGrab} disabled={grabsLeft <= 0 || clawPhase !== 'move'}>
          抓取!
        </button>
        <button type="button" className="btn-secondary claw-btn" onClick={() => { clawX.current = Math.min(W - 40, clawX.current + 24); }}>▶</button>
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
            <button type="button" className="btn-primary" onClick={() => onExit(totalRef.current)}>
              收入囊中
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
