import type { HotZone } from '@/types';

export const HOT_ZONES: HotZone[] = [
  { id: 'W01', label: '左工位电脑', x: 8, y: 38, w: 22, h: 18, room: 'room_working' },
  { id: 'W02', label: '右工位电脑', x: 58, y: 38, w: 22, h: 18, room: 'room_working' },
  { id: 'W03', label: '左工位桌面', x: 10, y: 48, w: 18, h: 8, room: 'room_working' },
  { id: 'W04', label: '右工位桌面', x: 60, y: 48, w: 18, h: 8, room: 'room_working' },
  { id: 'W05', label: '角落书架', x: 42, y: 28, w: 16, h: 30, room: 'room_working' },
  { id: 'W06', label: '左墙公告板区', x: 6, y: 12, w: 14, h: 22, room: 'room_working' },
  { id: 'W07', label: '左下绿植', x: 2, y: 62, w: 10, h: 18, room: 'room_working', decorative: true, decorativeMessage: '它也在等您回来。' },
  { id: 'L01', label: '单人床', x: 6, y: 36, w: 28, h: 22, room: 'room_living', disabledInMidnight: true },
  { id: 'L02', label: '床头柜', x: 32, y: 42, w: 8, h: 10, room: 'room_living' },
  { id: 'L03', label: '中央地毯区', x: 38, y: 58, w: 24, h: 16, room: 'room_living' },
  { id: 'L04', label: '冰箱', x: 72, y: 34, w: 14, h: 28, room: 'room_living', disabledInMidnight: true },
  { id: 'L05', label: '街机', x: 54, y: 30, w: 16, h: 26, room: 'room_living' },
  { id: 'L06', label: '垃圾桶', x: 18, y: 58, w: 10, h: 14, room: 'room_living', disabledInMidnight: true },
  { id: 'L07', label: '右墙窗户', x: 78, y: 8, w: 16, h: 18, room: 'room_living', decorative: true, decorativeMessage: '外面是数据海，今天没有风。' },
  { id: 'L08', label: '左下绿植', x: 2, y: 62, w: 10, h: 18, room: 'room_living', decorative: true, decorativeMessage: '它也在等您回来。' },
];

export const ROOM_BACKGROUNDS = {
  room_working: '/DOU/images/bg/background_working.png',
  room_living: '/DOU/images/bg/background_living.png',
} as const;

export const PET_STAND_POINTS = {
  room_working: { x: 50, y: 72 },
  room_living: { x: 48, y: 68 },
} as const;
