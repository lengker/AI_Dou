import type { RoomId } from '@/types';

export type TutorialTarget =
  | 'none' | 'pet' | 'shards' | 'settings' | 'collection' | 'tabs'
  | 'tab-working' | 'tab-living' | 'hotzone';

export interface TutorialStep {
  id: string;
  title: string;
  body: string;
  tip?: string;
  target: TutorialTarget;
  hotZoneId?: string;
  room?: RoomId;
  switchToRoom?: RoomId;
}

export const TUTORIAL_STEPS: TutorialStep[] = [
  { id: 'welcome', title: '欢迎来到 404 号房间', body: '这里是你的数字分身常住的小房间。你可以观察 TA 的日常、点击场景里的物品互动、收集赛博藏品，慢慢把空房间装点成自己的风格。', tip: '这是一份探索指引，帮你快速弄清「能点哪里、点了会怎样」。', target: 'none', room: 'room_working' },
  { id: 'pet', title: '你的数字分身', body: '地板上的像素小人就是你的分身。TA 会自己待机、敲键盘、睡觉或在房间里溜达。点击 TA 可以触发隐藏互动。', tip: '离开越久再回来，TA 说的话和状态可能不一样。', target: 'pet', room: 'room_working' },
  { id: 'shards', title: '数据碎片', body: '右上角金色硬币是「数据碎片」——房间里的通用货币。离线回归、翻找垃圾桶、未来小游戏等途径都能获得。', tip: '碎片用来解锁家具装饰，或在设置里消耗 30 个重构分身形象。', target: 'shards', room: 'room_working' },
  { id: 'tabs', title: '两个场景区域', body: '房间分成「办公区」和「生活区」。底部 Tab 可切换背景，交互物品分布在不同区域，需要两边都逛逛。', tip: '切换房间不会丢失小人状态或已有进度。', target: 'tabs', room: 'room_working' },
  { id: 'computer', title: '办公区 · 电脑', body: '点击工位上的电脑区域，会弹出电脑浮层，小人进入敲键盘状态。屏幕会掉落 0 和 1，还有 3% 概率获得藏品「神秘磁盘」。', tip: '午夜模式（23:00–06:00）电脑仍可点击，但画面会变暗。', target: 'hotzone', hotZoneId: 'W01', room: 'room_working', switchToRoom: 'room_working' },
  { id: 'desk', title: '办公区 · 桌面', body: '左工位桌面是可探索区域。首次点击会弹出解锁面板——攒够碎片可买「桌子咖啡杯」；解锁后再点可查看特写浮层。', tip: '家具解锁后不会一直贴在主画面上，只在点击后的浮层里出现。', target: 'hotzone', hotZoneId: 'W03', room: 'room_working' },
  { id: 'bookshelf', title: '办公区 · 书架与墙面', body: '书架（中央）和左侧公告板区也能点击。可分别解锁「书架杂物摆件」和「墙面霓虹贴纸」。', target: 'hotzone', hotZoneId: 'W05', room: 'room_working' },
  { id: 'go-living', title: '去生活区看看', body: '生活区有床、冰箱、街机、垃圾桶等核心互动。点击底部「生活区」Tab 切换场景，我们继续探索。', target: 'tab-living', room: 'room_working', switchToRoom: 'room_living' },
  { id: 'bed', title: '生活区 · 床', body: '点击床铺可让小人睡觉 5 分钟，并清除身上的临时状态。', tip: '长期离线回归时，小人可能会坐在床边等你。', target: 'hotzone', hotZoneId: 'L01', room: 'room_living', switchToRoom: 'room_living' },
  { id: 'fridge', title: '生活区 · 冰箱', body: '点击冰箱随机获得：赛博可乐（加速）、过期可乐（卡 Bug 闪烁）或空冰箱台词。周末概率会变化。', target: 'hotzone', hotZoneId: 'L04', room: 'room_living' },
  { id: 'trash', title: '生活区 · 垃圾桶', body: '翻垃圾桶是获得赛博藏品的主要途径！每天最多 3 次，随机掉落 A 类藏品。', tip: '集齐 15 件藏品可解锁终极藏品「像素之魂」。', target: 'hotzone', hotZoneId: 'L06', room: 'room_living' },
  { id: 'arcade', title: '生活区 · 街机', body: '赛博推币机分上下两层：上方 2D 钉板落币，中央 Bonus 触发 3×3 抽奖爆币；下方 3D 推板落碟得分。还有抓娃娃机。', target: 'hotzone', hotZoneId: 'L05', room: 'room_living' },
  { id: 'carpet', title: '生活区 · 地毯与床头', body: '中央地毯区可解锁「地毯像素图案」，床头柜可解锁「床头小夜灯」。', target: 'hotzone', hotZoneId: 'L03', room: 'room_living' },
  { id: 'collection', title: '收藏柜', body: '右下角文件夹图标打开收藏柜，查看已获得的 15 件赛博藏品。点击藏品可看描述文案。', target: 'collection', room: 'room_living' },
  { id: 'settings', title: '设置与成就', body: '左下角齿轮打开设置：查看成就列表、消耗 30 碎片「特征重构」重新映射分身，或随时重看本指引。', target: 'settings', room: 'room_living' },
  { id: 'done', title: '开始自由探索', body: '基础指引就到这里。场景中许多区域其实都能点——绿植、窗户会弹出小气泡；多离开再回来，会触发随机事件和离线彩蛋。', tip: '随时点左上角 ? 打开「探索手册」查阅全部功能。', target: 'none', room: 'room_living' },
];

