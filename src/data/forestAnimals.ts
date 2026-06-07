export type ForestMiniGameType = 'tap' | 'hold' | 'pick' | 'timing' | 'sequence' | 'alternate';

export interface ForestAnimalDef {
  zoneId: string;
  id: string;
  hotspotName: string;
  name: string;
  image: string;
  method: ForestMiniGameType;
  intro: string;
  successText: string;
  rewardShards: number;
  target?: number;
  options?: string[];
  correctIndex?: number;
  sequence?: string[];
  timingTarget?: [number, number];
}

export const FOREST_ANIMALS: ForestAnimalDef[] = [
  {
    zoneId: 'F01',
    id: 'FA01',
    hotspotName: '溪边猫窝',
    name: '团子浮水猫',
    image: './DOU/images/zoo/thing_cats_13.png',
    method: 'tap',
    intro: '轻点水波，把猫窝周围的涟漪叠起来，别惊动它。',
    successText: '猫咪探出脑袋，在水边打了个滚，愿意让你记录它了。',
    rewardShards: 3,
    target: 5,
  },
  {
    zoneId: 'F02',
    id: 'FA02',
    hotspotName: '苔石草丛',
    name: '慢热刺猬球',
    image: './DOU/images/zoo/thing_hedgehog.png',
    method: 'hold',
    intro: '按住“屏息等待”，安静够久，草丛里的小刺球才会出来。',
    successText: '刺猬慢慢从草里探头，把自己团成一个安全的小球。',
    rewardShards: 3,
    target: 100,
  },
  {
    zoneId: 'F03',
    id: 'FA03',
    hotspotName: '池边气泡',
    name: '清泉伊势虾',
    image: './DOU/images/zoo/thing_iseebi_01.png',
    method: 'timing',
    intro: '等气泡漂进亮区时按下“收网”，动作太早太晚都会扑空。',
    successText: '一只发亮的伊势虾顺着水纹跃出水面，被你记录进图鉴。',
    rewardShards: 4,
    timingTarget: [42, 64],
  },
  {
    zoneId: 'F04',
    id: 'FA04',
    hotspotName: '歪木堆',
    name: '树桩顽猴',
    image: './DOU/images/zoo/thing_monkey_01.png',
    method: 'pick',
    intro: '木堆后有三处响动，选对真正晃动的树枝，猴子才会现身。',
    successText: '顽猴从倒木后翻出来，对你做了个夸张鬼脸。',
    rewardShards: 3,
    options: ['左侧树影', '中间树枝', '右侧蘑菇'],
    correctIndex: 1,
  },
  {
    zoneId: 'F05',
    id: 'FA05',
    hotspotName: '树冠亮点',
    name: '雪团信使',
    image: './DOU/images/zoo/thing_shimaenaga.png',
    method: 'sequence',
    intro: '记住树梢闪烁的三道花光顺序，按同样顺序点亮它。',
    successText: '一团软乎乎的小雪鸟落在枝头，像一封会呼吸的白色信件。',
    rewardShards: 4,
    sequence: ['蓝花', '白花', '黄花'],
  },
  {
    zoneId: 'F06',
    id: 'FA06',
    hotspotName: '紫花地块',
    name: '桥边巡逻犬',
    image: './DOU/images/zoo/thing_dachshund_01.png',
    method: 'alternate',
    intro: '跟着脚印左右交替拍手，别打乱节奏，小狗才会靠近。',
    successText: '短腿小狗踩着碎步跑出来，在花边转了一圈。',
    rewardShards: 3,
    target: 6,
  },
  {
    zoneId: 'F07',
    id: 'FA07',
    hotspotName: '木栅围栏',
    name: '围栏侦察猴',
    image: './DOU/images/zoo/thing_monkey_02.png',
    method: 'tap',
    intro: '快速拍三下围栏，让节奏从木桩里传过去，猴子会回应。',
    successText: '侦察猴从围栏后弹起来，确认这里已经安全。',
    rewardShards: 3,
    target: 3,
  },
  {
    zoneId: 'F08',
    id: 'FA08',
    hotspotName: '蓝花广场',
    name: '蓝花孔雀',
    image: './DOU/images/zoo/thing_peacock_01.png',
    method: 'sequence',
    intro: '按“蓝花 -> 黄花 -> 蓝花”轻触花丛，孔雀会在花间展开尾羽。',
    successText: '孔雀尾羽像扇形像素屏一样慢慢打开，停留了好一会儿。',
    rewardShards: 4,
    sequence: ['蓝花', '黄花', '蓝花'],
  },
  {
    zoneId: 'F09',
    id: 'FA09',
    hotspotName: '路牌岔口',
    name: '岔路追风犬',
    image: './DOU/images/zoo/thing_dachshund_02.png',
    method: 'pick',
    intro: '它总会从最短的那条小路冲出来，选对方向牌试试看。',
    successText: '追风犬从路牌后绕出来，叼着一枚亮闪闪的小叶片。',
    rewardShards: 4,
    options: ['花坡', '木桥', '树荫'],
    correctIndex: 2,
  },
  {
    zoneId: 'F10',
    id: 'FA10',
    hotspotName: '岸边微光',
    name: '樱光天马',
    image: './DOU/images/zoo/thing_pinkpegasus_01.png',
    method: 'timing',
    intro: '等樱粉流光穿过桥下亮区时按下“捕捉”，太急就会只拍到水花。',
    successText: '樱光天马从水雾里掠出，像把整片林海的晚霞都带了过来。',
    rewardShards: 5,
    timingTarget: [48, 68],
  },
];

export const FOREST_ANIMAL_BY_ZONE = Object.fromEntries(
  FOREST_ANIMALS.map((animal) => [animal.zoneId, animal]),
) as Record<string, ForestAnimalDef>;
