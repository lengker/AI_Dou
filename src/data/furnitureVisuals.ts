import type { RoomId } from '@/types';

export type FurnitureVisualKind = 'star-carpet' | 'stickers' | 'lamp' | 'prop' | 'props';

export interface FurnitureVisual {
  furnitureId: string;
  room: RoomId;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: FurnitureVisualKind;
  variant?: 'indoor' | 'forest';
  /** stickers / props：同主题图标的多处摆放 */
  scatter?: Array<{ left: string; top: string; size: string }>;
}

/** 场景叠加位置；图标主题统一取自 furniture.ts 的 icon 字段 */
export const FURNITURE_VISUALS: FurnitureVisual[] = [
  { furnitureId: 'F01', room: 'room_working', x: 15, y: 47.5, w: 7, h: 5, kind: 'prop' },
  { furnitureId: 'F02', room: 'room_living', x: 32, y: 43, w: 6, h: 7, kind: 'lamp', variant: 'indoor' },
  { furnitureId: 'F03', room: 'room_living', x: 47, y: 70, w: 14, h: 7, kind: 'star-carpet', variant: 'indoor' },
  {
    furnitureId: 'F04',
    room: 'room_working',
    x: 28,
    y: 22,
    w: 15,
    h: 18,
    kind: 'stickers',
    /** 对齐 background_working 软木板上 4 张白色便签中心 */
    scatter: [
      { left: '6%', top: '4%', size: '22%' },
      { left: '66%', top: '5%', size: '22%' },
      { left: '2%', top: '58%', size: '22%' },
      { left: '68%', top: '59%', size: '22%' },
    ],
  },
  {
    furnitureId: 'F05',
    room: 'room_working',
    x: 47,
    y: 22,
    w: 10,
    h: 24,
    kind: 'props',
    scatter: [
      { left: '18%', top: '16%', size: '40%' },
      { left: '48%', top: '40%', size: '36%' },
      { left: '26%', top: '66%', size: '34%' },
    ],
  },
  { furnitureId: 'F02', room: 'outdoor_forest', x: 31, y: 47, w: 8, h: 8, kind: 'lamp', variant: 'forest' },
  { furnitureId: 'F03', room: 'outdoor_forest', x: 44, y: 56, w: 12, h: 7, kind: 'star-carpet', variant: 'forest' },
  {
    furnitureId: 'F05',
    room: 'outdoor_forest',
    x: 45,
    y: 34,
    w: 12,
    h: 14,
    kind: 'props',
    scatter: [
      { left: '22%', top: '26%', size: '38%' },
      { left: '54%', top: '56%', size: '34%' },
    ],
  },
];
