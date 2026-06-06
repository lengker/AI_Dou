import { setupPixelCanvas, drawPixelText, drawCoinSprite } from '@/games/pixelCanvas';
import {
  MACHINE_W,
  PLINKO_H,
  PLAY_MARGIN,
  PLAY_WIDTH,
  playXToNorm,
} from '@/games/coinPusherConfig';

export const PLINKO_W = MACHINE_W;
/** 2D 硬币直径；与推板区间隙 = 2 枚硬币直径 */
export const COIN_DIAMETER_2D = 15;
export const BRIDGE_GAP_PX = COIN_DIAMETER_2D * 2;
const DECK_COLOR = '#3a2d52';

interface PlinkoCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  id: number;
  stuckFrames: number;
  bonusHit?: boolean;
}

interface Peg {
  x: number;
  y: number;
  r: number;
}

export interface Plinko2DCallbacks {
  onBonus: () => void;
  onLanded: (normX: number) => void;
}

const GRAVITY = 0.42;
const FRICTION = 0.985;
const PEG_R = 3.5;
const COIN_R = COIN_DIAMETER_2D / 2;
const ROWS = 7;
const COLS = 6;
const BONUS_W = 54;
const BONUS_H = 12;
const SLOT_SWING_SPEED = 1.25;
const BRIDGE_TOP = PLINKO_H - BRIDGE_GAP_PX;
const LAND_Y = PLINKO_H - 3;

