import { FOREST_ANIMALS } from '@/data/forestAnimals';

interface ForestAnimalsLayerProps {
  unlockedZoneIds: string[];
  highlightZoneId?: string | null;
  disabled?: boolean;
  onAnimalClick: (zoneId: string) => void;
}

export function ForestAnimalsLayer({
  unlockedZoneIds,
  highlightZoneId,
  disabled = false,
  onAnimalClick,
}: ForestAnimalsLayerProps) {
  const unlockedSet = new Set(unlockedZoneIds);

  return (
    <div className="forest-animals-layer">
      {FOREST_ANIMALS.map((animal) => {
        const unlocked = unlockedSet.has(animal.zoneId);
        const highlighted = highlightZoneId === animal.zoneId;

        return (
          <button
            key={animal.id}
            type="button"
            className={`forest-animal-marker ${unlocked ? 'is-unlocked' : 'is-pending'} ${highlighted ? 'is-highlighted' : ''}`}
            style={{
              left: `${animal.markerX}%`,
              top: `${animal.markerY}%`,
              height: `${animal.markerHeight}px`,
            }}
            disabled={disabled}
            aria-label={animal.hotspotName}
            onClick={(event) => {
              event.stopPropagation();
              onAnimalClick(animal.zoneId);
            }}
          >
            <img src={animal.image} alt="" className="forest-animal-sprite" draggable={false} />
            {highlighted && <span className="hint-badge forest-animal-hint">探索</span>}
          </button>
        );
      })}
    </div>
  );
}
