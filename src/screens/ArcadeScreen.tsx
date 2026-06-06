import { lazy, Suspense, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { ClawMachineGame } from '@/games/ClawMachineGame';

const CoinPusherGame = lazy(() =>
  import('@/games/CoinPusherGame').then((m) => ({ default: m.CoinPusherGame })),
);

type ArcadeView = 'lobby' | 'coin' | 'claw';

export function ArcadeScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const returnRoom = useGameStore((s) => s.returnRoom);
  const switchRoom = useGameStore((s) => s.switchRoom);
  const addShards = useGameStore((s) => s.addShards);

  const [view, setView] = useState<ArcadeView>('lobby');
  const [lastReward, setLastReward] = useState<number | null>(null);

  const backToRoom = () => {
    if (returnRoom) switchRoom(returnRoom);
    setScreen('room');
  };

  const onGameExit = (earned: number) => {
    if (earned > 0) addShards(earned);
    setLastReward(earned);
    setView('lobby');
  };

  if (view === 'coin') {
    return (
      <Suspense fallback={<div className="arcade-game-wrap arcade-hint">加载 3D 推币机...</div>}>
        <CoinPusherGame onExit={onGameExit} />
      </Suspense>
    );
  }
  if (view === 'claw') {
    return <ClawMachineGame onExit={onGameExit} />;
  }

  return (
    <div className="arcade-lobby">
      <div className="arcade-lobby-header">
        <button type="button" className="btn-secondary arcade-back-btn" onClick={backToRoom}>
          ← 返回房间
        </button>
        <h2 className="pixel-font arcade-lobby-title">街机大厅</h2>
      </div>

      {lastReward !== null && lastReward > 0 && (
        <div className="arcade-reward-toast">本局获得 +{lastReward} 数据碎片</div>
      )}

      <p className="arcade-lobby-desc">选一台机器，把数据碎片赢回家</p>

      <div className="arcade-machine-grid">
        <button type="button" className="arcade-machine-card" onClick={() => { setLastReward(null); setView('coin'); }}>
          <div className="machine-preview coin-preview">
            <span className="machine-coins">$$$</span>
          </div>
          <h3>赛博推币机</h3>
          <p>2D 钉板 + 3D 推板</p>
          <span className="machine-tag">上手快</span>
        </button>

        <button type="button" className="arcade-machine-card" onClick={() => { setLastReward(null); setView('claw'); }}>
          <div className="machine-preview claw-preview">
            <span className="machine-claw">爪</span>
          </div>
          <h3>赛博抓娃娃机</h3>
          <p>移动爪子 · 6 次抓取机会</p>
          <span className="machine-tag">高回报</span>
        </button>
      </div>

      <ul className="arcade-rules">
        <li>推币机：上方 2D 钉板落币，Bonus 触发 3×3 抽奖，下方 3D 推板落碟得分</li>
        <li>抓娃娃：不同玩偶价值 2～5 碎片，共 6 次机会</li>
        <li>随时可「收手结算」，碎片立刻入账</li>
      </ul>
    </div>
  );
}
