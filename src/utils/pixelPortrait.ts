import { analyzeImage, type ColorAnalysis } from '@/utils/colorMapping';

export interface PixelPortraitOptions {
  gridSize?: number;
  colorLevels?: number;
}

export interface PixelPortraitResult {
  dataUrl: string;
  analysis: ColorAnalysis;
}

/** 与 default.png 画布及人物占位一致，保证房间内显示大小相同 */
const DEFAULT_SPRITE_FRAME = {
  size: 80,
  contentX: 20,
  contentY: 17,
  contentW: 43,
  contentH: 38,
};

const DEFAULTS = {
  gridSize: 16,
  colorLevels: 14,
  sampleSize: 320,
  pixelScale: 6,
  alphaCutoff: 40,
  cellOpaqueMin: 0.18,
  bgColorDist: 42,
};

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };
    img.src = url;
  });
}

function quantizeChannel(value: number, levels: number) {
  const step = 255 / Math.max(1, levels - 1);
  return Math.round(Math.round(value / step) * step);
}

interface ContentBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function colorDist(r: number, g: number, b: number, bg: number[]) {
  return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]);
}

/** 从四角/边缘采样背景色；透明图则返回 null */
function detectOpaqueBackground(data: Uint8ClampedArray, width: number, height: number): number[] | null {
  const samples: number[][] = [];
  const points: [number, number][] = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [0, Math.floor(height / 2)],
    [width - 1, Math.floor(height / 2)], [Math.floor(width / 2), height - 1],
  ];

  let transparentCorners = 0;
  for (const [x, y] of points) {
    const i = (y * width + x) * 4;
    if (data[i + 3] < DEFAULTS.alphaCutoff) {
      transparentCorners += 1;
      continue;
    }
    samples.push([data[i], data[i + 1], data[i + 2]]);
  }

  if (transparentCorners >= 4) return null;
  if (samples.length < 2) return null;

  const r = Math.round(samples.reduce((s, c) => s + c[0], 0) / samples.length);
  const g = Math.round(samples.reduce((s, c) => s + c[1], 0) / samples.length);
  const b = Math.round(samples.reduce((s, c) => s + c[2], 0) / samples.length);
  return [r, g, b];
}

function isBackgroundPixel(
  r: number,
  g: number,
  b: number,
  a: number,
  bg: number[] | null,
) {
  if (a < DEFAULTS.alphaCutoff) return true;
  if (bg && colorDist(r, g, b, bg) < DEFAULTS.bgColorDist) return true;
  if (r > 238 && g > 238 && b > 238) return true;
  return false;
}

function stripBackground(data: Uint8ClampedArray, width: number, height: number) {
  const bg = detectOpaqueBackground(data, width, height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (isBackgroundPixel(data[i], data[i + 1], data[i + 2], data[i + 3], bg)) {
        data[i + 3] = 0;
      }
    }
  }
}

function findOpaqueBounds(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  alphaMin: number,
): ContentBounds | null {
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      if (data[i + 3] < alphaMin) continue;
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { minX, minY, maxX, maxY };
}

function buildSubjectCanvas(img: HTMLImageElement, sampleSize: number): HTMLCanvasElement {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const srcCanvas = document.createElement('canvas');
  srcCanvas.width = w;
  srcCanvas.height = h;
  const srcCtx = srcCanvas.getContext('2d');
  if (!srcCtx) throw new Error('Canvas not supported');

  srcCtx.clearRect(0, 0, w, h);
  srcCtx.drawImage(img, 0, 0);
  const imageData = srcCtx.getImageData(0, 0, w, h);
  stripBackground(imageData.data, w, h);
  srcCtx.putImageData(imageData, 0, 0);

  const bounds = findOpaqueBounds(imageData.data, w, h, 1);
  let sx = 0;
  let sy = 0;
  let sw = w;
  let sh = h;

  if (bounds) {
    sx = bounds.minX;
    sy = bounds.minY;
    sw = bounds.maxX - bounds.minX + 1;
    sh = bounds.maxY - bounds.minY + 1;
    const side = Math.max(sw, sh);
    const pad = Math.max(1, Math.round(side * 0.03));
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    const half = side / 2 + pad;
    sx = Math.max(0, Math.floor(cx - half));
    sy = Math.max(0, Math.floor(cy - half));
    const ex = Math.min(w, Math.ceil(cx + half));
    const ey = Math.min(h, Math.ceil(cy + half));
    sw = ex - sx;
    sh = ey - sy;
  }

  const sampleCanvas = document.createElement('canvas');
  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) throw new Error('Canvas not supported');
  sampleCtx.clearRect(0, 0, sampleSize, sampleSize);
  sampleCtx.imageSmoothingEnabled = true;
  sampleCtx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sampleSize, sampleSize);

  const sampled = sampleCtx.getImageData(0, 0, sampleSize, sampleSize);
  stripBackground(sampled.data, sampleSize, sampleSize);
  sampleCtx.putImageData(sampled, 0, 0);
  return sampleCanvas;
}

