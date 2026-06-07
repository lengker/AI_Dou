import { lazy, Suspense, useState } from 'react';
import { CLAW_PRIZES } from '@/data/clawPrizes';
import { useGameStore } from '@/store/gameStore';
import { ClawMachineGame, CLAW_GRAB_COST } from '@/games/ClawMachineGame';
import type { HintKey } from '@/types';

const CoinPusherGame = lazy(() =>
  import('@/games/CoinPusherGame').then((m) => ({ default: m.CoinPusherGame })),
);

type ArcadeView = 'lobby' | 'coin' | 'claw';

const ARCADE_HINT_COPY: Record<'arcade_coin' | 'arcade_claw', string> = {
  arcade_coin: '先完成一局推币机，抓娃娃机会在结算后自动开放。',
  arcade_claw: '抓娃娃机已经开放，试一局新的高回报机器。',
};

export function ArcadeScreen() {
  const setScreen = useGameStore((s) => s.setScreen);
  const returnRoom = useGameStore((s) => s.returnRoom);
  const switchRoom = useGameStore((s) => s.switchRoom);
  const addShards = useGameStore((s) => s.addShards);
  const unlockedFeatures = useGameStore((s) => s.unlockedFeatures);
  const recordArcadePlay = useGameStore((s) => s.recordArcadePlay);
  const activeHint = useGameStore((s) => s.activeHint);
  const completedHints = useGameStore((s) => s.completedHints);
  const dismissActiveHint = useGameStore((s) => s.dismissActiveHint);

  const [view, setView] = useState<ArcadeView>('lobby');
  const [lastReward, setLastReward] = useState<number | null>(null);
  const completedHintSet = new Set(completedHints);
  const lobbyHint = activeHint === 'arcade_coin' || activeHint === 'arcade_claw' ? activeHint : null;

  const backToRoom = () => {
    if (returnRoom) switchRoom(returnRoom);
    setScreen('room');
  };

  const onGameExit = (earned: number) => {
    if (earned > 0) addShards(earned);
    if (view === 'coin' || view === 'claw') recordArcadePlay(view);
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
        <div className="arcade-lobby-heading">
          <h2 className="arcade-lobby-title">小游戏</h2>
          <p className="arcade-lobby-subtitle">选一台机器，把数据碎片赢回家</p>
        </div>
      </div>

      {lastReward !== null && lastReward > 0 && (
        <div className="arcade-reward-toast">本局获得 +{lastReward} 数据碎片</div>
      )}
      {lobbyHint && !completedHintSet.has(lobbyHint as HintKey) && (
        <div className="arcade-inline-hint">
          <span>{ARCADE_HINT_COPY[lobbyHint]}</span>
          <button type="button" onClick={dismissActiveHint}>知道了</button>
        </div>
      )}

      <div className="arcade-machine-grid">
        <button type="button" className="arcade-machine-card" onClick={() => { setLastReward(null); setView('coin'); }}>
          <div className="machine-preview coin-preview">
            <span className="machine-coins">$$$</span>
          </div>
          <div className="machine-copy">
            <h3>赛博推币机</h3>
            <p>2D 钉板 + 3D 推板，每投 1 枚消耗 1 碎片，落碟得分。</p>
          </div>
          <span className="machine-tag">{completedHintSet.has('arcade_coin') ? '轻松上手' : '推荐先玩'}</span>
          {!completedHintSet.has('arcade_coin') && <span className="hint-badge hint-badge-arcade">主线推荐</span>}
        </button>

        <button
          type="button"
          className="arcade-machine-card"
          disabled={!unlockedFeatures.includes('claw')}
          onClick={() => {
            if (!unlockedFeatures.includes('claw')) return;
            setLastReward(null);
            setView('claw');
          }}
        >
          <div className="machine-preview claw-preview">
            <div className="claw-preview-stack">
              {CLAW_PRIZES.slice(0, 3).map((prize) => (
                <img key={prize.id} src={prize.image} alt={prize.name} />
              ))}
            </div>
          </div>
          <div className="machine-copy">
            <h3>赛博抓娃娃机</h3>
            <p>{unlockedFeatures.includes('claw') ? `每抓 ${CLAW_GRAB_COST} 碎片，次数不限，抓中玩偶按奖励入账。` : '完成一次推币机游玩后解锁。'}</p>
          </div>
          <span className="machine-tag">{unlockedFeatures.includes('claw') ? '高回报' : '待解锁'}</span>
          {unlockedFeatures.includes('claw') && !completedHintSet.has('arcade_claw') && <span className="hint-badge hint-badge-arcade">NEW</span>}
        </button>
      </div>

      <div className="arcade-tips-card">
        <p>推币机适合稳扎稳打，抓娃娃更看手气与时机。</p>
        <p>随时都能收手结算，当前赢到的碎片会立刻入账。</p>
      </div>
    </div>
  );
}
