import { useEffect, useState } from 'react';
import { playTypeSound } from '@/utils/sound';

interface LoveTitleRevealProps {
  open: boolean;
  title: string;
  shardReward: number;
  onClose: () => void;
}

export function LoveTitleReveal({ open, title, shardReward, onClose }: LoveTitleRevealProps) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!open) {
      setDisplayed('');
      return;
    }
    let i = 0;
    const tick = window.setInterval(() => {
      i += 1;
      setDisplayed(title.slice(0, i));
      playTypeSound();
      if (i >= title.length) window.clearInterval(tick);
    }, 130);
    return () => window.clearInterval(tick);
  }, [open, title]);

  if (!open) return null;

  return (
    <div className="love-title-reveal-overlay" role="dialog" aria-modal="true">
      <div className="love-title-reveal-card crt-enter">
        <p className="love-title-reveal-label pixel-font">TITLE UNLOCKED</p>
        <h2 className="love-title-reveal-title pixel-font">
          {displayed}
          {displayed.length < title.length && <span className="love-title-cursor">▌</span>}
        </h2>
        <p className="love-title-reveal-sub">神经终端已写入永久称号</p>
        <p className="love-title-reveal-shards pixel-font">+{shardReward} 数据碎片</p>
        <button type="button" className="btn-primary" onClick={onClose}>
          确认
        </button>
      </div>
    </div>
  );
}
