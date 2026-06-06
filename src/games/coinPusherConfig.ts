/** 上下层共用尺寸，保证 2D 落点与 3D 平台 X 轴一一对应 */
export const MACHINE_W = 360;
export const PLINKO_H = 210;
export const PLAY_MARGIN = 6;
export const PLAY_WIDTH = MACHINE_W - PLAY_MARGIN * 2;

/** 3D 平台世界宽度，与 PLAY_WIDTH 视觉对齐 */
export const PLATFORM_W = 7.4;
export const PLATFORM_D = 4.0;

export function playXToNorm(x: number): number {
  return (x - PLAY_MARGIN) / PLAY_WIDTH;
}

export function normToPlatformX(norm: number): number {
  const n = Math.max(0, Math.min(1, norm));
  return -PLATFORM_W / 2 + n * PLATFORM_W;
}
