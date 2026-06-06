import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { setupPixelCanvas } from '@/games/pixelCanvas';
import { CLAW_PRIZES, type ClawPrizeDef } from '@/data/clawPrizes';
import { vibrate } from '@/utils/sound';

const W = 360;
const H = 480;
const GRABS = 6;
const RAIL_Y = 86;
const CLAW_HOME_Y = 108;
const FLOOR_Y = 408;
const INTERIOR = { left: 32, right: 328, top: 68, bottom: 432 };
const DROP = { x: 58, y: 418, w: 52, h: 38 };
/** 出口与玩偶堆之间的挡板（侧视竖隔板） */
const BAFFLE = { x: 90, top: 300, w: 12 };
const PILE_X_MIN = 104;
const CLAW_X_MIN = 72;
const CLAW_X_MAX = 300;
const AIM_RADIUS = 34;
const PRIZE_COUNT = 60;

type Phase = 'move' | 'drop' | 'grab' | 'rise' | 'carry' | 'release' | 'return';
/** 单次抓取预定结果：空抓 / 脱钩（夹住后滑落）/ 抓中 */
type GrabOutcome = 'miss' | 'slip' | 'success';

function buildGrabSchedule(): GrabOutcome[] {
  const list: GrabOutcome[] = ['miss', 'miss', 'slip', 'slip', 'success', 'success'];
  for (let i = list.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

interface ClawMachineGameProps {
  onExit: (shardsEarned: number) => void;
}

interface PrizeInstance {
  uid: string;
  def: ClawPrizeDef;
  x: number;
  y: number;
  layer: number;
}

interface FallingPrize {
  def: ClawPrizeDef;
  x: number;
  y: number;
  vy: number;
}

function loadPrizeImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/** 侧视堆叠：挡板右侧密集堆放 */
function buildPrizePile(): PrizeInstance[] {
  const pool = Array.from({ length: PRIZE_COUNT }, (_, i) => CLAW_PRIZES[i % CLAW_PRIZES.length]);
  return pool.map((def, i) => {
    const col = i % 11;
    const layer = Math.floor(i / 11);
    const x = PILE_X_MIN + col * 20 + (layer % 2) * 7 + ((i * 5) % 4);
    const y = FLOOR_Y - 4 - layer * 13 - (col % 3) * 4;
    return { uid: `${def.id}_${i}`, def, x, y, layer };
  });
}

function drawUiText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  size: number,
  align: CanvasTextAlign = 'left',
) {
  ctx.fillStyle = color;
  ctx.font = `600 ${size}px "Noto Sans SC", "Press Start 2P", monospace`;
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

/** 经典侧视 UFO 机台（参考横版抓娃娃机） */
function drawSideCabinet(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#0a0610';
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#1a1028';
  ctx.fillRect(14, 12, W - 28, H - 24);
  ctx.strokeStyle = '#ff6eb4';
  ctx.lineWidth = 4;
  ctx.strokeRect(14, 12, W - 28, H - 24);

  const { left, right, top, bottom } = INTERIOR;
  ctx.fillStyle = '#120820';
  ctx.fillRect(left, top, right - left, bottom - top);

  ctx.strokeStyle = 'rgba(255, 110, 180, 0.18)';
  ctx.lineWidth = 1;
  for (let x = left + 20; x < right; x += 28) {
    ctx.beginPath();
    ctx.moveTo(x, top);
    ctx.lineTo(x, bottom);
    ctx.stroke();
  }

  ctx.fillStyle = '#2a1840';
  ctx.fillRect(left, FLOOR_Y - 4, right - left, bottom - FLOOR_Y + 4);
  ctx.strokeStyle = '#ff6eb4';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, FLOOR_Y);
  ctx.lineTo(right, FLOOR_Y);
  ctx.stroke();

  ctx.fillStyle = '#0a0610';
  ctx.fillRect(DROP.x - DROP.w / 2, DROP.y - DROP.h / 2, DROP.w, DROP.h);
  ctx.strokeStyle = '#ff6eb4';
  ctx.lineWidth = 3;
  ctx.strokeRect(DROP.x - DROP.w / 2, DROP.y - DROP.h / 2, DROP.w, DROP.h);
  drawUiText(ctx, 'DROP', DROP.x, DROP.y + 5, '#ff4488', 11, 'center');

  const baffleGrad = ctx.createLinearGradient(BAFFLE.x, 0, BAFFLE.x + BAFFLE.w, 0);
  baffleGrad.addColorStop(0, '#5a4868');
  baffleGrad.addColorStop(0.5, '#ff6eb4');
  baffleGrad.addColorStop(1, '#3a3050');
  ctx.fillStyle = baffleGrad;
  ctx.fillRect(BAFFLE.x, BAFFLE.top, BAFFLE.w, FLOOR_Y - BAFFLE.top + 6);
  ctx.strokeStyle = '#ff8cc8';
  ctx.lineWidth = 2;
  ctx.strokeRect(BAFFLE.x, BAFFLE.top, BAFFLE.w, FLOOR_Y - BAFFLE.top + 6);
  drawUiText(ctx, '挡板', BAFFLE.x + BAFFLE.w / 2, BAFFLE.top + 14, '#ffc8e0', 8, 'center');

  ctx.fillStyle = '#3a3450';
  ctx.fillRect(left + 4, RAIL_Y - 6, right - left - 8, 10);
  ctx.fillStyle = '#5a5470';
  ctx.fillRect(left + 4, RAIL_Y - 8, right - left - 8, 4);
}

function drawRailMarker(ctx: CanvasRenderingContext2D, clawX: number) {
  ctx.fillStyle = '#ffd54a';
  ctx.beginPath();
  ctx.moveTo(clawX, RAIL_Y - 14);
  ctx.lineTo(clawX - 7, RAIL_Y - 24);
  ctx.lineTo(clawX + 7, RAIL_Y - 24);
  ctx.closePath();
  ctx.fill();
}

function drawSideClaw(ctx: CanvasRenderingContext2D, x: number, y: number, open: boolean) {
  ctx.strokeStyle = '#888899';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, RAIL_Y + 2);
  ctx.lineTo(x, y - 8);
  ctx.stroke();

  ctx.fillStyle = '#ff6eb4';
  ctx.fillRect(x - 14, y - 10, 28, 9);
  ctx.fillStyle = '#cc4a88';
  ctx.fillRect(x - 3, y - 1, 6, 6);

  const spread = open ? 14 : 8;
  ctx.strokeStyle = '#ff8cc8';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 4);
  ctx.lineTo(x - spread, y + 20);
  ctx.moveTo(x + 6, y + 4);
  ctx.lineTo(x + spread, y + 20);
  ctx.moveTo(x, y + 4);
  ctx.lineTo(x, y + 22);
  ctx.stroke();
}

