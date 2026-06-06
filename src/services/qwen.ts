import { canUseAi, consumeAiCredit } from '@/utils/aiQuota';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const API_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';

function getApiKey(): string | undefined {
  const key = import.meta.env.VITE_QWEN_API_KEY?.trim();
  return key && key !== 'sk-your-key-here' ? key : undefined;
}

export function isAiConfigured(): boolean {
  return !!getApiKey();
}

export async function qwenChat(
  messages: ChatMessage[],
  options?: { maxTokens?: number; skipQuota?: boolean; temperature?: number },
): Promise<string> {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_API_KEY');
  if (!options?.skipQuota && !canUseAi()) throw new Error('QUOTA_EXCEEDED');

  const model = import.meta.env.VITE_QWEN_MODEL || 'qwen-turbo';

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: options?.maxTokens ?? 256,
      temperature: options?.temperature ?? 0.65,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API_ERROR:${res.status}:${errText.slice(0, 100)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content?.trim();
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
