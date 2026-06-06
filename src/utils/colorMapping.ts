import type { AvatarAppearance, SkinTone, HairColor } from '@/types';

export interface ColorAnalysis {
  dominantColor: string;
  brightness: number;
  uniqueHueCount: number;
  dominantHueRatio: number;
  isAbnormal: boolean;
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      default: h = ((r - g) / d + 4) / 6;
    }
  }
  return { h: h * 360, s, l };
}

export async function analyzeImage(file: File): Promise<ColorAnalysis> {
  const img = await loadImage(file);
  const canvas = document.createElement('canvas');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');
  ctx.drawImage(img, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const hueBuckets = new Map<number, number>();
  let totalBrightness = 0;
  let validPixels = 0;
  let dominantR = 128, dominantG = 128, dominantB = 128;
  let maxBucket = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h, l } = rgbToHsl(r, g, b);
    if (l < 0.05 || l > 0.95) continue;
    validPixels++;
    totalBrightness += l;
    const bucket = Math.floor(h / 30);
    const count = (hueBuckets.get(bucket) ?? 0) + 1;
    hueBuckets.set(bucket, count);
    if (count > maxBucket) {
      maxBucket = count;
      dominantR = r; dominantG = g; dominantB = b;
    }
  }

  const brightness = validPixels > 0 ? totalBrightness / validPixels : 0.5;
  const dominantHueRatio = validPixels > 0 ? maxBucket / validPixels : 0;
  const dominantColor = `#${[dominantR, dominantG, dominantB].map((v) => v.toString(16).padStart(2, '0')).join('')}`;

  return {
    dominantColor,
    brightness,
    uniqueHueCount: hueBuckets.size,
    dominantHueRatio,
    isAbnormal: dominantHueRatio >= 0.95 || hueBuckets.size > 12,
  };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

export function mapAppearance(analysis: ColorAnalysis): AvatarAppearance {
  if (analysis.isAbnormal) {
    return { clothingColor: '#888888', skinTone: 'standard', hairColor: 'dark', isDefault: true };
  }
  const skinTone: SkinTone = analysis.brightness >= 0.6 ? 'light' : analysis.brightness >= 0.3 ? 'standard' : 'dark';
  const hairColor: HairColor = analysis.brightness >= 0.5 ? 'dark' : 'light';
  return { clothingColor: analysis.dominantColor, skinTone, hairColor, isDefault: false };
}

export function getSkinFilter(tone: SkinTone): string {
  switch (tone) {
    case 'light': return 'brightness(1.15) saturate(0.9)';
    case 'dark': return 'brightness(0.75) saturate(0.85)';
    default: return 'none';
  }
}

export function getHairFilter(color: HairColor): string {
  return color === 'light' ? 'brightness(1.4) sepia(0.3)' : 'brightness(0.6)';
}
