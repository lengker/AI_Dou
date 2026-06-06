/** 像素风 Canvas 工具 */
export function setupPixelCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
): CanvasRenderingContext2D {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color = '#fff',
  size = 10,
) {
  ctx.fillStyle = color;
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(text, x, y);
}

export function drawCoinSprite(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.fillStyle = '#b8860b';
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd700';
  ctx.beginPath();
  ctx.arc(x - 1, y - 1, r - 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff8dc';
  ctx.fillRect(x - 2, y - 3, 4, 2);
  ctx.fillStyle = '#8b6914';
  ctx.font = '8px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('$', x, y + 3);
}
