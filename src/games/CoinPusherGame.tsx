import { useCallback, useEffect, useRef, useState } from 'react';
import { CoinPusher3DEngine, COIN_PUSHER_LIMITS } from '@/games/coinPusher3D';
import { Plinko2DEngine } from '@/games/plinko2D';
import { useGameStore } from '@/store/gameStore';
import { vibrate } from '@/utils/sound';

const SYMBOLS = ['7', '$', '★', '♥', '▣'] as const;
const JACKPOT_SYM = '★';

type Grid3x3 = string[][];

interface CoinPusherGameProps {
  onExit: (shardsEarned: number) => void;
}

function pickSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function emptyGrid(): Grid3x3 {
  return [
    ['?', '?', '?'],
    ['?', '?', '?'],
    ['?', '?', '?'],
  ];
}

function forceJackpotGrid(): Grid3x3 {
  const grid = [
    [pickSymbol(), pickSymbol(), pickSymbol()],
    [pickSymbol(), pickSymbol(), pickSymbol()],
    [pickSymbol(), pickSymbol(), pickSymbol()],
  ];
  for (let r = 0; r < 3; r++) grid[r][r] = JACKPOT_SYM;
  return grid;
}

function checkThreeLine(grid: Grid3x3): { jackpot: boolean; anyLine: boolean } {
  const lines: [number, number][][] = [
    [[0, 0], [0, 1], [0, 2]],
    [[1, 0], [1, 1], [1, 2]],
    [[2, 0], [2, 1], [2, 2]],
    [[0, 0], [1, 0], [2, 0]],
    [[0, 1], [1, 1], [2, 1]],
    [[0, 2], [1, 2], [2, 2]],
    [[0, 0], [1, 1], [2, 2]],
    [[0, 2], [1, 1], [2, 0]],
  ];
  let jackpot = false;
  let anyLine = false;
  for (const line of lines) {
    const [a, b, c] = line.map(([r, col]) => grid[r][col]);
    if (a === b && b === c && a !== '?') {
      anyLine = true;
      if (a === JACKPOT_SYM) jackpot = true;
    }
  }
  return { jackpot, anyLine };
}

