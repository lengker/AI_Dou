/** tuibi.png (138×182) 像素切片与碰撞采样 */

export const TUIBI_W = 138;
export const TUIBI_H = 182;

/** Plinko 层在机台图上的区域（与 index.css 百分比一致） */
export const PLINKO_IMG = { left: 15, top: 20, width: 108, height: 60 };

/** 从原图裁切的移动部件（像素坐标） */
export const BONUS_SPRITE = { x: 28, y: 73, w: 64, h: 5 };
export const PUSHER_SPRITE = { x: 12, y: 109, w: 114, h: 6 };

/** 原图上需遮盖的静止区域（略大于精灵，避免露边） */
export const BONUS_COVER = { x: 26, y: 72, w: 68, h: 7 };
export const PUSHER_COVER = { x: 10, y: 108, w: 118, h: 14 };

const TUIBI_URL = '/tuibi.png';

let loadPromise: Promise<void> | null = null;
let sourceCanvas: HTMLCanvasElement | null = null;
let bonusCanvas: HTMLCanvasElement | null = null;
let pusherCanvas: HTMLCanvasElement | null = null;
let coverBonusCanvas: HTMLCanvasElement | null = null;
let coverPusherCanvas: HTMLCanvasElement | null = null;

export function plinkoToImage(px: number, py: number, plinkoW: number, plinkoH: number) {
  return {
    ix: PLINKO_IMG.left + (px / plinkoW) * PLINKO_IMG.width,
    iy: PLINKO_IMG.top + (py / plinkoH) * PLINKO_IMG.height,
  };
}

function isObstaclePixel(r: number, g: number, b: number, a: number): boolean {
  if (a < 160) return false;
  if (g > 112 && b > 112 && r < 58) return false;
  if (r < 22 && g < 22 && b < 30) return false;
  if (r > 195 && g > 115 && g < 145 && b < 55) return false;
  return true;
}

function cutSprite(
  src: CanvasRenderingContext2D,
  region: { x: number; y: number; w: number; h: number },
): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = region.w;
  c.height = region.h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    src.canvas,
    region.x, region.y, region.w, region.h,
    0, 0, region.w, region.h,
  );
  return c;
}

function isPusherPixel(r: number, g: number, b: number): boolean {
  return r > 52 && r < 98 && g > 52 && g < 98 && b > 52 && b < 102 && Math.abs(r - g) < 12;
}

function makeErasedCover(
  src: CanvasRenderingContext2D,
  cover: { x: number; y: number; w: number; h: number },
  erase: { x: number; y: number; w: number; h: number },
  replacer: (x: number, y: number, data: Uint8ClampedArray, i: number) => void,
): HTMLCanvasElement {
  const c = cutSprite(src, cover);
  const ctx = c.getContext('2d')!;
  const img = ctx.getImageData(0, 0, cover.w, cover.h);
  const d = img.data;
  for (let py = 0; py < cover.h; py++) {
    for (let px = 0; px < cover.w; px++) {
      const gx = cover.x + px;
      const gy = cover.y + py;
      if (gx < erase.x || gx >= erase.x + erase.w || gy < erase.y || gy >= erase.y + erase.h) continue;
      const i = (py * cover.w + px) * 4;
      replacer(gx, gy, d, i);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function samplePixel(src: CanvasRenderingContext2D, x: number, y: number) {
  const clampedX = Math.max(0, Math.min(TUIBI_W - 1, x));
  const clampedY = Math.max(0, Math.min(TUIBI_H - 1, y));
  return src.getImageData(clampedX, clampedY, 1, 1).data;
}

export function loadTuibiArt(): Promise<void> {
  if (sourceCanvas) return Promise.resolve();
  if (loadPromise) return loadPromise;

  loadPromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = TUIBI_W;
      c.height = TUIBI_H;
      const ctx = c.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(img, 0, 0);
      sourceCanvas = c;

      bonusCanvas = cutSprite(ctx, BONUS_SPRITE);
      pusherCanvas = cutSprite(ctx, PUSHER_SPRITE);
      coverBonusCanvas = makeErasedCover(ctx, BONUS_COVER, BONUS_SPRITE, (_gx, _gy, d, i) => {
        const [r, g, b] = samplePixel(ctx, PLINKO_IMG.left + 4, BONUS_SPRITE.y - 2);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = 255;
      });
      coverPusherCanvas = makeErasedCover(
        ctx,
        PUSHER_COVER,
        { x: PUSHER_SPRITE.x, y: PUSHER_COVER.y, w: PUSHER_SPRITE.w, h: PUSHER_COVER.h },
        (gx, gy, d, i) => {
          const [r, g, b, a] = samplePixel(ctx, gx, gy);
          if (!isPusherPixel(r, g, b)) return;
          const [pr, pg, pb] = samplePixel(ctx, gx, PUSHER_COVER.y - 1);
          d[i] = pr;
          d[i + 1] = pg;
          d[i + 2] = pb;
          d[i + 3] = a;
        },
      );
      resolve();
    };
    img.onerror = () => reject(new Error('tuibi.png load failed'));
    img.src = TUIBI_URL;
  });
  return loadPromise;
}

