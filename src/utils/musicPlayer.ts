let currentTrack: HTMLAudioElement | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeMusicPlayer(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function isForRiverPlaying() {
  return !!currentTrack && !currentTrack.paused;
}

export function playForRiver(src: string): Promise<void> {
  stopForRiver();
  currentTrack = new Audio(src);
  currentTrack.loop = true;
  return currentTrack.play().then(() => {
    notify();
  }).catch(() => {
    currentTrack = null;
    notify();
    throw new Error('播放失败，请检查浏览器是否允许播放音频');
  });
}

export function stopForRiver() {
  if (!currentTrack) return;
  currentTrack.pause();
  currentTrack.currentTime = 0;
  currentTrack = null;
  notify();
}