export const GUIDE_SECTIONS = [
  { title: '核心循环', items: [
    { name: '数据碎片', desc: '通用货币。来源：离线回归、翻垃圾桶、小游戏（待上线）。用途：解锁家具、特征重构。' },
    { name: '赛博藏品', desc: '共 15 件收集物，仅在收藏柜展示。垃圾桶翻找、离线、彩蛋等途径获得。' },
    { name: '离线成长', desc: '关闭或切后台后再打开，按离开时长结算碎片与台词，可能掉落藏品或解锁小猫。' },
  ]},
  { title: '办公区可探索', items: [
    { name: '电脑（左右工位）', desc: '敲键盘 + 屏幕掉字符，3% 得神秘磁盘 C013' },
    { name: '左工位桌面', desc: '解锁/查看 F01 咖啡杯（15 碎片）' },
    { name: '书架', desc: '解锁/查看 F05 杂物摆件（35 碎片）' },
    { name: '公告板墙面', desc: '解锁/查看 F04 霓虹贴纸（30 碎片）' },
    { name: '绿植', desc: '装饰气泡，无资源收益' },
  ]},
  { title: '生活区可探索', items: [
    { name: '床', desc: '强制睡觉 5 分钟，清除临时 Buff' },
    { name: '冰箱', desc: '随机可乐 / 过期 / 空冰箱，周末概率不同' },
    { name: '垃圾桶', desc: '每日 3 次，主要藏品来源' },
    { name: '街机', desc: '推币机 + 抓娃娃机，赢数据碎片' },
    { name: '地毯 / 床头柜', desc: '解锁 F03 地毯（25）、F02 夜灯（20）' },
    { name: '窗户 / 绿植', desc: '装饰气泡' },
  ]},
  { title: '小人状态', items: [
    { name: '待机 / 敲键盘 / 睡觉 / 乱爬', desc: '每 45 秒自动切换（特殊状态除外）' },
    { name: '卡 Bug 闪烁', desc: '翻垃圾桶失手或过期可乐时触发，3 秒恢复' },
    { name: '思念状态', desc: '长期离线后坐床边，连点小人 3 次解除' },
    { name: '午夜模式', desc: '23:00–06:00 小人睡觉，部分交互禁用' },
  ]},
  { title: '隐藏彩蛋', items: [
    { name: '连点小人 20 次', desc: '每日 1 次，获得 C014 与成就' },
    { name: '签章输入 Wang Yu', desc: '映射时触发首席架构师称号' },
    { name: '异常图片', desc: '单色/杂乱图触发异常映射，得 C011' },
    { name: '偷偷养的小猫', desc: '短期离线 15% 概率解锁，常驻脚边' },
  ]},
  { title: '⚡ AI 神经功能（千问）', items: [
    { name: '神经链接 ⚡', desc: '左上角闪电按钮，与分身自由对话，记得你的人设' },
    { name: '404 终端', desc: '点击电脑打开 ROOM_OS，输入 help/fortune/loot/自由对话' },
    { name: '冰箱赛博签', desc: '开冰箱后 AI 生成今日签文' },
    { name: '梦境注入', desc: '睡觉触发 AI 梦境叙事' },
    { name: '电子考古', desc: '垃圾桶出藏品时生成鉴定报告' },
    { name: '窗外/绿植低语', desc: '点击窗户或绿植，AI 生成诗意台词' },
    { name: '书架荐书', desc: '解锁书架后点击，AI 推荐赛博书籍' },
    { name: '每日 AI 40 次', desc: '右上角数字为今日剩余 AI 调用次数' },
  ]},
];
