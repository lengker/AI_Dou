import { useCallback, useEffect, useRef, useState } from 'react';
import { CoinPusher3DEngine, COIN_PUSHER_LIMITS } from '@/games/coinPusher3D';
import { Plinko2DEngine } from '@/games/plinko2D';
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
  const plinkoCanvasRef = useRef<HTMLCanvasElement>(null);
  const mount3dRef = useRef<HTMLDivElement>(null);
  const plinkoRef = useRef<Plinko2DEngine | null>(null);
  const engine3dRef = useRef<CoinPusher3DEngine | null>(null);
  const creditsRef = useRef(COIN_PUSHER_LIMITS.INIT_CREDITS);
  const dropsRef = useRef(0);
  const bonusPendingRef = useRef(false);

  const [credits, setCredits] = useState(COIN_PUSHER_LIMITS.INIT_CREDITS);
  const [shards, setShards] = useState(0);
  const [drops, setDrops] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [jackpotMode, setJackpotMode] = useState(false);

  const [showLottery, setShowLottery] = useState(false);
  const [grid, setGrid] = useState<Grid3x3>(emptyGrid);
  const [lotterySpinning, setLotterySpinning] = useState(false);
  const [lotteryMsg, setLotteryMsg] = useState('');

  const syncCredits = useCallback((n: number) => {
    creditsRef.current = n;
    setCredits(n);
    engine3dRef.current?.setCredits(n);
  }, []);

  const checkSessionEnd = useCallback(() => {
    if (
      engine3dRef.current?.isMaxShards() ||
      dropsRef.current >= COIN_PUSHER_LIMITS.MAX_DROPS ||
      (creditsRef.current < COIN_PUSHER_LIMITS.DROP_COST && dropsRef.current > 0 && !plinkoRef.current?.isJackpotActive())
    ) {
      setShowResult(true);
    }
  }, []);

  const runLottery3x3 = useCallback(() => {
    setShowLottery(true);
    setLotterySpinning(true);
    setLotteryMsg('3×3 抽奖启动...');
    setGrid(emptyGrid());

    let ticks = 0;
    const spin = setInterval(() => {
      setGrid([
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
        [pickSymbol(), pickSymbol(), pickSymbol()],
      ]);
      ticks += 1;
      if (ticks >= 16) {
        clearInterval(spin);
        const final: Grid3x3 = [
          [pickSymbol(), pickSymbol(), pickSymbol()],
          [pickSymbol(), pickSymbol(), pickSymbol()],
          [pickSymbol(), pickSymbol(), pickSymbol()],
        ];
        if (Math.random() < 0.1) {
          for (let r = 0; r < 3; r++) final[r][r] = JACKPOT_SYM;
        }
        setGrid(final);
        setLotterySpinning(false);

        const { jackpot, anyLine } = checkThreeLine(final);
        if (jackpot) {
          setLotteryMsg('★ 三连 JACKPOT! 投币口爆币瀑布 ★');
          engine3dRef.current?.addBonusShards(5);
          vibrate(80);
          setTimeout(() => {
            setShowLottery(false);
            setJackpotMode(true);
            plinkoRef.current?.startJackpotRain(50, 3);
            const watchEnd = setInterval(() => {
              if (!plinkoRef.current?.isJackpotActive()) {
                clearInterval(watchEnd);
                setJackpotMode(false);
                checkSessionEnd();
              }
            }, 200);
          }, 1400);
        } else if (anyLine) {
          setLotteryMsg('三连! +2 碎片 +3 积分');
          engine3dRef.current?.addBonusShards(2);
          syncCredits(creditsRef.current + 3);
          vibrate(40);
        } else {
          setLotteryMsg('未三连，继续推币');
        }
        bonusPendingRef.current = false;
      }
    }, 70);
  }, [checkSessionEnd, syncCredits]);

  useEffect(() => {
    const canvas = plinkoCanvasRef.current;
    const mount3d = mount3dRef.current;
    if (!canvas || !mount3d) return;

    const engine3d = new CoinPusher3DEngine(mount3d, {
      onCredits: syncCredits,
      onShards: setShards,
      onNormalCatch: () => {
        vibrate(25);
        checkSessionEnd();
      },
    });
    engine3d.setCredits(creditsRef.current);
    engine3dRef.current = engine3d;

    const plinko = new Plinko2DEngine(canvas, {
      onBonus: () => {
        if (bonusPendingRef.current) return;
        bonusPendingRef.current = true;
        vibrate(50);
        runLottery3x3();
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
  }, [checkSessionEnd, runLottery3x3, syncCredits]);

  const handleDrop = () => {
    if (jackpotMode) return;
    if (creditsRef.current < COIN_PUSHER_LIMITS.DROP_COST) return;
    if (dropsRef.current >= COIN_PUSHER_LIMITS.MAX_DROPS) return;
    if (engine3dRef.current?.isMaxShards()) return;

    syncCredits(creditsRef.current - COIN_PUSHER_LIMITS.DROP_COST);
    dropsRef.current += 1;
    setDrops(dropsRef.current);
    plinkoRef.current?.dropCoin();
    vibrate(15);
  };

  const exitWithShards = () => onExit(engine3dRef.current?.shardsEarned ?? shards);

  return (
    <div className="arcade-game-wrap coin-pusher-hybrid-wrap">
      <button type="button" className="btn-secondary arcade-game-back" onClick={exitWithShards}>
        ← 返回大厅
      </button>

      <div className="coin-pusher-hud pixel-font">
        <span className="hud-cyan">积分 {credits}</span>
        <span className="hud-gold">碎片 +{shards}</span>
        <span className="hud-dim">投币 {drops}/{COIN_PUSHER_LIMITS.MAX_DROPS}</span>
      </div>

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

      <p className="arcade-hint">
        点击上方投币 · 投币口 180° 摆动 · BONUS 抽奖且硬币仍落台 · 下方 3D 推板落碟得分
      </p>

      <div className="arcade-game-actions">
        <button
          type="button"
          className="btn-primary claw-btn grab-btn"
          onClick={handleDrop}
          disabled={
            credits < COIN_PUSHER_LIMITS.DROP_COST ||
            drops >= COIN_PUSHER_LIMITS.MAX_DROPS ||
            jackpotMode ||
            showLottery
          }
        >
          投币!
        </button>
        <button type="button" className="btn-secondary" onClick={exitWithShards}>
          收手结算 (+{shards})
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

      {showResult && (
        <div className="arcade-result-overlay">
          <div className="arcade-result-card crt-enter">
            <h3>本局结算</h3>
            <p className="arcade-result-shards">+{shards} 数据碎片</p>
            <p style={{ color: '#888', fontSize: 12, marginBottom: 16 }}>
              剩余积分 {credits} · 共投 {drops} 枚
            </p>
            <button type="button" className="btn-primary" onClick={exitWithShards}>
              收入囊中
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
