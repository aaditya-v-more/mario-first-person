'use client';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Pause,
  Flag,
  MoveUp,
  Heart,
  Trophy,
  Map,
  Lock,
  X,
  Flame,
  Check,
  FastForward,
} from 'lucide-react';
import type { GameEngine, Snapshot } from './engine';
import { LEVELS, WORLDS } from './levels';
import { CourseAtlas } from './CourseAtlas';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { registerGameTools } from './webmcp';
import { FullscreenSession, type FullscreenState } from './fullscreen';
function CreatorLinks() {
  return (
    <nav
      className="creator-links"
      data-creator-links
      aria-label="Created by Aaditya More"
    >
      <span>By Aaditya More</span>
      <div>
        <a href="https://aadityamore.com/">Website</a>
        <a href="https://github.com/aaditya-v-more">GitHub</a>
        <a href="https://www.linkedin.com/in/aadityavmore/">LinkedIn</a>
      </div>
      <a
        href="https://play.aadityamore.com/"
        data-collection-return
        style={{ minHeight: 44, padding: '6px 0' }}
      >
        ← Back to Play
      </a>
    </nav>
  );
}
const touchSnapshot = () =>
  typeof navigator !== 'undefined' &&
  (navigator.maxTouchPoints > 0 ||
    window.matchMedia('(any-pointer: coarse)').matches);
