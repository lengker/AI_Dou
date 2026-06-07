import { useSyncExternalStore } from 'react';
import { MUSIC_BOX } from '@/data/musicBox';
import { isForRiverPlaying, subscribeMusicPlayer } from '@/utils/musicPlayer';

interface MusicBoxPropProps {
  disabled?: boolean;
  onClick: () => void;
}

export function MusicBoxProp({ disabled = false, onClick }: MusicBoxPropProps) {
  const playing = useSyncExternalStore(subscribeMusicPlayer, isForRiverPlaying, () => false);

  return (
    <div className="music-box-layer">
      <button
        type="button"
        className={`music-box-marker ${playing ? 'is-playing' : ''}`}
        style={{
          left: `${MUSIC_BOX.markerX}%`,
          top: `${MUSIC_BOX.markerY}%`,
          height: `${MUSIC_BOX.markerHeight}px`,
        }}
        disabled={disabled}
        aria-label="留声机"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
      >
        <img src={MUSIC_BOX.image} alt="" className="music-box-sprite" draggable={false} />
      </button>
    </div>
  );
}