function sampleGridCells(
  srcData: Uint8ClampedArray,
  sampleSize: number,
  gridSize: number,
  colorLevels: number,
  bg: number[] | null,
) {
  const out = new Uint8ClampedArray(gridSize * gridSize * 4);
  const cell = sampleSize / gridSize;
  const cellArea = Math.max(1, Math.floor(cell) * Math.floor(cell));

  for (let gy = 0; gy < gridSize; gy += 1) {
    for (let gx = 0; gx < gridSize; gx += 1) {
      const x0 = Math.floor(gx * cell);
      const y0 = Math.floor(gy * cell);
      const x1 = Math.min(sampleSize, Math.floor((gx + 1) * cell));
      const y1 = Math.min(sampleSize, Math.floor((gy + 1) * cell));

      let rSum = 0;
      let gSum = 0;
      let bSum = 0;
      let weight = 0;

      for (let y = y0; y < y1; y += 1) {
        for (let x = x0; x < x1; x += 1) {
          const i = (y * sampleSize + x) * 4;
          const a = srcData[i + 3];
          const r = srcData[i];
          const g = srcData[i + 1];
          const b = srcData[i + 2];
          if (isBackgroundPixel(r, g, b, a, bg)) continue;
          const aw = a / 255;
          rSum += r * aw;
          gSum += g * aw;
          bSum += b * aw;
          weight += aw;
        }
      }

      const oi = (gy * gridSize + gx) * 4;
      if (weight < cellArea * DEFAULTS.cellOpaqueMin) {
        out[oi + 3] = 0;
        continue;
      }

      let r = Math.round(rSum / weight);
      let g = Math.round(gSum / weight);
      let b = Math.round(bSum / weight);
      if (isBackgroundPixel(r, g, b, 255, bg)) {
        out[oi + 3] = 0;
        continue;
      }
      r = quantizeChannel(r, colorLevels);
      g = quantizeChannel(g, colorLevels);
      b = quantizeChannel(b, colorLevels);
      out[oi] = r;
      out[oi + 1] = g;
      out[oi + 2] = b;
      out[oi + 3] = 255;
    }
  }
  return out;
}

/** 仅导出人物占用的像素格，透明底、无固定白边 */
function exportTightGrid(
  gridPixels: Uint8ClampedArray,
  gridSize: number,
  pixelScale: number,
): HTMLCanvasElement {
  const bounds = findOpaqueBounds(gridPixels, gridSize, gridSize, 1);
  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = gridSize;
  gridCanvas.height = gridSize;
  const gridCtx = gridCanvas.getContext('2d');
  if (!gridCtx) throw new Error('Canvas not supported');
  gridCtx.putImageData(
    new ImageData(new Uint8ClampedArray(gridPixels), gridSize, gridSize),
    0,
    0,
  );

  if (!bounds) {
    const out = document.createElement('canvas');
    out.width = gridSize * pixelScale;
    out.height = gridSize * pixelScale;
    const ctx = out.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(gridCanvas, 0, 0, gridSize, gridSize, 0, 0, out.width, out.height);
    return out;
  }

  const tw = bounds.maxX - bounds.minX + 1;
  const th = bounds.maxY - bounds.minY + 1;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = tw * pixelScale;
  outCanvas.height = th * pixelScale;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas not supported');
  outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(
    gridCanvas,
    bounds.minX,
    bounds.minY,
    tw,
    th,
    0,
    0,
    outCanvas.width,
    outCanvas.height,
  );
  return outCanvas;
}

/** 把裁切后的人物缩放进与 default.png 相同的 80×80 画布 */
function normalizeToDefaultFrame(subject: HTMLCanvasElement): HTMLCanvasElement {
  const frame = DEFAULT_SPRITE_FRAME;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = frame.size;
  outCanvas.height = frame.size;
  const outCtx = outCanvas.getContext('2d');
  if (!outCtx) throw new Error('Canvas not supported');
  outCtx.clearRect(0, 0, frame.size, frame.size);
  outCtx.imageSmoothingEnabled = false;

  const scale = Math.min(
    frame.contentW / subject.width,
    frame.contentH / subject.height,
  );
  const dw = Math.max(1, Math.round(subject.width * scale));
  const dh = Math.max(1, Math.round(subject.height * scale));
  const dx = frame.contentX + Math.floor((frame.contentW - dw) / 2);
  const dy = frame.contentY + frame.contentH - dh;

  outCtx.drawImage(subject, 0, 0, subject.width, subject.height, dx, dy, dw, dh);
  return outCanvas;
}

export async function generatePixelPortrait(
  file: File,
  options: PixelPortraitOptions = {},
): Promise<PixelPortraitResult> {
  const gridSize = options.gridSize ?? DEFAULTS.gridSize;
  const colorLevels = options.colorLevels ?? DEFAULTS.colorLevels;

  const [img, analysis] = await Promise.all([loadImage(file), analyzeImage(file)]);

  const sampleCanvas = buildSubjectCanvas(img, DEFAULTS.sampleSize);
  const sampleCtx = sampleCanvas.getContext('2d');
  if (!sampleCtx) throw new Error('Canvas not supported');
  const srcData = sampleCtx.getImageData(0, 0, DEFAULTS.sampleSize, DEFAULTS.sampleSize).data;
  const bg = detectOpaqueBackground(srcData, DEFAULTS.sampleSize, DEFAULTS.sampleSize);

  const gridPixels = sampleGridCells(
    srcData,
    DEFAULTS.sampleSize,
    gridSize,
    colorLevels,
    bg,
  );
  const tightCanvas = exportTightGrid(gridPixels, gridSize, DEFAULTS.pixelScale);
  const outCanvas = normalizeToDefaultFrame(tightCanvas);

  return {
    dataUrl: outCanvas.toDataURL('image/png'),
    analysis,
  };
}
