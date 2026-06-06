import { useGameStore } from '@/store/gameStore';

export function ArcadePlaceholder() {
  const setScreen = useGameStore((s) => s.setScreen);
  const returnRoom = useGameStore((s) => s.returnRoom);
  const switchRoom = useGameStore((s) => s.switchRoom);

  return (
    <div className="arcade-placeholder">
      <h2 className="pixel-font">街机区域</h2>
      <p>赛博跳跃小游戏正在开发中，将替换为新的游戏玩法。</p>
      <button className="btn-primary" onClick={() => { if (returnRoom) switchRoom(returnRoom); setScreen('room'); }}>
        返回房间
      </button>
    </div>
  );
}
