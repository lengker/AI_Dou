import { useState, useRef, useEffect } from 'react';
import type { AvatarProfile } from '@/types';
import { petPersona } from '@/services/aiPrompts';
import { qwenChat, pickFallback, isAiConfigured, trimChatHistory, type ChatMessage } from '@/services/qwen';
import { getAiRemaining, AI_DAILY_LIMIT } from '@/utils/aiQuota';

interface PetChatPanelProps {
  open: boolean;
  onClose: () => void;
  profile: AvatarProfile | null;
}

interface Msg {
  role: 'user' | 'assistant';
  text: string;
}

export function PetChatPanel({ open, onClose, profile }: PetChatPanelProps) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: 'assistant', text: `嗨 ${profile?.nickname ?? '访客'}，神经链接已建立。想聊什么？` }]);
      setHistory([{ role: 'system', content: petPersona(profile) }]);
    }
  }, [open, profile, messages.length]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text }]);
    setLoading(true);

    const nextHistory: ChatMessage[] = [...history, { role: 'user', content: text }];

    try {
      if (!isAiConfigured()) throw new Error('NO_API_KEY');
      const reply = await qwenChat(trimChatHistory(nextHistory), { maxTokens: 180, temperature: 0.6 });
      setHistory([...nextHistory, { role: 'assistant', content: reply }]);
      setMessages((m) => [...m, { role: 'assistant', text: reply }]);
    } catch {
      const fb = pickFallback('chat');
      setMessages((m) => [...m, { role: 'assistant', text: fb }]);
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="ai-panel-overlay" onClick={onClose}>
      <div className="ai-chat-panel crt-enter" onClick={(e) => e.stopPropagation()}>
        <div className="ai-panel-header">
          <span className="ai-panel-title">⚡ 神经链接</span>
          <span className="ai-quota">今日 AI {getAiRemaining()}/{AI_DAILY_LIMIT}</span>
          <button type="button" className="overlay-close" onClick={onClose}>×</button>
        </div>
        <div className="ai-chat-messages" ref={scrollRef}>
          {messages.map((m, i) => (
            <div key={i} className={`ai-chat-bubble ${m.role}`}>{m.text}</div>
          ))}
          {loading && <div className="ai-chat-bubble assistant ai-loading">同步脑波中...</div>}
        </div>
        <div className="ai-chat-input-row">
          <input
            className="ai-chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            placeholder="对分身说点什么..."
            maxLength={200}
          />
          <button type="button" className="btn-primary ai-send-btn" onClick={send} disabled={loading || !input.trim()}>
            发送
          </button>
        </div>
        <p className="ai-hint">由千问驱动 · 分身记得你的称号与人设</p>
      </div>
    </div>
  );
}
