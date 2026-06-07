import { useEffect, useState, ReactNode } from 'react';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

export function Overlay({ open, onClose, children, className }: OverlayProps) {
  const [visible, setVisible] = useState(open);
  const [animating, setAnimating] = useState<'enter' | 'exit' | null>(null);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setAnimating('enter');
    } else if (visible) {
      setAnimating('exit');
      const t = setTimeout(() => { setVisible(false); setAnimating(null); }, 300);
      return () => clearTimeout(t);
    }
  }, [open, visible]);

  if (!visible) return null;

  return (
    <div className="overlay-backdrop" onClick={onClose} aria-hidden={!open}>
      <div
        className={`overlay-panel ${animating === 'enter' ? 'crt-enter' : ''} ${animating === 'exit' ? 'crt-exit' : ''} ${className ?? ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="overlay-close" onClick={onClose} aria-label="关闭">×</button>
        {children}
      </div>
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}
