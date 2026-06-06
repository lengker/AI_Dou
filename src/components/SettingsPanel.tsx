import { ACHIEVEMENTS } from '@/data/titles';
import { useGameStore } from '@/store/gameStore';
import { Overlay } from '@/components/Overlay';

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
    </Overlay>
  );
}
