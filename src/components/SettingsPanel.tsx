import { ACHIEVEMENTS } from '@/data/titles';
import { useGameStore } from '@/store/gameStore';
import { Overlay } from '@/components/Overlay';

const RESET_STORAGE_KEYS = [
  'room404-save',
  'room404-last-open',
  'room404-ai-quota',
  'room404-loot',
  'dou_force_midnight',
];

const RESET_STORAGE_PREFIXES = [
  'weekend-cola-',
];

export function SettingsPanel({
  open, onClose, onRemap, onToast, onRestartTutorial,
}: {
  open: boolean; onClose: () => void; onRemap: () => void;
  onToast: (msg: string) => void; onRestartTutorial: () => void;
}) {
  const shards = useGameStore((s) => s.shards);
  const achievements = useGameStore((s) => s.achievements);
  const profile = useGameStore((s) => s.profile);
  const startRemapping = useGameStore((s) => s.startRemapping);

  const handleRemap = () => {
    if (shards < 30) { onToast('数据碎片不足。'); return; }
    if (startRemapping()) { onClose(); onRemap(); }
  };

  const handleRestartGame = () => {
    const confirmed = window.confirm('这会删除当前浏览器中的全部本地存档、教程进度与调试状态，并立即重新开始游戏。此操作无法撤销，是否继续？');
    if (!confirmed) return;

    useGameStore.persist.clearStorage();
    RESET_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      if (RESET_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        window.localStorage.removeItem(key);
      }
    }
    window.sessionStorage.removeItem('dou_force_midnight');
    window.location.reload();
  };

  return (
    <Overlay open={open} onClose={onClose}>
      <h2 className="panel-title">设置</h2>
      {profile && (
        <div style={{ textAlign: 'center', marginBottom: 16, fontSize: 13, color: '#aaa' }}>
          <div>{profile.nickname}</div>
          <div style={{ color: '#00ffcc', marginTop: 4 }}>{profile.fullTitle}</div>
        </div>
      )}
      <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="btn-primary" style={{ width: '100%' }} disabled={shards < 30} onClick={handleRemap}>
          特征重构（30 碎片）
        </button>
        <button className="btn-secondary" style={{ width: '100%' }} onClick={() => { onClose(); onRestartTutorial(); }}>
          重看探索指引
        </button>
      </div>
      <h3 style={{ fontSize: 14, color: '#888', marginBottom: 8 }}>成就</h3>
      <ul className="settings-list">
        {ACHIEVEMENTS.map((ach) => (
          <li key={ach.id} className={`achievement-item ${achievements.includes(ach.id) ? 'unlocked' : 'locked'}`}>
            <span>{ach.name}</span>
            <span>{achievements.includes(ach.id) ? '✓' : '—'}</span>
          </li>
        ))}
      </ul>
      <div className="settings-dev-tools">
        <h3 className="settings-dev-title">重新开始</h3>
        <p className="settings-dev-copy">
          删除当前浏览器中的全部本地存档、教程进度与调试状态，并从全新开局重新开始游戏。
        </p>
        <button className="btn-secondary settings-dev-reset" type="button" onClick={handleRestartGame}>
          重新开始游戏
        </button>
      </div>
    </Overlay>
  );
}
