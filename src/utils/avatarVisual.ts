import type { CSSProperties } from 'react';
import type { AvatarAppearance } from '@/types';
import { getHairFilter, getSkinFilter } from '@/utils/colorMapping';

const DEFAULT_SPRITE = '/DOU/images/role/default.png';

export function getAvatarPortraitSrc(appearance: AvatarAppearance | undefined): string {
  if (appearance?.pixelPortrait) return appearance.pixelPortrait;
  return DEFAULT_SPRITE;
}

export function isPixelPortrait(appearance: AvatarAppearance | undefined): boolean {
  return Boolean(appearance?.pixelPortrait);
}

export function getAvatarPortraitStyle(appearance: AvatarAppearance | undefined): CSSProperties {
  if (appearance?.pixelPortrait) {
    return { width: '100%', height: '100%', imageRendering: 'pixelated' };
  }
  if (!appearance) return { width: '100%', height: '100%' };
  return {
    width: '100%',
    height: '100%',
    filter: `${getSkinFilter(appearance.skinTone)} ${getHairFilter(appearance.hairColor)}`,
  };
}
