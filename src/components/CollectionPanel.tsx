import { useState } from 'react';
import { COLLECTIBLES } from '@/data/collectibles';
import { useGameStore } from '@/store/gameStore';
import { Overlay } from '@/components/Overlay';
import { TypewriterText } from '@/components/TypewriterText';

export function CollectionPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const collectibles = useGameStore((s) => s.collectibles);
  const [selected, setSelected] = useState<string | null>(null);
  const selectedItem = selected ? COLLECTIBLES.find((c) => c.id === selected) : null;

  return (
    <>
      <Overlay open={open} onClose={onClose}>
        <div className="collection-header">已收集 {collectibles.length}/15</div>
        <div className="collection-grid">
          {COLLECTIBLES.map((item) => {
            const owned = collectibles.includes(item.id);
            return (
              <div key={item.id} className={`collection-slot ${owned ? 'owned' : ''}`} onClick={() => owned && setSelected(item.id)}>
                <img src={item.icon} alt={item.name} />
                <span className="slot-id">{item.id}</span>
                {owned && <span className="slot-name">{item.name}</span>}
              </div>
            );
          })}
        </div>
      </Overlay>
      <Overlay open={!!selectedItem} onClose={() => setSelected(null)}>
        {selectedItem && (
          <>
            <img src={selectedItem.icon} alt={selectedItem.name} className="overlay-image" />
            <h3 style={{ textAlign: 'center', marginBottom: 12, color: '#00ffcc' }}>{selectedItem.name}</h3>
            <TypewriterText text={selectedItem.description} />
          </>
        )}
      </Overlay>
    </>
  );
}
