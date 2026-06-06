import { useEffect } from 'react';
import { useGameStore } from '@/store/gameStore';
import { MappingScreen } from '@/screens/MappingScreen';
import { RoomScreen } from '@/screens/RoomScreen';
import { ArcadeScreen } from '@/screens/ArcadeScreen';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const initApp = useGameStore((s) => s.initApp);
  const recordExit = useGameStore((s) => s.recordExit);

  useEffect(() => {
    initApp();

    const onHide = () => recordExit();
    window.addEventListener('beforeunload', onHide);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') recordExit();
    });

    return () => {
      window.removeEventListener('beforeunload', onHide);
    };
  }, [initApp, recordExit]);

  return (
    <div className="app-shell">
      <div className={`game-viewport ${screen === 'room' ? 'room-mode' : ''}`}>
        {screen === 'mapping' && <MappingScreen />}
        {screen === 'room' && <RoomScreen />}
        {screen === 'arcade' && <ArcadeScreen />}
      </div>
    </div>
  );
}