export function CoinPusherGame({ onExit }: CoinPusherGameProps) {
  const walletShards = useGameStore((s) => s.shards);
  const plinkoCanvasRef = useRef<HTMLCanvasElement>(null);
  const mount3dRef = useRef<HTMLDivElement>(null);
  const plinkoRef = useRef<Plinko2DEngine | null>(null);
  const engine3dRef = useRef<CoinPusher3DEngine | null>(null);
  const dropsRef = useRef(0);
  const dropsSinceArmRef = useRef(0);
  const bonusRainArmedRef = useRef(false);
  const bonusPendingRef = useRef(false);

  const [earned, setEarned] = useState(0);
  const [drops, setDrops] = useState(0);
  const [jackpotMode, setJackpotMode] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [showLottery, setShowLottery] = useState(false);
  const [grid, setGrid] = useState<Grid3x3>(emptyGrid);
  const [lotterySpinning, setLotterySpinning] = useState(false);
  const [lotteryMsg, setLotteryMsg] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  }, []);

  const startCoinRain = useCallback((message = '★ 连线达成 · 投币口爆币瀑布 ★') => {
    if (plinkoRef.current?.isJackpotActive()) return;
    setJackpotMode(true);
    showToast(message);
    vibrate(80);
    plinkoRef.current?.startJackpotRain(50, 3);
    const watchEnd = window.setInterval(() => {
      if (!plinkoRef.current?.isJackpotActive()) {
        window.clearInterval(watchEnd);
        setJackpotMode(false);
      }
    }, 200);
  }, [showToast]);

  const runLottery3x3 = useCallback((forceJackpot = false) => {
    setShowLottery(true);
    setLotterySpinning(true);
    setLotteryMsg(forceJackpot ? 'BONUS 连线蓄力中...' : '3×3 抽奖启动...');
    setGrid(emptyGrid());

    let ticks = 0;
    const spin = window.setInterval(() => {
      setGrid([
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
      ]);
      ticks += 1;
      if (ticks >= 16) {
        window.clearInterval(spin);
        const final = forceJackpot
          ? forceJackpotGrid()
          : [
              [pickSymbol(), pickSymbol(), pickSymbol()],
              [pickSymbol(), pickSymbol(), pickSymbol()],
              [pickSymbol(), pickSymbol(), pickSymbol()],
            ] as Grid3x3;
        if (!forceJackpot && Math.random() < 0.1) {
          for (let r = 0; r < 3; r++) final[r][r] = JACKPOT_SYM;
        }
        setGrid(final);
        setLotterySpinning(false);

        const { jackpot, anyLine } = checkThreeLine(final);
        if (jackpot) {
          setLotteryMsg('★ 三连 JACKPOT! 投币口爆币瀑布 ★');
          engine3dRef.current?.addBonusShards(5);
          vibrate(80);
          if (forceJackpot) {
            bonusRainArmedRef.current = false;
            dropsSinceArmRef.current = 0;
          }
          window.setTimeout(() => {
            setShowLottery(false);
            startCoinRain(forceJackpot ? '★ BONUS 必中连线 · 投币口爆币瀑布 ★' : '★ BONUS 三连 · 投币口爆币瀑布 ★');
          }, 1400);
        } else if (anyLine) {
          setLotteryMsg('三连! 额外 +2 碎片');
          engine3dRef.current?.addBonusShards(2);
          vibrate(40);
        } else {
          setLotteryMsg('未三连，继续推币');
        }
        bonusPendingRef.current = false;
      }
    }, 70);
  }, [startCoinRain]);

  const runLotteryRef = useRef(runLottery3x3);
  runLotteryRef.current = runLottery3x3;

  useEffect(() => {
    const canvas = plinkoCanvasRef.current;
    const mount3d = mount3dRef.current;
    if (!canvas || !mount3d) return;

    const engine3d = new CoinPusher3DEngine(mount3d, {
      onCredits: () => {},
      onShards: setEarned,
      onNormalCatch: () => vibrate(25),
    });
    engine3dRef.current = engine3d;

    const plinko = new Plinko2DEngine(canvas, {
      onBonus: () => {
        if (bonusPendingRef.current) return;
        bonusPendingRef.current = true;
        vibrate(50);
        const forceJackpot = bonusRainArmedRef.current;
        runLotteryRef.current(forceJackpot);
      },
      onLanded: (normX) => {
        engine3d.receiveCoin(normX);
      },
    });
    plinkoRef.current = plinko;

    return () => {
      plinko.dispose();
      engine3d.dispose();
      plinkoRef.current = null;
      engine3dRef.current = null;
    };
  }, []);

  const spendDropShard = () => {
    const state = useGameStore.getState();
    if (state.shards < COIN_PUSHER_LIMITS.DROP_COST_SHARDS) return false;
    useGameStore.setState({ shards: state.shards - COIN_PUSHER_LIMITS.DROP_COST_SHARDS });
    return true;
  };

  const handleDrop = () => {
    if (jackpotMode || showLottery) return;
    if (earned >= COIN_PUSHER_LIMITS.MAX_SHARDS_EARNED || engine3dRef.current?.isMaxShards()) {
      showToast('本局收益已满，请收手结算');
      return;
    }
    if (!spendDropShard()) {
      showToast('数据碎片不足，无法投币');
      return;
    }

    dropsRef.current += 1;
    dropsSinceArmRef.current += 1;
    if (dropsSinceArmRef.current >= COIN_PUSHER_LIMITS.RAIN_MILESTONE) {
      bonusRainArmedRef.current = true;
    }

    setDrops(dropsRef.current);
    plinkoRef.current?.dropCoin();
    vibrate(15);
  };

  const exitWithShards = () => onExit(engine3dRef.current?.shardsEarned ?? earned);
  const maxEarned = earned >= COIN_PUSHER_LIMITS.MAX_SHARDS_EARNED;
  const canDrop = walletShards >= COIN_PUSHER_LIMITS.DROP_COST_SHARDS
    && !jackpotMode
    && !showLottery
    && !maxEarned;

  return (
    <div className="arcade-game-wrap coin-pusher-hybrid-wrap">
      <button type="button" className="btn-secondary arcade-game-back" onClick={exitWithShards}>
        ← 返回大厅
      </button>

      <div className="coin-pusher-hud pixel-font">
        <span className="hud-cyan">碎片 {walletShards}</span>
        <span className="hud-gold">本局 +{earned}</span>
        <span className="hud-dim">已投 {drops}</span>
      </div>

      {toast && <div className="coin-pusher-toast pixel-font">{toast}</div>}

      {jackpotMode && (
        <div className="coin-jackpot-banner pixel-font">★ 投币口爆币瀑布 ★</div>
      )}

      <div className="coin-pusher-split">
        <canvas
          ref={plinkoCanvasRef}
          className="coin-plinko-canvas"
          onClick={handleDrop}
        />
        <div ref={mount3dRef} className="coin-pusher-3d-mount coin-pusher-3d-bottom" />
      </div>

      <p className="arcade-hint">每投 1 枚消耗 1 数据碎片 · 落碟得分 · 随时可收手结算</p>

      <div className="arcade-game-actions">
        <button
          type="button"
          className="btn-primary claw-btn grab-btn"
          onClick={handleDrop}
          disabled={!canDrop}
        >
          投币! (-1 碎片)
        </button>
        <button type="button" className="btn-secondary" onClick={exitWithShards}>
          收手结算 (+{earned})
        </button>
      </div>

      {showLottery && (
        <div className="arcade-result-overlay slot-overlay">
          <div className="slot-machine lottery-3x3 crt-enter">
            <h3 className="pixel-font slot-title">赛博 3×3 抽奖</h3>
            <div className={`lottery-grid ${lotterySpinning ? 'slot-spinning' : ''}`}>
              {grid.map((row, ri) =>
                row.map((sym, ci) => (
                  <div key={`${ri}-${ci}`} className="lottery-cell pixel-font">{sym}</div>
                )),
              )}
            </div>
            <p className="slot-msg">{lotteryMsg}</p>
            {!lotterySpinning && lotteryMsg && !lotteryMsg.includes('JACKPOT') && (
              <button type="button" className="btn-primary" onClick={() => setShowLottery(false)}>
                继续推币
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
