import { useState } from 'react';
import { COLLECTIBLES } from '@/data/collectibles';
import { FOREST_ANIMALS } from '@/data/forestAnimals';
import { useGameStore } from '@/store/gameStore';
import { Overlay } from '@/components/Overlay';
import { TypewriterText } from '@/components/TypewriterText';

export function CollectionPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const collectibles = useGameStore((s) => s.collectibles);
  const forestAnimals = useGameStore((s) => s.forestAnimals);
  const [tab, setTab] = useState<'collectibles' | 'forest'>('collectibles');
  const [selected, setSelected] = useState<string | null>(null);
  const selectedItem = selected ? COLLECTIBLES.find((c) => c.id === selected) : null;
  const selectedAnimal = selected ? FOREST_ANIMALS.find((a) => a.id === selected) : null;

  return (
    <>
      <Overlay open={open} onClose={onClose}>
        <div className="collection-tabs">
          <button type="button" className={`collection-tab ${tab === 'collectibles' ? 'active' : ''}`} onClick={() => setTab('collectibles')}>赛博藏品</button>
          <button type="button" className={`collection-tab ${tab === 'forest' ? 'active' : ''}`} onClick={() => setTab('forest')}>林海图鉴</button>
        </div>
        {tab === 'collectibles' ? (
          <>
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
          </>
        ) : (
          <>
            <div className="collection-header">已记录 {forestAnimals.length}/{FOREST_ANIMALS.length}</div>
            <div className="collection-grid forest-grid">
              {FOREST_ANIMALS.map((animal) => {
                const owned = forestAnimals.includes(animal.zoneId);
                return (
                  <div key={animal.id} className={`collection-slot ${owned ? 'owned' : ''}`} onClick={() => owned && setSelected(animal.id)}>
                    <img src={animal.image} alt={animal.name} />
                    <span className="slot-id">{animal.id}</span>
                    {owned && <span className="slot-name">{animal.name}</span>}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Overlay>
      <Overlay open={!!(selectedItem || selectedAnimal)} onClose={() => setSelected(null)}>
        {selectedItem && (
          <>
            <img src={selectedItem.icon} alt={selectedItem.name} className="overlay-image" />
            <h3 style={{ textAlign: 'center', marginBottom: 12, color: '#00ffcc' }}>{selectedItem.name}</h3>
            <TypewriterText text={selectedItem.description} />
          </>
        )}
        {selectedAnimal && (
          <>
            <img src={selectedAnimal.image} alt={selectedAnimal.name} className="overlay-image" />
            <h3 style={{ textAlign: 'center', marginBottom: 12, color: '#00ffcc' }}>{selectedAnimal.name}</h3>
            <TypewriterText text={`${selectedAnimal.hotspotName}：${selectedAnimal.successText}`} />
          </>
        )}
      </Overlay>
    </>
  );
}
