import { useEffect, useState } from 'react';
import { TypewriterText } from '@/components/TypewriterText';

interface AiNarrativeProps {
  title: string;
  loading: boolean;
  text: string | null;
  loadingHint?: string;
}

export function AiNarrative({ title, loading, text, loadingHint = '正在接入神经网络...' }: AiNarrativeProps) {
  const [display, setDisplay] = useState('');

  useEffect(() => {
    if (text) setDisplay(text);
  }, [text]);

  return (
    <div className="ai-narrative">
      <h4 className="ai-narrative-title">{title}</h4>
      {loading && (
        <div className="ai-narrative-loading">
          <span className="ai-scan-dots">{loadingHint}</span>
        </div>
      )}
      {!loading && display && <TypewriterText text={display} speed={25} />}
    </div>
  );
}

/** Hook: 异步拉取 AI 叙事 */
export function useAiLine(
  fetcher: () => Promise<string>,
  deps: unknown[],
  enabled = true,
) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setText(null);
    fetcher()
      .then((t) => { if (!cancelled) setText(t); })
      .catch(() => { if (!cancelled) setText(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { loading, text };
}
