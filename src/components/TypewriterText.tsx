import { useEffect, useState, useCallback } from 'react';
import { playTypeSound } from '@/utils/sound';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function TypewriterText({ text, speed = 40, onComplete, className }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  const skip = useCallback(() => {
    setDisplayed(text);
    setDone(true);
    onComplete?.();
  }, [text, onComplete]);

  useEffect(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        if (i % 2 === 0) playTypeSound();
        i++;
      } else {
        clearInterval(timer);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(timer);
  }, [text, speed, onComplete]);

  return (
    <div className={`typewriter ${className ?? ''}`} onClick={() => !done && skip()}>
      {displayed}
      {!done && <span>|</span>}
    </div>
  );
}
