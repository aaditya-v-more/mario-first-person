import { GameAudio } from './audio';
import type { GameRuntime } from './runtime';

export function createTextureCanvas(): HTMLCanvasElement {
  return document.createElement('canvas');
}

export function createBrowserRuntime(): GameRuntime {
  const removers: (() => void)[] = [];
  let frame = 0;
  let stopped = false;
  return {
    createTextureCanvas,
    pixelRatio: Math.min(devicePixelRatio, 1.75),
    audio: new GameAudio(),
    listen(target, name, handler) {
      target.addEventListener(name, handler);
      removers.push(() => target.removeEventListener(name, handler));
    },
    startFrames(callback) {
      const tick = (now: number) => {
        if (stopped) return;
        frame = requestAnimationFrame(tick);
        callback(now);
      };
      frame = requestAnimationFrame(tick);
    },
    destroy() {
      stopped = true;
      cancelAnimationFrame(frame);
      removers.forEach(remove => remove());
    },
    loadGraphics: () => import('./rtx'),
  };
}