export function buildPlinkoCollisionGrid(plinkoW: number, plinkoH: number): Uint8Array {
  if (!sourceCanvas) return new Uint8Array(plinkoW * plinkoH);
  const ctx = sourceCanvas.getContext('2d')!;
  const grid = new Uint8Array(plinkoW * plinkoH);

  for (let py = 0; py < plinkoH; py++) {
    for (let px = 0; px < plinkoW; px++) {
      const { ix, iy } = plinkoToImage(px, py, plinkoW, plinkoH);
      const x0 = Math.floor(ix);
      const y0 = Math.floor(iy);
      let solid = 0;
      for (let sy = 0; sy <= 1; sy++) {
        for (let sx = 0; sx <= 1; sx++) {
          const x = Math.min(TUIBI_W - 1, x0 + sx);
          const y = Math.min(TUIBI_H - 1, y0 + sy);
          const [r, g, b, a] = ctx.getImageData(x, y, 1, 1).data;
          if (isObstaclePixel(r, g, b, a)) {
            if (
              x >= BONUS_COVER.x && x < BONUS_COVER.x + BONUS_COVER.w &&
              y >= BONUS_COVER.y && y < BONUS_COVER.y + BONUS_COVER.h
            ) {
              continue;
            }
            solid = 1;
          }
        }
      }
      grid[py * plinkoW + px] = solid;
    }
  }
  return grid;
}

/** BONUS 在机台图像素坐标下的中心 X */
export function bonusImageCenterX(time: number): number {
  const travel = (TUIBI_W - BONUS_SPRITE.w) / 2 - 18;
  return TUIBI_W / 2 + Math.sin(time * 1.5) * travel;
}

/** 推板在机台图像素坐标下的 Y（norm 0=收回, 1=伸出） */
export function pusherImageY(norm: number): number {
  const n = Math.max(0, Math.min(1, norm));
  return PUSHER_SPRITE.y + n * 5;
}

export function bonusPlinkoBounds(time: number, plinkoW: number, plinkoH: number) {
  const cx = bonusImageCenterX(time);
  const x0 = cx - BONUS_SPRITE.w / 2;
  const y0 = BONUS_SPRITE.y;
  const scaleX = plinkoW / PLINKO_IMG.width;
  const scaleY = plinkoH / PLINKO_IMG.height;
  return {
    x0: (x0 - PLINKO_IMG.left) * scaleX,
    x1: (x0 + BONUS_SPRITE.w - PLINKO_IMG.left) * scaleX,
    y0: (y0 - PLINKO_IMG.top) * scaleY,
    y1: (y0 + BONUS_SPRITE.h - PLINKO_IMG.top) * scaleY,
  };
}

export class TuibiArtLayer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private disposed = false;
  private animId = 0;
  private pusherNorm = 0;
  private time = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = setupCabinetCanvas(canvas);
  }

  setPusherNorm(n: number) {
    this.pusherNorm = n;
  }

  start() {
    let last = performance.now();
    const tick = (now: number) => {
      if (this.disposed) return;
      this.animId = requestAnimationFrame(tick);
      const dt = Math.min((now - last) / 1000, 0.033);
      last = now;
      this.time += dt;
      this.draw();
    };
    this.animId = requestAnimationFrame(tick);
  }

  private draw() {
    if (!bonusCanvas || !pusherCanvas || !coverBonusCanvas || !coverPusherCanvas) return;
    const ctx = this.ctx;
    const w = TUIBI_W;
    const h = TUIBI_H;
    ctx.clearRect(0, 0, w, h);

    ctx.drawImage(coverBonusCanvas, BONUS_COVER.x, BONUS_COVER.y);
    ctx.drawImage(coverPusherCanvas, PUSHER_COVER.x, PUSHER_COVER.y);

    const bonusX = bonusImageCenterX(this.time) - BONUS_SPRITE.w / 2;
    ctx.drawImage(bonusCanvas, bonusX, BONUS_SPRITE.y);

    const pushY = pusherImageY(this.pusherNorm);
    ctx.drawImage(pusherCanvas, PUSHER_SPRITE.x, pushY);
  }

  step(dt: number) {
    this.time += dt;
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.animId);
  }
}

function setupCabinetCanvas(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = TUIBI_W * dpr;
  canvas.height = TUIBI_H * dpr;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}
