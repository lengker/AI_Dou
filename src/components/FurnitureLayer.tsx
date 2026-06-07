import { getFurniture } from '@/data/furniture';
import { FURNITURE_VISUALS } from '@/data/furnitureVisuals';
import type { RoomId } from '@/types';

const STAR_TILE_COUNT = 8;

interface FurnitureLayerProps {
  room: RoomId;
  unlocked: string[];
}

export function FurnitureLayer({ room, unlocked }: FurnitureLayerProps) {
  const unlockedSet = new Set(unlocked);
  const items = FURNITURE_VISUALS.filter(
    (item) => item.room === room && unlockedSet.has(item.furnitureId),
  );

  if (items.length === 0) return null;

  return (
    <div className="furniture-layer" aria-hidden>
      {items.map((item) => {
        const def = getFurniture(item.furnitureId);
        const icon = def?.icon;
        const boxStyle = {
          left: `${item.x}%`,
          top: `${item.y}%`,
          width: `${item.w}%`,
          height: `${item.h}%`,
        };
        const key = `${item.furnitureId}-${item.room}`;

        if (item.kind === 'star-carpet' && icon) {
          return (
            <div
              key={key}
              className={`furniture-star-carpet ${item.variant === 'forest' ? 'furniture-star-carpet--forest' : ''}`}
              style={boxStyle}
            >
              {Array.from({ length: STAR_TILE_COUNT }, (_, i) => (
                <img key={`${key}-star-${i}`} src={icon} alt="" className="furniture-star-tile" />
              ))}
            </div>
          );
        }

        if (item.kind === 'stickers' && icon) {
          return (
            <div key={key} className="furniture-stickers" style={boxStyle}>
              {(item.scatter ?? []).map((slot, index) => (
                <img
                  key={`${key}-sticker-${index}`}
                  src={icon}
                  alt=""
                  className="furniture-sticker-img"
                  style={{ left: slot.left, top: slot.top, width: slot.size }}
                />
              ))}
            </div>
          );
        }

        if (item.kind === 'lamp') {
          return (
            <div
              key={key}
              className={`furniture-lamp ${item.variant === 'forest' ? 'furniture-lamp--forest' : ''}`}
              style={boxStyle}
            >
              <span className="furniture-lamp-core" aria-hidden />
              {icon && <img src={icon} alt="" className="furniture-lamp-icon" />}
            </div>
          );
        }

        if (item.kind === 'prop' && icon) {
          return (
            <div key={key} className="furniture-prop" style={boxStyle}>
              <img src={icon} alt="" className="furniture-prop-img" />
            </div>
          );
        }

        if (item.kind === 'props' && icon) {
          return (
            <div key={key} className="furniture-props" style={boxStyle}>
              {(item.scatter ?? []).map((slot, index) => (
                <img
                  key={`${key}-prop-${index}`}
                  src={icon}
                  alt=""
                  className="furniture-prop-scatter"
                  style={{ left: slot.left, top: slot.top, width: slot.size }}
                />
              ))}
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
