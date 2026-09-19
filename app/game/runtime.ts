import type { GameAudio } from './audio';
import type { RtxGraphics } from './rtx';

export interface GameRuntime {
  canvas?: HTMLCanvasElement;
  createTextureCanvas(): HTMLCanvasElement;
  pixelRatio: number;
  audio: Pick<
    GameAudio,
    | 'activate'
    | 'muted'
    | 'noteIndex'
    | 'coin'
    | 'jump'
    | 'stomp'
    | 'hurt'
    | 'win'
    | 'tone'
    | 'music'
    | 'destroy'
  > & { setTheme?: (theme: string) => void };
  listen(target: EventTarget, name: string, handler: EventListener): void;
  startFrames(callback: (now: number) => void): void;
  destroy(): void;
  loadGraphics(): Promise<{ RtxGraphics: typeof RtxGraphics }>;
}
