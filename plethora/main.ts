import { GameEngine, type Snapshot } from '../app/game/engine';
import type { GameRuntime } from '../app/game/runtime';
import { styles } from './styles';
import { setThree } from './three-registry';
import { LEVELS } from '../app/game/levels';

// Only the public SDK surface used by this adapter.
export interface BitContext {
  width: number;
  height: number;
  dpr: number;
  safeArea: { top: number; right: number; bottom: number; left: number };
  capabilities: { audio: boolean; backgroundMusic: boolean };
  createRoot(options?: {
    className?: string;
    touchAction?: string;
    style?: Record<string, string>;
  }): HTMLElement;
  createCanvas(options?: { touchAction?: string }): HTMLCanvasElement;
  listen(
    target: EventTarget,
    name: string,
    handler: EventListener,
    options?: AddEventListenerOptions,
  ): void;
  onFrame(callback: (dt: number, time: number) => void): void;
  onDestroy(callback: () => void): void;
  importModule(name: string, version: string): Promise<unknown>;
  markVisualReady(reason?: string): void;
  platform: {
    ready(): void;
    start(): void;
    interact(payload: object): void;
    setScore(score: number): void;
    setProgress(progress: number): void;
    complete(payload: object): void;
    fail(payload: object): void;
    error(payload: object): void;
  };
  music: {
    unlock(): Promise<unknown>;
    play(options: object): unknown;
    pause(): void;
    resume(): void;
    stop(): void;
    setVolume(volume: number): void;
    sting(name: string): Promise<unknown>;
  };
}

