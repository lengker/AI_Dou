import { setupPixelCanvas, drawCoinSprite } from '@/games/pixelCanvas';
import {
  MACHINE_W,
  PLINKO_H,
  PLAY_MARGIN,
  PLAY_WIDTH,
  playXToNorm,
} from '@/games/coinPusherConfig';
import {
  bonusPlinkoBounds,
  buildPlinkoCollisionGrid,
  loadTuibiArt,
  plinkoToImage,
} from '@/games/tuibiSprites';

export const PLINKO_W = MACHINE_W;

interface PlinkoCoin {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  id: number;
  stuckFrames: number;
  bonusHit?: boolean;
  phase: 'chute' | 'free';
  chuteT: number;
  chuteExitX: number;
}

export interface Plinko2DCallbacks {
  onBonus: () => void;
  onLanded: (normX: number) => void;
}

const GRAVITY = 0.42;
const FRICTION = 0.985;
const COIN_R = 11;
const LAND_Y = PLINKO_H - 5;
const CHUTE_DURATION = 0.62;

export class Plinko2DEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private callbacks: Plinko2DCallbacks;
  private coins: PlinkoCoin[] = [];
  private nextId = 0;
  private animId = 0;
  private disposed = false;
  private jackpotActive = false;
  private jackpotLeft = 0;
  private jackpotTimer = 0;
  private time = 0;
  private collision: Uint8Array = new Uint8Array(0);
  private artReady = false;

  constructor(canvas: HTMLCanvasElement, callbacks: Plinko2DCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.ctx = setupPixelCanvas(canvas, PLINKO_W, PLINKO_H);
    void loadTuibiArt().then(() => {
      if (this.disposed) return;
      this.collision = buildPlinkoCollisionGrid(PLINKO_W, PLINKO_H);
      this.artReady = true;
    });
    this.loop();
  }

  private playLeft() {
    return PLAY_MARGIN;
  }

  private playRight() {
    return PLINKO_W - PLAY_MARGIN;
  }

  private lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
  }

  dropCoin(x = PLINKO_W / 2) {
    const left = this.playLeft() + COIN_R;
    const right = this.playRight() - COIN_R;
    const exitX = Math.max(left, Math.min(right, x + (Math.random() - 0.5) * PLAY_WIDTH * 0.55));
    this.coins.push({
      x: PLINKO_W / 2,
      y: 6,
      vx: 0,
      vy: 0,
      r: COIN_R,
      id: this.nextId++,
      stuckFrames: 0,
      bonusHit: false,
      phase: 'chute',
      chuteT: 0,
      chuteExitX: exitX,
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

  private sampleSolid(x: number, y: number): boolean {
    if (!this.artReady || this.collision.length === 0) return false;
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    if (ix < 0 || iy < 0 || ix >= PLINKO_W || iy >= PLINKO_H) return ix < 0 || ix >= PLINKO_W;
    return this.collision[iy * PLINKO_W + ix] === 1;
  }

  private resolveImageCollision(c: PlinkoCoin) {
    const bonus = bonusPlinkoBounds(this.time, PLINKO_W, PLINKO_H);
    const samples = [
      [c.x, c.y],
      [c.x - c.r * 0.65, c.y],
      [c.x + c.r * 0.65, c.y],
      [c.x, c.y - c.r * 0.5],
      [c.x, c.y + c.r * 0.5],
    ];

    for (const [sx, sy] of samples) {
      const inBonus =
        sx >= bonus.x0 && sx <= bonus.x1 && sy >= bonus.y0 && sy <= bonus.y1;
      if (inBonus) continue;

      if (this.sampleSolid(sx, sy)) {
        const { ix, iy } = plinkoToImage(sx, sy, PLINKO_W, PLINKO_H);
        const probe = 1.2;
        const left = this.sampleSolid(sx - probe, sy);
        const right = this.sampleSolid(sx + probe, sy);
        const up = this.sampleSolid(sx, sy - probe);
        const down = this.sampleSolid(sx, sy + probe);

        if (!left || !right) {
          c.x += left ? probe * 0.9 : -probe * 0.9;
          c.vx *= -0.28;
          c.vx += left ? 0.35 : -0.35;
        } else if (!up || !down) {
          c.y += up ? probe * 0.9 : -probe * 0.9;
          c.vy *= -0.25;
          c.vy += up ? 0.15 : -0.04;
        } else {
          c.vy *= -0.2;
          c.y -= 1.5;
        }
        c.vy += 0.05;
        void ix;
        void iy;
        return;
      }
    }
  }

  private stepChute(c: PlinkoCoin, dt: number) {
    c.chuteT += dt;
    const t = c.chuteT / CHUTE_DURATION;
    const slotX = PLINKO_W / 2;

    if (t < 0.2) {
      const u = t / 0.2;
      c.x = slotX;
      c.y = this.lerp(6, 22, u);
    } else if (t < 0.45) {
      const u = (t - 0.2) / 0.25;
      c.x = this.lerp(slotX, c.chuteExitX, u);
      c.y = this.lerp(22, 28, u);
    } else if (t < 0.65) {
      const u = (t - 0.45) / 0.2;
      c.x = this.lerp(c.chuteExitX, slotX, u);
      c.y = this.lerp(28, 34, u);
    } else if (t < 1) {
      const u = (t - 0.65) / 0.35;
      c.x = this.lerp(slotX, c.chuteExitX, u * u);
      c.y = this.lerp(34, 48, u);
    } else {
      c.phase = 'free';
      c.vy = 0.18;
      c.vx = (c.chuteExitX - slotX) * 0.012 + (Math.random() - 0.5) * 0.25;
    }
  }

  private tryBonusHit(c: PlinkoCoin) {
    if (c.bonusHit || c.phase === 'chute') return;
    const b = bonusPlinkoBounds(this.time, PLINKO_W, PLINKO_H);
    if (c.y + c.r < b.y0 || c.y - c.r > b.y1) return;
    if (c.x >= b.x0 - c.r * 0.3 && c.x <= b.x1 + c.r * 0.3) {
      c.bonusHit = true;
      this.callbacks.onBonus();
    }
  }

  private stepCoin(c: PlinkoCoin, dt: number) {
    if (c.phase === 'chute') {
      this.stepChute(c, dt);
      return false;
    }

    c.vy += GRAVITY;
    c.vx *= FRICTION;
    c.vy *= FRICTION;
    c.x += c.vx;
    c.y += c.vy;

    const left = this.playLeft() + c.r;
    const right = this.playRight() - c.r;
    if (c.x < left) { c.x = left; c.vx = Math.abs(c.vx) * 0.3; }
    if (c.x > right) { c.x = right; c.vx = -Math.abs(c.vx) * 0.3; }

    this.resolveImageCollision(c);
    this.tryBonusHit(c);

    if (Math.abs(c.vx) < 0.05 && c.vy < 0.22) {
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

    if (this.jackpotActive) {
      this.jackpotTimer += dt;
      while (this.jackpotLeft > 0 && this.jackpotTimer >= this.jackpotInterval) {
        this.jackpotTimer -= this.jackpotInterval;
        this.jackpotLeft -= 1;
        this.dropCoin(PLINKO_W / 2 + (Math.random() - 0.5) * PLAY_WIDTH * 0.5);
      }
      if (this.jackpotLeft <= 0) this.jackpotActive = false;
    }

    for (let i = this.coins.length - 1; i >= 0; i--) {
      if (this.stepCoin(this.coins[i], dt)) {
        this.coins.splice(i, 1);
      }
    }
  }

  private draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, PLINKO_W, PLINKO_H);
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
