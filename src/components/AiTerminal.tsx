import { useState, useRef, useEffect } from 'react';
import type { AvatarProfile } from '@/types';
import { promptBookshelf } from '@/services/aiPrompts';
import { qwenOnce, pickFallback, isAiConfigured } from '@/services/qwen';
import { fetchTerminalReply, fetchTerminalFortune } from '@/services/aiFeatures';
import { getAiRemaining } from '@/utils/aiQuota';

interface TerminalLine {
  type: 'in' | 'out' | 'sys' | 'err';
  text: string;
}

interface AiTerminalProps {
  profile: AvatarProfile | null;
  shards: number;
  collectiblesCount: number;
  nightDebug: boolean;
  onLoot?: (amount: number) => void;
}

export function AiTerminal({ profile, shards, collectiblesCount, nightDebug, onLoot }: AiTerminalProps) {
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'sys', text: 'ROOM_OS v4.0.4 — 神经终端已挂载' },
    { type: 'out', text: nightDebug ? '>> 低光调试已启用，终端切换到简化界面' : '>> 输入 help 查看指令，或直接对话' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [lines]);

  const append = (...items: TerminalLine[]) => setLines((l) => [...l, ...items]);

  const runCommand = async (raw: string) => {
    const cmd = raw.trim().toLowerCase();
    append({ type: 'in', text: `> ${raw}` });

    if (cmd === 'help') {
      append({
        type: 'out',
        text: 'help | status | fortune | whoami | book | loot | clear | 自由输入=问 ROOM_OS',
      });
      return;
    }
    if (cmd === 'clear') {
      setLines([{ type: 'sys', text: '— 屏幕已清空 —' }]);
      return;
    }
    if (cmd === 'status') {
      append({
        type: 'out',
        text: `碎片:${shards} | 藏品:${collectiblesCount}/15 | AI余量:${getAiRemaining()} | 模式:${nightDebug ? 'LOW_LIGHT_DEBUG' : 'NORMAL'}`,
      });
      return;
    }
    if (cmd === 'whoami') {
      append({
        type: 'out',
        text: profile
          ? `${profile.nickname} // ${profile.fullTitle}`
          : 'GUEST // 未映射访客',
      });
      return;
    }
    if (cmd === 'fortune') {
      setBusy(true);
      try {
        const text = isAiConfigured()
          ? await fetchTerminalFortune()
          : pickFallback('fortune');
        append({ type: 'out', text: `🔮 ${text}` });
      } catch {
        append({ type: 'out', text: `🔮 ${pickFallback('fortune')}` });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (cmd === 'book') {
      setBusy(true);
      try {
        const text = isAiConfigured()
          ? await qwenOnce('你是赛博图书管理员，推荐虚构书籍。', promptBookshelf())
          : pickFallback('bookshelf');
        append({ type: 'out', text: `📚 ${text}` });
      } catch {
        append({ type: 'out', text: `📚 ${pickFallback('bookshelf')}` });
      } finally {
        setBusy(false);
      }
      return;
    }
    if (cmd === 'loot') {
      const key = 'room404-loot';
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem(key);
      if (last === today) {
        append({ type: 'err', text: '今日 loot 已执行，明天再来。' });
        return;
      }
      localStorage.setItem(key, today);
      if (Math.random() < 0.25) {
        append({ type: 'out', text: '🎁 漏洞赏金 +2 碎片（已入账）' });
        onLoot?.(2);
      } else {
        append({ type: 'out', text: '扫描完成：暂无赏金。' });
      }
      return;
    }

    setBusy(true);
    try {
      const reply = isAiConfigured()
        ? await fetchTerminalReply(raw)
        : pickFallback('terminal');
      append({ type: 'out', text: reply });
    } catch {
      append({ type: 'err', text: pickFallback('terminal') });
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = () => {
    if (!input.trim() || busy) return;
    const val = input;
    setInput('');
    runCommand(val);
  };

  return (
    <div className="ai-terminal">
      <div className="ai-terminal-screen" ref={scrollRef}>
        {lines.map((line, i) => (
          <div key={i} className={`terminal-line ${line.type}`}>{line.text}</div>
        ))}
        {busy && <div className="terminal-line sys">...decrypting</div>}
      </div>
      <div className="ai-terminal-input-row">
        <span className="terminal-prompt">&gt;</span>
        <input
          className="ai-terminal-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onSubmit()}
          placeholder="help / fortune / 随便问..."
          disabled={busy}
        />
      </div>
    </div>
  );
}