export async function init(ctx: BitContext) {
  let destroyed = false,
    game: GameEngine | undefined;
  const canvas = ctx.createCanvas({ touchAction: 'none' });
  const root = ctx.createRoot({ className: 'mario-bit', touchAction: 'none' });
  root.innerHTML = `<style>${styles}</style>
    <header><b>MARIO <small>FIRST PERSON</small></b><div><button data-action="sound" aria-label="Toggle sound">Sound on</button><button data-action="pause" hidden>Pause</button><button data-action="help">?</button></div></header>
    <div class="hud" hidden><span data-stat="coins"></span><span data-stat="lives"></span><span data-stat="time"></span><span data-stat="score"></span></div>
    <div class="progress" hidden><i></i></div><div class="crosshair" hidden>+</div>
    <section class="panel"><small>WORLD 1–1</small><h1>MARIO<span>FIRST PERSON</span></h1><p class="description">Collect coins, stomp Goombas, and reach the flag. 32 original NES courses across eight worlds. Clear each course to unlock the next.</p><button class="primary" data-action="play" disabled>Loading world…</button><button data-action="restart" hidden>Restart course</button></section>
    <section class="help" hidden><h2>How to play</h2><ul><li>Move with the left joystick or WASD.</li><li>Drag the world to look. Arrow keys also move and turn.</li><li>Tap Jump or press Space. Hold Run or Shift to sprint.</li><li>Jump onto Goombas and hit ? blocks from below.</li><li>Cross the gaps and reach the flag before time runs out.</li></ul><button data-action="close-help">Got it</button></section>
    <div class="notice" role="status"></div>
    <div class="controls" hidden><div class="joystick" role="group" aria-label="Movement joystick"><i></i><span>MOVE</span></div><div class="actions"><button data-action="run">RUN</button><button data-action="fire" hidden>FIRE</button><button data-action="enter" hidden>ENTER</button><button data-action="crouch" hidden>DUCK</button><button data-action="jump">JUMP ↑</button></div></div>`;
  const el = <T extends HTMLElement = HTMLElement>(selector: string) =>
    root.querySelector<T>(selector)!;
  const listen = (target: EventTarget, name: string, handler: unknown) =>
    ctx.listen(target, name, handler as EventListener);
  const button = (name: string) =>
    el<HTMLButtonElement>(`[data-action="${name}"]`);
  let muted = !ctx.capabilities.backgroundMusic,
    started = false,
    musicStarted = false;
  let status = 'ready',
    previousScore = -1,
    previousProgress = -1,
    lastW = 0,
    lastH = 0;
  const audio: GameRuntime['audio'] = {
    get muted() {
      return muted;
    },
    set muted(value) {
      muted = value;
      ctx.music.setVolume(value ? 0 : 0.2);
    },
    noteIndex: 0,
    async activate() {
      if (!ctx.capabilities.backgroundMusic || muted) return;
      try {
        await ctx.music.unlock();
        if (destroyed) return;
        if (!musicStarted) {
          ctx.music.play({ preset: 'chiptune', volume: 0.2 });
          musicStarted = true;
        } else ctx.music.resume();
      } catch {
        /* Silent play remains available. */
      }
    },
    coin() {
      sting('coin');
    },
    jump() {
      sting('tap');
    },
    stomp() {
      sting('powerup');
    },
    hurt() {
      sting('danger');
    },
    win() {
      sting('win');
    },
    tone() {
      sting('success');
    },
    music() {},
    destroy() {
      ctx.music.stop();
    },
  };
  function sting(name: string) {
    if (!muted && ctx.capabilities.backgroundMusic)
      void ctx.music.sting(name).catch(() => {});
  }
  function layout() {
    const a = ctx.safeArea;
    root.style.setProperty('--top', `${Math.max(12, a.top + 8)}px`);
    root.style.setProperty('--bottom', `${Math.max(28, a.bottom + 22)}px`);
    root.style.setProperty('--left', `${Math.max(14, a.left + 10)}px`);
    root.style.setProperty('--right', `${Math.max(14, a.right + 10)}px`);
    if (lastW !== ctx.width || lastH !== ctx.height) {
      lastW = ctx.width;
      lastH = ctx.height;
      game?.resize();
    }
  }
  function update(s: Snapshot) {
    const playing = s.status === 'playing';
    el('.hud').hidden = s.status === 'ready';
    el('.progress').hidden = s.status === 'ready';
    el('.controls').hidden = !playing;
    el('.crosshair').hidden = !playing;
    button('pause').hidden = !playing;
    el('.panel').hidden = playing;
    el('[data-stat="coins"]').textContent = `● ${s.coins}/${s.total}`;
    el('[data-stat="lives"]').textContent = `♥ ${s.lives}`;
    el('[data-stat="time"]').textContent =
      `${Math.floor(s.time / 60)}:${String(s.time % 60).padStart(2, '0')}`;
    el('[data-stat="score"]').textContent = `${s.score} pts`;
    el('.progress i').style.width = `${Math.round(s.progress * 100)}%`;
    el('.notice').textContent = s.notice;
    button('fire').hidden = s.power !== 'fire';
    button('enter').hidden = !s.interaction;
    button('crouch').hidden = s.power === 'small';
    button('jump').textContent = s.underwater ? 'SWIM ↑' : 'JUMP ↑';
    el('.panel > small').textContent = `WORLD ${s.worldId} · ${s.levelName}`;
    if (s.score !== previousScore) {
      previousScore = s.score;
      ctx.platform.setScore(s.score);
    }
    const campaignProgress = (s.level + s.progress) / LEVELS.length;
    if (campaignProgress !== previousProgress) {
      previousProgress = campaignProgress;
      ctx.platform.setProgress(campaignProgress);
    }
    if (s.status !== status) {
      status = s.status;
      if (!playing) {
        ctx.music.pause();
        el('.joystick i').style.transform = 'translate(0,0)';
        button('run').removeAttribute('aria-pressed');
      }
      if (s.status === 'won')
        ctx.platform.complete({ score: s.score, coins: s.coins });
      if (s.status === 'over')
        ctx.platform.fail({ score: s.score, coins: s.coins });
    }
    if (s.status !== 'ready') {
      el('h1').textContent =
        s.status === 'paused'
          ? 'Take a breather.'
          : s.status === 'won'
            ? 'Kingdom saved!'
            : s.status === 'clear'
              ? 'Course clear!'
              : 'One more try?';
      el('.description').textContent =
        s.status === 'paused'
          ? 'Your adventure is waiting.'
          : s.status === 'won' || s.status === 'clear'
            ? `${s.coins} coins · ${s.score} points`
            : 'Every adventure takes a little practice.';
      button('play').textContent =
        s.status === 'paused'
          ? 'Keep playing'
          : s.status === 'clear'
            ? 'Next course'
            : 'Play again';
      button('restart').hidden = s.status !== 'paused';
    }
  }
  function play(restart = false) {
    if (!game) return;
    if (!started) {
      ctx.platform.start();
      started = true;
    }
    ctx.platform.interact({
      type:
        restart || status === 'won' || status === 'over' ? 'replay' : 'play',
    });
    el('.help').hidden = true;
    if (status === 'won') game.selectLevel(0, false);
    else if (restart || status === 'over') game.restart(false);
    else if (status === 'clear') game.nextLevel(false);
    else game.start(false);
  }
  listen(button('play'), 'click', () => play());
  listen(button('restart'), 'click', () => play(true));
  listen(button('pause'), 'click', () => game?.pause());
  listen(button('help'), 'click', () => {
    game?.pause();
    el('.help').hidden = false;
  });
  listen(button('close-help'), 'click', () => {
    el('.help').hidden = true;
  });
  button('sound').textContent = muted ? 'Sound off' : 'Sound on';
  button('sound').disabled = !ctx.capabilities.backgroundMusic;
  listen(button('sound'), 'click', () => {
    if (!game) return;
    game.setMuted(!muted);
    button('sound').textContent = muted ? 'Sound off' : 'Sound on';
    if (!muted && status === 'playing') void audio.activate();
  });
  listen(button('enter'), 'pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    game?.interact();
  });
  listen(button('crouch'), 'pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    button('crouch').setPointerCapture(event.pointerId);
    game?.keys.add('KeyC');
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    listen(button('crouch'), name, () => game?.keys.delete('KeyC'));
  listen(button('fire'), 'pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    game?.shoot();
  });
  listen(button('jump'), 'pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    game?.jump();
    ctx.platform.interact({ type: 'jump' });
  });
  for (const name of ['pointerup', 'pointercancel'])
    listen(button('jump'), name, () => game?.releaseJump());
  listen(button('run'), 'pointerdown', (event: PointerEvent) => {
    event.preventDefault();
    button('run').setPointerCapture(event.pointerId);
    game?.keys.add('ShiftLeft');
    button('run').setAttribute('aria-pressed', 'true');
  });
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    listen(button('run'), name, () => {
      game?.keys.delete('ShiftLeft');
      button('run').setAttribute('aria-pressed', 'false');
    });
  const joystick = el('.joystick');
  let pointer: number | null = null;
  function move(event: PointerEvent) {
    if (pointer !== event.pointerId) return;
    const r = joystick.getBoundingClientRect(),
      radius = r.width / 2;
    let x = (event.clientX - r.left - radius) / radius,
      y = (event.clientY - r.top - radius) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    game?.setTouch(x, y);
    el('.joystick i').style.transform =
      `translate(${x * radius * 0.48}px,${y * radius * 0.48}px)`;
  }
  listen(joystick, 'pointerdown', (event: PointerEvent) => {
    if (pointer !== null) return;
    event.preventDefault();
    pointer = event.pointerId;
    joystick.setPointerCapture(pointer);
    move(event);
  });
  listen(joystick, 'pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    listen(joystick, name, (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      pointer = null;
      game?.setTouch(0, 0);
      el('.joystick i').style.transform = 'translate(0,0)';
    });
  ctx.onDestroy(() => {
    destroyed = true;
    game?.destroy();
  });
  layout();
  // The start panel is visible before the library download begins.
  ctx.markVisualReady('Mario start screen');
  ctx.platform.ready();
  try {
    // The build substitutes this module for all Three.js imports, with no bundled third-party code.
    const three = await ctx.importModule('three', '0.164.1');
    if (destroyed) return;
    setThree(three);
    const runtime: GameRuntime = {
      canvas,
      pixelRatio: Math.min(ctx.dpr, 1.5),
      audio,
      createTextureCanvas() {
        const texture = ctx.createCanvas();
        texture.style.display = 'none';
        return texture;
      },
      listen: (target, name, handler) => ctx.listen(target, name, handler),
      startFrames: (callback) =>
        ctx.onFrame((_dt, time) => {
          if (destroyed) return;
          layout();
          callback(time);
        }),
      destroy() {},
      async loadGraphics() {
        throw new Error('Plethora uses classic graphics.');
      },
    };
    game = new GameEngine(root, update, runtime);
    // Resize once after assignment; runtime's frames handle subsequent host resizes.
    game.resize();
    game.loop(0);
    button('play').disabled = false;
    button('play').textContent = 'Let’s play';
  } catch (error) {
    game?.destroy();
    game = undefined;
    el('.description').textContent =
      'The 3D world could not load. Reopen this Bit on a device with WebGL enabled.';
    button('play').textContent = 'Unable to load';
    ctx.platform.error({
      message:
        error instanceof Error ? error.message : 'Unable to load 3D world',
    });
  }
}
