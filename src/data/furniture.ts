import type { FurnitureDef } from '@/types';

export const FURNITURE: FurnitureDef[] = [
  { id: 'F01', name: '桌子咖啡杯', cost: 15, room: 'room_working', hotZoneId: 'W03', icon: '/DOU/images/element/cola.png', overlayTitle: '桌面特写' },
  { id: 'F02', name: '床头小夜灯', cost: 20, room: 'room_living', hotZoneId: 'L02', icon: '/DOU/images/ui/happy.png', overlayTitle: '床头柜特写' },
  { id: 'F03', name: '地毯像素图案', cost: 25, room: 'room_living', hotZoneId: 'L03', icon: '/DOU/images/collectible/star.png', overlayTitle: '地毯特写' },
  { id: 'F04', name: '墙面霓虹贴纸', cost: 30, room: 'room_working', hotZoneId: 'W06', icon: '/DOU/images/collectible/heart.png', overlayTitle: '墙面特写' },
  { id: 'F05', name: '书架杂物摆件', cost: 35, room: 'room_working', hotZoneId: 'W05', icon: '/DOU/images/collectible/cloud.png', overlayTitle: '书架特写' },
];

const FURNITURE_HOTZONE_TO_ID: Record<string, string> = {
  W03: 'F01',
  L02: 'F02',
  L03: 'F03',
  W06: 'F04',
  W05: 'F05',
  F07: 'F02',
  F06: 'F03',
  F08: 'F05',
};

export const getFurniture = (id: string) => FURNITURE.find((f) => f.id === id);
export const getFurnitureByHotZoneId = (hotZoneId: string) => {
  const furnitureId = FURNITURE_HOTZONE_TO_ID[hotZoneId];
  return furnitureId ? getFurniture(furnitureId) : undefined;
};