export function ClawMachineGame({ onExit }: ClawMachineGameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const clawX = useRef(180);
  const clawY = useRef(CLAW_HOME_Y);
  const phase = useRef<Phase>('move');
  const grabbed = useRef<PrizeInstance | null>(null);
  const takenUids = useRef<Set<string>>(new Set());
  const targetUid = useRef<string | null>(null);
  const targetDropY = useRef(FLOOR_Y - 30);
  const releaseT = useRef(0);
  const releasePrizeY = useRef(0);
  const carrySlipChecked = useRef(false);
  const grabSchedule = useRef(buildGrabSchedule());
  const grabAttemptIndex = useRef(0);
  const currentOutcome = useRef<GrabOutcome>('miss');
  const fallingPrizes = useRef<FallingPrize[]>([]);
  const spriteMap = useRef<Record<string, HTMLImageElement>>({});
  const animRef = useRef(0);
  const pulseRef = useRef(0);

  const [grabsLeft, setGrabsLeft] = useState(GRABS);
  const [totalShards, setTotalShards] = useState(0);
  const [message, setMessage] = useState('◀ ▶ 移动爪子对准玩偶，按抓取');
  const [aimLabel, setAimLabel] = useState('当前瞄准：—');
  const [showResult, setShowResult] = useState(false);
  const [clawPhase, setClawPhase] = useState<Phase>('move');
  const [loading, setLoading] = useState(true);
  const [caughtPrizeIds, setCaughtPrizeIds] = useState<string[]>([]);
  const grabsLeftRef = useRef(GRABS);
  const totalRef = useRef(0);

  const prizePile = useMemo(() => buildPrizePile(), []);

  const caughtPrizes = caughtPrizeIds
    .map((id) => CLAW_PRIZES.find((p) => p.id === id))
    .filter((p): p is ClawPrizeDef => !!p);

  const findAimTarget = useCallback((x: number): PrizeInstance | null => {
    let best: PrizeInstance | null = null;
    let bestDist = AIM_RADIUS;
    for (const inst of prizePile) {
      if (takenUids.current.has(inst.uid)) continue;
      const dist = Math.abs(inst.x - x);
      if (dist < bestDist) {
        bestDist = dist;
        best = inst;
      }
    }
    return best;
  }, [prizePile]);

  const refreshAimLabel = useCallback((x: number) => {
    const target = findAimTarget(x);
    if (!target) {
      setAimLabel('当前瞄准：空（对准下方玩偶）');
      return;
    }
    setAimLabel(`当前瞄准：${target.def.name} (+${target.def.shards})`);
  }, [findAimTarget]);

  const finishTurn = useCallback(() => {
    grabsLeftRef.current -= 1;
    setGrabsLeft(grabsLeftRef.current);
    grabbed.current = null;
    targetUid.current = null;
    phase.current = 'move';
    setClawPhase('move');
    refreshAimLabel(clawX.current);
    if (grabsLeftRef.current <= 0 || takenUids.current.size >= prizePile.length) {
      setShowResult(true);
      setMessage('本局结束');
    } else {
      setMessage(`剩余 ${grabsLeftRef.current} 次 · 抓稳后运到左下 DROP`);
    }
  }, [prizePile.length, refreshAimLabel]);

  const moveClaw = useCallback((delta: number) => {
    if (phase.current !== 'move') return;
    clawX.current = Math.max(CLAW_X_MIN, Math.min(CLAW_X_MAX, clawX.current + delta * 14));
    refreshAimLabel(clawX.current);
  }, [refreshAimLabel]);

  const tryGrab = useCallback(() => {
    if (phase.current !== 'move' || grabsLeftRef.current <= 0 || loading) return;
    currentOutcome.current = grabSchedule.current[grabAttemptIndex.current] ?? 'miss';
    grabAttemptIndex.current += 1;
    const target = findAimTarget(clawX.current);
    targetUid.current = target?.uid ?? null;
    targetDropY.current = target ? target.y - 22 : FLOOR_Y - 20;
    phase.current = 'drop';
    setClawPhase('drop');
    setMessage(target ? `下放：${target.def.name}` : '空爪下放…');
  }, [findAimTarget, loading]);

  useEffect(() => {
    refreshAimLabel(clawX.current);
  }, [refreshAimLabel]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') moveClaw(-1);
      if (e.key === 'ArrowRight') moveClaw(1);
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        tryGrab();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [moveClaw, tryGrab]);

  useEffect(() => {
    let alive = true;
    Promise.all([...new Map(CLAW_PRIZES.map((p) => [p.id, p])).values()].map((p) => loadPrizeImage(p.image)))
      .then((images) => {
        if (!alive) return;
        const defs = [...new Map(CLAW_PRIZES.map((p) => [p.id, p])).values()];
        spriteMap.current = Object.fromEntries(defs.map((p, i) => [p.id, images[i]]));
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setMessage('玩偶加载失败');
        setLoading(false);
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
    const ctx = setupPixelCanvas(canvas, W, H);

    const step = (now: number) => {
      pulseRef.current = (Math.sin(now / 200) + 1) / 2;

      if (phase.current === 'drop') {
        clawY.current += 5;
        if (clawY.current >= targetDropY.current) {
          const target = targetUid.current
            ? prizePile.find((p) => p.uid === targetUid.current) ?? null
            : null;
          const outcome = currentOutcome.current;
          const canHold = outcome === 'success' || outcome === 'slip';
          if (canHold && target && !takenUids.current.has(target.uid)) {
            grabbed.current = target;
            takenUids.current.add(target.uid);
            setMessage(`夹住了 ${target.def.name}，移向 DROP…`);
            vibrate(35);
          } else {
            grabbed.current = null;
            setMessage(target ? `${target.def.name} 没夹稳` : '空爪');
          }
          phase.current = 'rise';
          setClawPhase('rise');
        }
      } else if (phase.current === 'rise') {
        clawY.current -= 4.5;
        if (clawY.current <= CLAW_HOME_Y) {
          clawY.current = CLAW_HOME_Y;
          phase.current = 'carry';
          setClawPhase('carry');
          carrySlipChecked.current = false;
        }
      } else if (phase.current === 'carry') {
        const dx = DROP.x - clawX.current;
        clawX.current += Math.sign(dx) * 3.5;
        if (grabbed.current && !carrySlipChecked.current) {
          carrySlipChecked.current = true;
          if (currentOutcome.current === 'slip') {
            const inst = grabbed.current;
            grabbed.current = null;
            takenUids.current.delete(inst.uid);
            fallingPrizes.current.push({
              def: inst.def,
              x: Math.max(PILE_X_MIN + 8, clawX.current),
              y: clawY.current + 24,
              vy: 1.4,
            });
            setMessage(`${inst.def.name} 运输中脱钩！`);
            vibrate(18);
          }
        }
        if (Math.abs(dx) <= 3) {
          phase.current = 'release';
          setClawPhase('release');
          releaseT.current = 0;
          releasePrizeY.current = clawY.current + 22;
        }
      } else if (phase.current === 'release') {
        releaseT.current += 0.05;
        if (grabbed.current) {
          releasePrizeY.current = lerp(clawY.current + 22, DROP.y, Math.min(1, releaseT.current));
          if (releaseT.current >= 1) {
            const inst = grabbed.current;
            grabbed.current = null;
            totalRef.current += inst.def.shards;
            setTotalShards(totalRef.current);
            setCaughtPrizeIds((c) => [...c, inst.def.id]);
            setMessage(`${inst.def.name} 掉入 DROP！+${inst.def.shards}`);
            vibrate(28);
            phase.current = 'return';
            setClawPhase('return');
          }
        } else if (releaseT.current >= 0.45) {
          phase.current = 'return';
          setClawPhase('return');
        }
      } else if (phase.current === 'return') {
        const dx = 180 - clawX.current;
        clawX.current += Math.sign(dx) * 3;
        if (Math.abs(dx) <= 3) finishTurn();
      }

      for (let i = fallingPrizes.current.length - 1; i >= 0; i -= 1) {
        const fp = fallingPrizes.current[i];
        fp.vy += 0.2;
        fp.y += fp.vy;
        if (fp.x < PILE_X_MIN) fp.x = PILE_X_MIN + 4;
        if (fp.y > FLOOR_Y) fallingPrizes.current.splice(i, 1);
      }

      drawSideCabinet(ctx);

      ctx.fillStyle = 'rgba(255, 110, 180, 0.12)';
      ctx.fillRect(22, 22, 118, 36);
      ctx.strokeStyle = '#ff6eb4';
      ctx.strokeRect(22, 22, 118, 36);
      drawUiText(ctx, `SCORE ${String(totalRef.current).padStart(6, '0')}`, 32, 44, '#fff', 10);
      drawUiText(ctx, `池 ${prizePile.length - takenUids.current.size}/${prizePile.length}`, 200, 44, '#92efe7', 10);
      drawUiText(ctx, `剩余 ${grabsLeftRef.current} 次`, 280, 44, '#ffd86b', 10, 'right');

      const aimTarget = phase.current === 'move' ? findAimTarget(clawX.current) : null;
      const sorted = prizePile
        .filter((p) => !takenUids.current.has(p.uid) && grabbed.current?.uid !== p.uid)
        .sort((a, b) => a.layer - b.layer);

      for (const inst of sorted) {
        const image = spriteMap.current[inst.def.id];
        const size = 28 + inst.layer * 2;
        if (image) drawPrizeSprite(ctx, image, inst.x, inst.y, size);
        if (aimTarget?.uid === inst.uid && phase.current === 'move') {
          ctx.strokeStyle = `rgba(103, 244, 239, ${0.5 + pulseRef.current * 0.4})`;
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.arc(inst.x, inst.y, 18, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      for (const fp of fallingPrizes.current) {
        const image = spriteMap.current[fp.def.id];
        if (image) drawPrizeSprite(ctx, image, fp.x, fp.y, 26);
      }

      drawRailMarker(ctx, clawX.current);
      drawSideClaw(ctx, clawX.current, clawY.current, phase.current === 'drop' || phase.current === 'release');

      if (grabbed.current && (phase.current === 'rise' || phase.current === 'carry')) {
        const image = spriteMap.current[grabbed.current.def.id];
        if (image) drawPrizeSprite(ctx, image, clawX.current, clawY.current + 26, 28);
      }
      if (grabbed.current && phase.current === 'release') {
        const image = spriteMap.current[grabbed.current.def.id];
        if (image) drawPrizeSprite(ctx, image, clawX.current, releasePrizeY.current, 28);
      }

      if (phase.current === 'move') {
        ctx.strokeStyle = `rgba(255, 213, 74, ${0.35 + pulseRef.current * 0.25})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 4]);
        ctx.beginPath();
        ctx.moveTo(clawX.current, CLAW_HOME_Y + 8);
        ctx.lineTo(clawX.current, FLOOR_Y - 8);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      drawUiText(ctx, aimLabel, W / 2, 468, '#c8a0d8', 10, 'center');

      animRef.current = requestAnimationFrame(step);
    };

    animRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animRef.current);
  }, [aimLabel, finishTurn, findAimTarget, loading, prizePile]);

  return (
    <div className="arcade-game-wrap claw-game-wrap">
      <button type="button" className="btn-secondary arcade-game-back" onClick={() => onExit(totalRef.current)}>
        ← 返回大厅
      </button>
      <p className="arcade-hint claw-aim-hint">{message}</p>
      <div className="claw-canvas-shell">
        <canvas ref={canvasRef} className="arcade-canvas claw-canvas claw-canvas-side" />
        <div className="claw-overlay-controls claw-overlay-controls-side">
          <button type="button" className="btn-secondary claw-btn claw-btn-overlay" onClick={() => moveClaw(-1)} disabled={clawPhase !== 'move'} aria-label="左移">◀</button>
          <button
            type="button"
            className="btn-primary claw-btn grab-btn claw-btn-overlay claw-grab-overlay"
            onClick={tryGrab}
            disabled={grabsLeft <= 0 || clawPhase !== 'move' || loading}
          >
            抓取
          </button>
          <button type="button" className="btn-secondary claw-btn claw-btn-overlay" onClick={() => moveClaw(1)} disabled={clawPhase !== 'move'} aria-label="右移">▶</button>
        </div>
      </div>
      <p className="arcade-hint claw-depth-hint">每局 6 次 · 2 抓中 / 2 脱钩 / 2 空抓 · 左右对准后抓取</p>
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
              {caughtPrizes.length > 0 ? caughtPrizes.map((prize, i) => (
                <div key={`${prize.id}-${i}`} className="claw-result-item">
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