export class Plinko2DEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: Plinko2DCallbacks;
  private coins: PlinkoCoin[] = [];
  private pegs: Peg[] = [];
  private nextId = 0;
  private animId = 0;
  private disposed = false;
  private jackpotActive = false;
  private jackpotLeft = 0;
  private jackpotTimer = 0;
  private time = 0;
  private slotAngle = 0;
  private bonusCenterX = PLINKO_W / 2;

  constructor(canvas: HTMLCanvasElement, callbacks: Plinko2DCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.ctx = setupPixelCanvas(canvas, PLINKO_W, PLINKO_H);
    this.buildPegs();
    this.loop();
  }

  private playLeft() {
    return PLAY_MARGIN;
  }

  private playRight() {
    return PLINKO_W - PLAY_MARGIN;
  }

  /** 2D 投币口沿 180° 弧线左右摆动 */
  private slotX() {
    const travel = PLAY_WIDTH / 2 - 22;
    return PLINKO_W / 2 + Math.sin(this.slotAngle) * travel;
  }

  private buildPegs() {
    const left = this.playLeft();
    const right = this.playRight();
    const top = 40;
    const bottom = BRIDGE_TOP - 22;
    const rowGap = (bottom - top) / (ROWS - 1);
    const colGap = (right - left - 16) / (COLS - 1);

    for (let r = 0; r < ROWS; r++) {
      const offset = r % 2 === 0 ? 0 : colGap / 2;
      const colsThisRow = r === 0 ? COLS - 1 : COLS;
      for (let c = 0; c < colsThisRow; c++) {
        const x = left + 8 + c * colGap + offset;
        if (x < left + 10 || x > right - 10) continue;
        if (r === 0 && Math.abs(x - PLINKO_W / 2) < 16) continue;
        this.pegs.push({ x, y: top + r * rowGap, r: PEG_R });
      }
    }
  }

  private bonusBounds() {
    const y = BRIDGE_TOP - 18;
    const half = BONUS_W / 2;
    return {
      x0: this.bonusCenterX - half,
      x1: this.bonusCenterX + half,
      y0: y,
      y1: y + BONUS_H,
    };
  }

  dropCoin() {
    const sx = this.slotX();
    this.coins.push({
      x: sx,
      y: 12,
      vx: (Math.random() - 0.5) * 0.2,
      vy: 0.14,
      r: COIN_R,
      id: this.nextId++,
      stuckFrames: 0,
      bonusHit: false,
    });
  }

  startJackpotRain(count = 50, durationSec = 3) {
    this.jackpotActive = true;
    this.jackpotLeft = count;
    this.jackpotTimer = 0;
    this.jackpotInterval = durationSec / count;
  }

  private jackpotInterval = 0.06;

  isJackpotActive() {
    return this.jackpotActive;
  }

  private nearbyPegs(c: PlinkoCoin): Peg[] {
    const out: Peg[] = [];
    for (const peg of this.pegs) {
      if (Math.abs(peg.x - c.x) < 24 && Math.abs(peg.y - c.y) < 22) out.push(peg);
    }
    return out;
  }

  private resolvePeg(c: PlinkoCoin, peg: Peg) {
    const dx = c.x - peg.x;
    const dy = c.y - peg.y;
    const dist = Math.hypot(dx, dy) || 0.01;
    const minD = c.r + peg.r - 0.5;
    if (dist >= minD) return;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minD - dist;
    c.x += nx * overlap * 1.05;
    c.y += ny * overlap * 1.05;

    const dot = c.vx * nx + c.vy * ny;
    if (dot < 0) {
      const rest = 0.36;
      c.vx -= (1 + rest) * dot * nx;
      c.vy -= (1 + rest) * dot * ny;
    }
    c.vx += nx * 0.32;
    c.vy += Math.abs(ny) * 0.07 + 0.05;
  }

  /** 经过 BONUS 只触发抽奖，硬币继续下落进 3D */
  private tryBonusHit(c: PlinkoCoin) {
    if (c.bonusHit) return;
    const b = this.bonusBounds();
    if (c.y + c.r < b.y0) return;
    if (c.y - c.r > b.y1 + 8) return;
    if (c.x >= b.x0 - c.r * 0.4 && c.x <= b.x1 + c.r * 0.4) {
      c.bonusHit = true;
      this.callbacks.onBonus();
    }
  }

  private stepCoin(c: PlinkoCoin) {
    c.vy += GRAVITY;
    c.vx *= FRICTION;
    c.vy *= FRICTION;
    c.x += c.vx;
    c.y += c.vy;

    const left = this.playLeft() + c.r;
    const right = this.playRight() - c.r;
    if (c.x < left) { c.x = left; c.vx = Math.abs(c.vx) * 0.3; }
    if (c.x > right) { c.x = right; c.vx = -Math.abs(c.vx) * 0.3; }

    if (c.y < BRIDGE_TOP) {
      for (const peg of this.nearbyPegs(c)) this.resolvePeg(c, peg);
    }

    this.tryBonusHit(c);

    if (Math.abs(c.vx) < 0.05 && c.vy < 0.22 && c.y < BRIDGE_TOP) {
      c.stuckFrames += 1;
      c.vy += 0.1;
      c.vx += (Math.random() - 0.5) * 0.2;
    } else {
      c.stuckFrames = 0;
    }
    if (c.stuckFrames > 10) {
      c.vy = Math.max(c.vy, 0.45);
      c.vx += (Math.random() > 0.5 ? 1 : -1) * 0.5;
      c.stuckFrames = 0;
    }

    if (c.y + c.r > LAND_Y) {
      this.callbacks.onLanded(playXToNorm(c.x));
      return true;
    }
    return false;
  }

  private step(dt: number) {
    this.time += dt;
    this.slotAngle += dt * SLOT_SWING_SPEED;
    const travel = PLAY_WIDTH / 2 - BONUS_W / 2 - 10;
    this.bonusCenterX = PLINKO_W / 2 + Math.sin(this.time * 1.6) * travel;

    if (this.jackpotActive) {
      this.jackpotTimer += dt;
      while (this.jackpotLeft > 0 && this.jackpotTimer >= this.jackpotInterval) {
        this.jackpotTimer -= this.jackpotInterval;
        this.jackpotLeft -= 1;
        this.dropCoin();
      }
      if (this.jackpotLeft <= 0) this.jackpotActive = false;
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.stepCoin(this.coins[i])) {
        this.coins.splice(i, 1);
      }
    }
  }

  /** 2D 摆动投币口 + 示意弧线 */
  private drawMovingSlot() {
    const ctx = this.ctx;
    const cx = PLINKO_W / 2;
    const sx = this.slotX();

    ctx.strokeStyle = 'rgba(0, 255, 204, 0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, 10, PLAY_WIDTH / 2 - 22, 0, Math.PI);
    ctx.stroke();

    ctx.fillStyle = '#00ffcc';
    ctx.fillRect(sx - 4, 8, 8, 8);
    ctx.strokeStyle = '#92efe7';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 4, 8, 8, 8);
  }

  /** 底部衔接带：与 3D 台面同色，三股落币道贯通 */
  private drawBridgeConnector() {
    const ctx = this.ctx;
    const left = this.playLeft();
    const b = this.bonusBounds();

    ctx.fillStyle = DECK_COLOR;
    ctx.fillRect(left, BRIDGE_TOP, PLAY_WIDTH, BRIDGE_GAP_PX);

    ctx.fillStyle = '#2a1a40';
    const lipH = 6;
    ctx.fillRect(left, BRIDGE_TOP, b.x0 - left - 2, lipH);
    ctx.fillRect(b.x1 + 2, BRIDGE_TOP, left + PLAY_WIDTH - b.x1 - 2, lipH);

    const pulse = 0.65 + Math.sin(this.time * 4) * 0.35;
    ctx.fillStyle = `rgba(255, 136, 204, ${0.28 + pulse * 0.18})`;
    ctx.fillRect(b.x0, BRIDGE_TOP - 2, BONUS_W, BONUS_H + 4);
    ctx.strokeStyle = '#ff88cc';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x0, BRIDGE_TOP - 2, BONUS_W, BONUS_H + 4);
    drawPixelText(ctx, 'BONUS', this.bonusCenterX, BRIDGE_TOP + BONUS_H - 2, '#ff88cc', 6);

    ctx.strokeStyle = '#4a3d62';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      const y = BRIDGE_TOP + (BRIDGE_GAP_PX * i) / 4;
      ctx.beginPath();
      ctx.moveTo(left + 6, y);
      ctx.lineTo(left + PLAY_WIDTH - 6, y);
      ctx.stroke();
    }
  }

  private draw() {
    const ctx = this.ctx;
    const left = this.playLeft();

    ctx.fillStyle = '#1a1028';
    ctx.fillRect(0, 0, PLINKO_W, PLINKO_H);

    ctx.fillStyle = '#2a1a40';
    ctx.fillRect(left, 6, PLAY_WIDTH, BRIDGE_TOP - 6);
    ctx.strokeStyle = '#00ffcc55';
    ctx.lineWidth = 2;
    ctx.strokeRect(left, 6, PLAY_WIDTH, BRIDGE_TOP - 6);

    drawPixelText(ctx, 'PLINKO 投币口', PLINKO_W / 2, 22, '#00ffcc', 7);
    this.drawMovingSlot();

    ctx.fillStyle = '#556677';
    for (const peg of this.pegs) {
      ctx.fillRect(peg.x - peg.r, peg.y - peg.r, peg.r * 2, peg.r * 2);
    }

    this.drawBridgeConnector();

    for (const c of this.coins) drawCoinSprite(ctx, c.x, c.y, c.r);
  }

  private lastTime = 0;
  private loop = () => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.loop);
    const now = performance.now();
    const dt = Math.min(this.lastTime ? (now - this.lastTime) / 1000 : 1 / 60, 0.033);
    this.lastTime = now;
    this.step(dt);
    this.draw();
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
  }
}
