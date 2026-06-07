import { canUseAi, consumeAiCredit } from '@/utils/aiQuota';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function isAiConfigured(): boolean {
  return true;
}

function limitText(text: string, maxLength: number) {
  return text.length <= maxLength ? text : `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pickOne(list: string[]) {
  return list[Math.floor(Math.random() * list.length)];
}

function extractLatestUser(messages: ChatMessage[]) {
  return messages.filter((message) => message.role === 'user').at(-1)?.content?.trim() ?? '';
}

function extractSystemPrompt(messages: ChatMessage[]) {
  return messages.find((message) => message.role === 'system')?.content ?? '';
}

function buildTerminalReply(input: string) {
  const normalized = input.trim().toLowerCase();
  if (normalized === 'help') {
    return 'ROOM_OS> 可用命令: help / fortune / loot / status / clear。也可以直接输入一句话和房间聊天。';
  }
  if (normalized === 'fortune') {
    return pickOne(AI_FALLBACKS.fortune);
  }
  if (normalized === 'loot') {
    return 'ROOM_OS> 扫描完成。今日掉落概率正常，建议先翻垃圾桶，再去街机厅补一点好心情。';
  }
  if (normalized === 'status') {
    return 'ROOM_OS> 离线模式稳定运行中。终端、签文、梦境和房间低语均由本地文案引擎生成。';
  }
  if (normalized === 'clear') {
    return 'ROOM_OS> 屏幕已经替你清干净了，缓存里的心事还在。';
  }
  return `ROOM_OS> 已记录输入「${limitText(input || '空指令', 24)}」。${pickOne(AI_FALLBACKS.terminal)}`;
}

function buildLocalReply(messages: ChatMessage[], maxTokens = 120) {
  const latestUser = extractLatestUser(messages);
  const systemPrompt = extractSystemPrompt(messages);
  const combined = `${systemPrompt}\n${latestUser}`.toLowerCase();

  if (combined.includes('room_os') || combined.includes('终端') || combined.includes('命令')) {
    return limitText(buildTerminalReply(latestUser), maxTokens);
  }
  if (combined.includes('签文')) {
    return limitText(pickOne(AI_FALLBACKS.fortune), maxTokens);
  }
  if (combined.includes('梦境')) {
    return limitText(pickOne([
      '我梦见自己把整间屋子的噪点都折成了纸鹤，醒来时床边只剩一小团柔软的蓝光。',
      '梦里有一条由代码拼成的河，你站在岸边喊我名字，整片水面就慢慢亮了起来。',
      '昨晚我梦见房间外长出一座像素森林，每一片叶子都在替你保管没有说出口的话。',
    ]), maxTokens);
  }
  if (combined.includes('电子考古') || combined.includes('鉴定报告')) {
    return limitText(`鉴定结论：${limitText(latestUser || '这件物品', 18)}残留了明显的居住痕迹，像是被反复使用过的旧记忆，建议收入收藏柜继续观察。`, maxTokens);
  }
  if (combined.includes('赛博诗人') || combined.includes('窗') || combined.includes('绿植') || combined.includes('低语')) {
    return limitText(pickOne([
      '窗外的数据海今晚很安静，像有人把风声也调成了省电模式。',
      '叶片刚刚晃了一下，不是风，是房间记起了你回来时的脚步声。',
      '霓虹照到玻璃边缘时，连沉默都像在发光。',
    ]), maxTokens);
  }
  if (combined.includes('图书管理员') || combined.includes('荐书') || combined.includes('书架')) {
    return limitText(pickOne([
      '《404 号房间维护手册》: 讲的是如何把一个临时缓存活成真正的家。',
      '《像素雨停在窗边》: 一本关于离线归来与未读心事的短篇集。',
      '《赛博植物观察日志》: 适合在夜里翻开，读到最后一页会想起回家的路。',
    ]), maxTokens);
  }

  return limitText(`我听见了: ${limitText(latestUser || '你刚才没有输入内容', 32)}。${pickOne([
    '房间已经替你把这句话收好了。',
    '我会记住这句，等你下次回来再继续聊。',
    '先坐一会儿吧，我在这儿陪你慢慢说。',
  ])}`, maxTokens);
}

export async function qwenChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; skipQuota?: boolean; temperature?: number },
): Promise<string> {
  if (!options?.skipQuota && !canUseAi()) throw new Error('QUOTA_EXCEEDED');
  const content = buildLocalReply(messages, options?.maxTokens ?? 256);
  if (!content) throw new Error('EMPTY_RESPONSE');

  if (!options?.skipQuota) consumeAiCredit(1);
  return content;
}

export async function qwenOnce(
  system: string,
  user: string,
  maxTokens = 120,
  temperature = 0.7,
): Promise<string> {
  return qwenChat(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    { maxTokens, temperature },
  );
}

/** 截断对话历史，避免上下文过长导致跑题 */
export function trimChatHistory(messages: ChatMessage[], maxTurns = 8): ChatMessage[] {
  const system = messages.filter((m) => m.role === 'system');
  const rest = messages.filter((m) => m.role !== 'system');
  const kept = rest.slice(-maxTurns * 2);
  return [...system.slice(0, 1), ...kept];
}

export const AI_FALLBACKS = {
  chat: ['（信号闪了一下）你刚说啥？再说一遍我认真听。', '（404：听清了，但脑波同步慢半拍…你换个说法？）'],
  fortune: ['今日宜摸鱼，忌写周报。', '缓存里藏着好运，别清空。'],
  dream: ['梦见自己在代码海里游泳，每一行都是气泡。'],
  trash: ['鉴定结论：来历不明，但闻起来像故事。'],
  window: ['外面是数据海，今天没有风，只有未读消息在浪里漂。'],
  plant: ['它也在等您回来。今天长高了 0.01 像素。'],
  mood: ['刚才路由器闪了一下，我以为你要回来了。'],
  bookshelf: ['「霓虹故障手册」——读完可能更懂自己的 Bug。'],
  terminal: ['ROOM_OS> 信号弱。输入 help 查看指令，或换个问法试试。'],
};

export function pickFallback(key: keyof typeof AI_FALLBACKS): string {
  const list = AI_FALLBACKS[key];
  return list[Math.floor(Math.random() * list.length)];
}