const subscribeTouch = (notify: () => void) => {
  const media = [
    window.matchMedia('(any-pointer: coarse)'),
    window.matchMedia('(max-width: 900px)'),
  ];
  media.forEach((query) => query.addEventListener('change', notify));
  return () =>
    media.forEach((query) => query.removeEventListener('change', notify));
};
const serverTouchSnapshot = () => false;
const initial: Snapshot = {
  status: 'ready',
  coins: 0,
  total: 0,
  lives: 3,
  time: LEVELS[0].time,
  score: 0,
  progress: 0,
  notice: '',
  level: 0,
  levelName: LEVELS[0].name,
  worldId: LEVELS[0].id,
  stars: 0,
  power: 'small',
  starTime: 0,
  checkpoint: false,
  bossHealth: null,
  unlocked: 0,
  records: [],
  campaignCoins: 0,
  area: 0,
  areaName: 'Overworld',
  underwater: false,
  interaction: '',
};
export default function Game() {
  const [sessionTouchSnapshot] = useState<() => boolean>(() => {
    let seen = false;
    return () => {
      seen = seen || touchSnapshot();
      // Small-screen controls remain usable even when a hybrid browser reports mouse input.
      return seen || window.matchMedia('(max-width: 900px)').matches;
    };
  });
  const hasTouch = useSyncExternalStore(
    subscribeTouch,
    sessionTouchSnapshot,
    serverTouchSnapshot,
  );
  const scene = useRef<HTMLDivElement>(null),
    engine = useRef<GameEngine | null>(null),
    joystickPointer = useRef<number | null>(null),
    lastInput = useRef<'mouse' | 'touch' | 'keyboard'>('mouse'),
    mapDialog = useRef<HTMLDialogElement>(null),
    shell = useRef<HTMLElement>(null),
    display = useRef<FullscreenSession | null>(null);
  const [displayState, setDisplayState] = useState<FullscreenState>({
    active: false,
    supported: false,
    message: '',
  });
  const [state, setState] = useState(initial),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState(''),
    [muted, setMuted] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [rtx, setRtx] = useState(false),
    [graphicsBusy, setGraphicsBusy] = useState(false),
    [graphicsError, setGraphicsError] = useState('');
  useEffect(() => {
    let dead = false;
    import('./engine')
      .then(({ GameEngine }) => {
        if (dead || !scene.current) return;
        try {
          engine.current = new GameEngine(scene.current, setState);
          setLoaded(true);
        } catch {
          setError(
            'This game needs WebGL. Enable hardware acceleration in your browser, then reload.',
          );
        }
      })
      .catch(() => {
        if (!dead)
          setError('The game could not load. Reload the page to try again.');
      });
    return () => {
      dead = true;
      engine.current?.destroy();
      engine.current = null;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !engine.current) return;
    return registerGameTools(engine.current);
  }, [loaded]);
  useEffect(() => {
    if (!shell.current) return;
    const session = new FullscreenSession(
      document,
      shell.current,
      setDisplayState,
      () => engine.current?.pause(),
    );
    display.current = session;
    return () => {
      session.destroy();
      display.current = null;
    };
  }, []);
  useEffect(() => {
    if (!loaded || !scene.current) return;
    const resize = () => engine.current?.resize();
    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(resize);
    observer?.observe(scene.current);
    return () => observer?.disconnect();
  }, [loaded]);
  const start = (action: 'resume' | 'restart' | 'next' = 'resume') => {
    const game = engine.current;
    if (!game) return;
    joystickPointer.current = null;
    // Pointer lock goes first while this explicit UI gesture is still active.
    const capture = lastInput.current !== 'touch';
    if (action === 'restart') game.restart(capture);
    else if (action === 'next') game.nextLevel(capture);
    else game.start(capture);
    void display.current?.enter(true);
  };
  const openMap = () => {
    setMapOpen(true);
    engine.current?.pause();
    mapDialog.current?.showModal();
  };
  const selectLevel = (i: number) => {
    mapDialog.current?.close();
    if (!engine.current) return;
    joystickPointer.current = null;
    engine.current.selectLevel(i, lastInput.current !== 'touch');
    void display.current?.enter(true);
  };
  const toggleSound = () => {
    setMuted(!muted);
    engine.current?.setMuted(!muted);
  };
  const toggleRtx = async (enabled: boolean) => {
    const game = engine.current;
    if (!game || graphicsBusy) return;
    setGraphicsBusy(true);
    setGraphicsError('');
    try {
      const active = await game.setRtx(enabled);
      if (engine.current === game) {
        setRtx(active);
        if (enabled && !active)
          setGraphicsError(
            'RTX is unavailable on this device. Classic graphics are still on.',
          );
      }
    } finally {
      if (engine.current === game) setGraphicsBusy(false);
    }
  };
  const fullscreen = () => {
    void display.current?.toggle();
  };
  const ready = state.status === 'ready',
    playing = state.status === 'playing',
    cleared = state.status === 'clear',
    won = state.status === 'won';
  const moveJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return;
    const r = e.currentTarget.getBoundingClientRect(),
      radius = r.width / 2;
    let x = (e.clientX - r.left - radius) / radius,
      y = (e.clientY - r.top - radius) / radius;
    const length = Math.max(1, Math.hypot(x, y));
    x /= length;
    y /= length;
    engine.current?.setTouch(x, y);
    e.currentTarget.style.setProperty('--stick-x', `${x * 27}px`);
    e.currentTarget.style.setProperty('--stick-y', `${y * 27}px`);
  };
  const releaseJoystick = (e: React.PointerEvent<HTMLDivElement>) => {
    if (joystickPointer.current !== e.pointerId) return;
    joystickPointer.current = null;
    engine.current?.setTouch(0, 0);
    e.currentTarget.style.setProperty('--stick-x', '0px');
    e.currentTarget.style.setProperty('--stick-y', '0px');
  };
  const clearedCount = state.records.filter((r) => r.cleared).length;
  return (
    <main
      ref={shell}
      onPointerDownCapture={(e) => {
        lastInput.current = e.pointerType === 'touch' ? 'touch' : 'mouse';
      }}
      onKeyDownCapture={() => {
        lastInput.current = 'keyboard';
      }}
      className={`game-shell nes-game ${hasTouch ? 'has-touch' : ''} ${ready ? 'is-home' : ''} ${playing ? 'is-playing' : ''} theme-${LEVELS[state.level].theme}`}
    >
      <div
        ref={scene}
        className="world-canvas"
        aria-label={`3D Mario game: ${state.levelName}`}
      />
      <div className="scene-shade" />
      <header className="topbar">
        <button
          className="brand"
          onClick={openMap}
          aria-label="Mario level map"
        >
          <span className="brand-mark">M</span>
          <span>
            MARIO<span className="brand-slash">/</span>
            <span className="brand-sub">FIRST PERSON</span>
          </span>
        </button>
        <div className="world-label">
          <span className="status-dot" />{' '}
          {ready ? 'THE ORIGINAL 32 COURSES' : `WORLD ${state.worldId}`}{' '}
          <span className="label-divider" />{' '}
          {ready ? 'NES · 1985' : state.areaName.toUpperCase()}
        </div>
        <div
          className="toolbar"
          role="toolbar"
          tabIndex={-1}
          aria-label="Game controls"
          onKeyDown={(e) => {
            if (e.code === 'Space' || e.code === 'Enter') e.stopPropagation();
          }}
        >
          <button
            className="icon-button map-button"
            onClick={openMap}
            aria-label="Open level map"
          >
            <Map size={18} />
          </button>
          <label
            htmlFor="rtx-switch"
            className={`graphics-control ${rtx ? 'graphics-on' : ''}`}
          >
            <span>
              RTX <small>{graphicsBusy ? '…' : rtx ? 'ON' : 'OFF'}</small>
            </span>
            <Switch
              id="rtx-switch"
              className="graphics-switch"
              checked={rtx}
              onCheckedChange={toggleRtx}
              disabled={!loaded || !!error || graphicsBusy}
              aria-label="RTX enhanced graphics"
              aria-describedby="graphics-description"
            />
          </label>
          <button
            className="icon-button"
            onClick={toggleSound}
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
          >
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>
          <button
            className="icon-button fullscreen-button"
            onClick={fullscreen}
            disabled={!displayState.supported}
            aria-label={
              displayState.active ? 'Exit fullscreen' : 'Enter fullscreen'
            }
            aria-pressed={displayState.active}
          >
            {displayState.active ? (
              <Minimize size={18} />
            ) : (
              <Maximize size={18} />
            )}
          </button>
          {playing && (
            <button
              className="icon-button"
              onClick={() => engine.current?.pause()}
              aria-label="Pause game"
            >
              <Pause size={18} />
            </button>
          )}
        </div>
      </header>
      <span className="graphics-description" id="graphics-description">
        Enhanced lighting, reflections and glow. Off by default.
      </span>
      {graphicsError && (
        <output className="graphics-error">{graphicsError}</output>
      )}
      {ready && (
        <div className="home-scroll">
          <section className="intro nes-intro">
            <div>
              <div className="eyebrow">
                <span className="little-line" /> EIGHT WORLDS. ONE ADVENTURE.
              </div>
              <h1>
                THE ORIGINAL
                <br />
                <span>SUPER MARIO.</span>
              </h1>
              <p>
                32 classic courses. A wide-open first-person adventure.
                <br />
                Clear a course to unlock the next. Your progress stays with you.
              </p>
              <div className="intro-actions">
                <button
                  className="play-button"
                  disabled={!loaded || !!error || graphicsBusy}
                  onClick={() => selectLevel(state.unlocked)}
                >
                  <span>
                    {error
                      ? 'Unable to load'
                      : !loaded
                        ? 'Loading world…'
                        : state.unlocked > 0
                          ? 'Continue adventure'
                          : 'Let’s play'}
                  </span>
                  <ArrowUpRight size={21} />
                </button>
                <span className="next-level-label">
                  NEXT UP <strong>WORLD {LEVELS[state.unlocked].id}</strong>
                </span>
              </div>
              {error && (
                <p className="load-error" role="alert">
                  {error}
                </p>
              )}
              <CreatorLinks />
              {displayState.message && (
                <output className="display-note">{displayState.message}</output>
              )}
            </div>
            <div className="campaign-summary">
              <span className="summary-icon">
                <Flag size={24} />
              </span>
              <strong>
                {String(clearedCount).padStart(2, '0')}
                <span> / 32</span>
              </strong>
              <small>COURSES CLEARED</small>
              <div className="chapter-dots">
                {WORLDS.map((w, i) => (
                  <span
                    key={w.name}
                    className={
                      state.records[i * 4 + 3]?.cleared ? 'complete' : ''
                    }
                  />
                ))}
              </div>
              <p>
                From the first Goomba
                <br />
                to Bowser’s final castle.
              </p>
            </div>
          </section>
          <div className="atlas-heading">
            <h2>Choose your course</h2>
            <span>
              <Lock size={13} /> Unlocks one level at a time
            </span>
          </div>
          <CourseAtlas
            idPrefix="home"
            state={state}
            disabled={!loaded || !!error || graphicsBusy}
            onSelect={selectLevel}
          />
          <footer className="nes-footer">
            <span>
              <kbd>W A S D</kbd> Move <kbd>SPACE</kbd> Jump <kbd>⇧</kbd> Run{' '}
              <kbd>E</kbd> Pipes <kbd>C</kbd> Crouch
            </span>
            <span>Progress saves on this device.</span>
          </footer>
        </div>
      )}
      {!ready && (
        <>
          <div className="hud">
            <div className="hud-stat">
              <span className="coin-icon" />
              <div>
                <small>COINS</small>
                <strong>
                  {String(state.coins).padStart(2, '0')}
                  <span> / {state.total}</span>
                </strong>
              </div>
            </div>
            <div className="hud-stat">
              <Heart size={20} fill="#ff655d" stroke="#ff655d" />
              <div>
                <small>LIVES</small>
                <strong>{state.lives}</strong>
              </div>
            </div>
            <div className="hud-stat">
              <div>
                <small>TIME</small>
                <strong className={state.time < 30 ? 'time-low' : ''}>
                  {Math.floor(state.time / 60)}:
                  {String(state.time % 60).padStart(2, '0')}
                </strong>
              </div>
            </div>
            <div className="hud-stat score">
              <div>
                <small>SCORE</small>
                <strong>{state.score.toLocaleString()}</strong>
              </div>
            </div>
          </div>
          <div className="adventure-hud">
            <span className={`power-pill power-${state.power}`}>
              {state.starTime > 0
                ? `★ INVINCIBLE ${state.starTime}s`
                : state.power === 'fire'
                  ? 'FIRE MARIO'
                  : state.power === 'super'
                    ? 'SUPER MARIO'
                    : 'SMALL MARIO'}
            </span>
            <span className="area-label">
              {state.underwater
                ? 'HOLD JUMP TO SWIM'
                : `WORLD ${state.worldId}`}
            </span>
            {state.checkpoint && (
              <span className="checkpoint-label">
                <Check size={12} /> CHECKPOINT
              </span>
            )}
          </div>
          {playing && (
            <>
              <div className="crosshair" />
              <div className="goal-pill">
                <Flag size={15} />
                <span>
                  {state.bossHealth !== null && state.bossHealth > 0
                    ? 'Reach the axe'
                    : state.area !== LEVELS[state.level].goalArea
                      ? 'Find the exit pipe'
                      : 'Reach the flag'}
                </span>
                <Progress
                  className="goal-track"
                  value={state.progress * 100}
                  aria-label="Progress to flag"
                />
              </div>
              {state.interaction && (
                <div className="interaction-prompt">
                  <kbd>E</kbd> {state.interaction}
                </div>
              )}
              {state.bossHealth !== null &&
                state.bossHealth > 0 &&
                state.area === LEVELS[state.level].goalArea &&
                state.progress > 0.65 && (
                  <div className="boss-hud">
                    <span>BOWSER</span>
                    <div>
                      {Array.from({ length: 5 }, (_, i) => (
                        <Heart
                          key={i}
                          size={16}
                          fill={
                            i < state.bossHealth! ? '#ff6a55' : 'transparent'
                          }
                          stroke="#ff8d78"
                        />
                      ))}
                    </div>
                    <small>Reach the axe or use fireballs</small>
                  </div>
                )}
              <div className="playing-hint">
                <kbd>SPACE</kbd> {state.underwater ? 'Swim' : 'Jump'}{' '}
                <span>·</span> <kbd>⇧</kbd> Run <span>·</span> <kbd>E</kbd>{' '}
                Pipes <span>·</span> <kbd>F</kbd> Fire <span>·</span>{' '}
                <kbd>ESC</kbd> Pause
              </div>
              <div className="touch-controls">
                <div
                  className="touch-pad"
                  onPointerDown={(e) => {
                    if (joystickPointer.current !== null) return;
                    e.preventDefault();
                    joystickPointer.current = e.pointerId;
                    e.currentTarget.setPointerCapture(e.pointerId);
                    moveJoystick(e);
                  }}
                  onPointerMove={moveJoystick}
                  onPointerUp={releaseJoystick}
                  onPointerCancel={releaseJoystick}
                  onLostPointerCapture={releaseJoystick}
                  aria-label="Movement joystick"
                >
                  <span>✣</span>
                </div>
                <div className="touch-actions nes-touch-actions">
                  <div className="touch-tools">
                    {state.interaction && (
                      <button
                        className="touch-action"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          engine.current?.interact();
                        }}
                        aria-label="Use pipe or vine"
                      >
                        ↓<span>ENTER</span>
                      </button>
                    )}
                    {state.power === 'fire' && (
                      <button
                        className="touch-action fire-action"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          engine.current?.shoot();
                        }}
                        aria-label="Throw fireball"
                      >
                        <Flame size={18} />
                        FIRE
                      </button>
                    )}
                    {
                      <button
                        className="touch-action"
                        onPointerDown={(e) => {
                          e.preventDefault();
                          e.currentTarget.setPointerCapture(e.pointerId);
                          engine.current?.keys.add('KeyC');
                        }}
                        onPointerUp={() => engine.current?.keys.delete('KeyC')}
                        onPointerCancel={() =>
                          engine.current?.keys.delete('KeyC')
                        }
                        onLostPointerCapture={() =>
                          engine.current?.keys.delete('KeyC')
                        }
                        aria-label="Hold to crouch"
                      >
                        ↓<span>CROUCH</span>
                      </button>
                    }
                  </div>
                  <div className="touch-main">
                    <button
                      className="touch-action"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        engine.current?.keys.add('ShiftLeft');
                      }}
                      onPointerUp={() =>
                        engine.current?.keys.delete('ShiftLeft')
                      }
                      onPointerCancel={() =>
                        engine.current?.keys.delete('ShiftLeft')
                      }
                      onLostPointerCapture={() =>
                        engine.current?.keys.delete('ShiftLeft')
                      }
                      aria-label="Hold to sprint"
                    >
                      <FastForward size={20} />
                      RUN
                    </button>
                    <button
                      className="touch-jump"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        engine.current?.jump();
                      }}
                      onPointerUp={() => engine.current?.releaseJump()}
                      onPointerCancel={() => engine.current?.releaseJump()}
                      onLostPointerCapture={() => engine.current?.releaseJump()}
                      onClick={(e) => {
                        if (e.detail === 0) engine.current?.jump();
                      }}
                      aria-label="Jump"
                    >
                      <MoveUp size={24} />
                      {state.underwater ? 'SWIM' : 'JUMP'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
          {playing && state.notice && (
            <output className="game-notice">{state.notice}</output>
          )}
          {!playing && (
            <div className="state-overlay">
              <section className="state-card" aria-label="Game menu">
                <div className="state-icon">
                  {won || cleared ? (
                    <Trophy size={32} />
                  ) : state.status === 'paused' ? (
                    <Pause size={30} />
                  ) : (
                    <Heart size={30} />
                  )}
                </div>
                <div className="eyebrow">WORLD {state.worldId}</div>
                <h2>
                  {won
                    ? 'The kingdom is saved!'
                    : cleared
                      ? 'Course clear!'
                      : state.status === 'paused'
                        ? 'Take a breather.'
                        : 'One more try?'}
                </h2>
                <p>
                  {won
                    ? 'You reached the end of World 8–4. Every course is now open to replay.'
                    : cleared
                      ? `World ${LEVELS[state.level + 1].id} is now unlocked. ${state.coins} coins collected.`
                      : state.status === 'paused'
                        ? LEVELS[state.level].hint
                        : 'Your completed courses are safe. Try this course again.'}
                </p>
                {state.notice.startsWith('Graphics were') && (
                  <p role="alert">{state.notice}</p>
                )}
                <button
                  className="play-button"
                  disabled={graphicsBusy}
                  onClick={() =>
                    state.status === 'paused'
                      ? start()
                      : cleared
                        ? start('next')
                        : won
                          ? openMap()
                          : start('restart')
                  }
                >
                  <span>
                    {state.status === 'paused'
                      ? 'Keep playing'
                      : cleared
                        ? `Play World ${LEVELS[state.level + 1].id}`
                        : won
                          ? 'Choose a course'
                          : 'Try again'}
                  </span>
                  <ArrowRight size={19} />
                </button>
                {state.status === 'paused' && (
                  <button
                    className="text-button"
                    disabled={graphicsBusy}
                    onClick={() => start('restart')}
                  >
                    Restart course
                  </button>
                )}
                <button className="text-button" onClick={openMap}>
                  Level map
                </button>
                <CreatorLinks />
                {displayState.message && (
                  <output className="display-note">
                    {displayState.message}
                  </output>
                )}
              </section>
            </div>
          )}
        </>
      )}
      <dialog
        ref={mapDialog}
        onClose={() => setMapOpen(false)}
        className="map-dialog nes-map-dialog"
        aria-labelledby="map-title"
      >
        <div className="map-heading">
          <div>
            <div className="eyebrow">THE ORIGINAL ADVENTURE</div>
            <h2 id="map-title">All 32 courses</h2>
            <p>{clearedCount} cleared · Beat each course to unlock the next.</p>
          </div>
          <button
            className="icon-button"
            autoFocus
            onClick={() => mapDialog.current?.close()}
            aria-label="Close level map"
          >
            <X size={21} />
          </button>
        </div>
        {mapOpen && (
          <CourseAtlas
            idPrefix="map"
            state={state}
            disabled={!loaded || !!error || graphicsBusy}
            onSelect={selectLevel}
          />
        )}
      </dialog>
    </main>
  );
}
