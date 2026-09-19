// Browser integration fixture only; never included in the shipping game.
import { GameEngine } from '../app/game/engine';
import { createBrowserRuntime } from '../app/game/browser-runtime';
const runtime = createBrowserRuntime();
runtime.audio.muted = true;
runtime.startFrames = () => {};
const game = new GameEngine(
  document.querySelector('#game') as HTMLElement,
  () => {},
  runtime,
);
Object.assign(window, { testGame: game });
game.loop(0);
