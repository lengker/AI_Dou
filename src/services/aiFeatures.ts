import type { AvatarProfile } from '@/types';
import {
  petPersona,
  promptDream,
  promptFridgeFortune,
  promptTrashReport,
  promptWindowWhisper,
  promptPlantWhisper,
  promptRandomMood,
  promptBookshelf,
  promptFortune,
  SYSTEM_ROOM_OS,
  terminalUserMessage,
} from '@/services/aiPrompts';
import { qwenOnce, qwenChat, pickFallback, isAiConfigured } from '@/services/qwen';

export async function fetchPetReply(profile: AvatarProfile | null, userMsg: string): Promise<string> {
  if (!isAiConfigured()) return pickFallback('chat');
  return qwenChat(
    [
      { role: 'system', content: petPersona(profile) },
      { role: 'user', content: userMsg },
    ],
    { maxTokens: 180, temperature: 0.6 },
  );
}

export async function fetchFridgeFortune(profile: AvatarProfile | null, result: string): Promise<string> {
  if (!isAiConfigured()) return pickFallback('fortune');
  try {
    return await qwenOnce(
      '你是赛博签文机。只输出签文一句，不要解释。',
      promptFridgeFortune(profile, result),
      80,
      0.75,
    );
  } catch {
    return pickFallback('fortune');
  }
}

export async function fetchDream(profile: AvatarProfile | null): Promise<string> {
  if (!isAiConfigured()) return pickFallback('dream');
  try {
    return await qwenOnce('你是梦境记录器。只输出梦境正文。', promptDream(profile), 100, 0.8);
  } catch {
    return pickFallback('dream');
  }
}

export async function fetchTrashReport(name: string, desc: string): Promise<string> {
  if (!isAiConfigured()) return pickFallback('trash');
  try {
    return await qwenOnce('你是电子考古学家。只输出鉴定报告。', promptTrashReport(name, desc), 100, 0.7);
  } catch {
    return pickFallback('trash');
  }
}

export async function fetchWindowWhisper(): Promise<string> {
  if (!isAiConfigured()) return pickFallback('window');
  try {
    return await qwenOnce('你是赛博诗人。', promptWindowWhisper(), 80, 0.75);
  } catch {
    return pickFallback('window');
  }
}

export async function fetchPlantWhisper(): Promise<string> {
  if (!isAiConfigured()) return pickFallback('plant');
  try {
    return await qwenOnce('你是房间绿植。', promptPlantWhisper(), 60, 0.75);
  } catch {
    return pickFallback('plant');
  }
}

export async function fetchRandomMood(profile: AvatarProfile | null): Promise<string> {
  if (!isAiConfigured()) return pickFallback('mood');
  try {
    return await qwenOnce(petPersona(profile), promptRandomMood(profile), 80, 0.75);
  } catch {
    return pickFallback('mood');
  }
}

export async function fetchBookshelfLine(): Promise<string> {
  if (!isAiConfigured()) return pickFallback('bookshelf');
  try {
    return await qwenOnce('你是赛博图书管理员。', promptBookshelf(), 80, 0.75);
  } catch {
    return pickFallback('bookshelf');
  }
}

export async function fetchTerminalReply(input: string): Promise<string> {
  if (!isAiConfigured()) return pickFallback('terminal');
  return qwenOnce(SYSTEM_ROOM_OS, terminalUserMessage(input), 140, 0.55);
}

export async function fetchTerminalFortune(): Promise<string> {
  if (!isAiConfigured()) return pickFallback('fortune');
  return qwenOnce(SYSTEM_ROOM_OS, promptFortune(), 80, 0.75);
}
