'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  ArrowRight,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Pause,
  RotateCcw,
  Flag,
  Mouse,
  MoveUp,
  Heart,
  Trophy,
  Play,
  Map,
  X,
  Lock,
  Star,
  Flame,
  Check,
  FastForward,
} from 'lucide-react';
import type { GameEngine, Snapshot } from './engine';
import { LEVELS, WORLDS } from './levels';
import { countStars } from './progress';
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
const initial: Snapshot = {
  status: 'ready',
  coins: 0,
  total: 0,
  lives: 3,
  time: 210,
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
};
export default function Game() {
  const scene = useRef<HTMLDivElement>(null),
    engine = useRef<GameEngine | null>(null),
    joystickPointer = useRef<number | null>(null),
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
  const [mapWorld, setMapWorld] = useState(0);
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
    if (action === 'restart') game.restart();
    else if (action === 'next') game.nextLevel();
    else game.start();
    void display.current?.enter(true);
  };
  const openMap = () => {
    setMapWorld(Math.floor(state.level / 4));
    engine.current?.pause();
    mapDialog.current?.showModal();
  };
  const selectLevel = (i: number) => {
    mapDialog.current?.close();
    if (!engine.current) return;
    joystickPointer.current = null;
    engine.current.selectLevel(i);
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
  const savedStars = state.records.reduce((n, r) => n + countStars(r.stars), 0);
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
  return (
    <main
      ref={shell}
      className={`game-shell ${playing ? 'is-playing' : ''} theme-${LEVELS[state.level].theme}`}
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
          <span className="status-dot" /> WORLD {state.worldId}{' '}
          <span className="label-divider" /> {state.levelName.toUpperCase()}
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
            title="Level map"
          >
            <Map size={18} />
          </button>
          <label
            htmlFor="rtx-switch"
            className={`graphics-control ${rtx ? 'graphics-on' : ''}`}
            title="Enhanced lighting, reflections and glow. More demanding on your device."
          >
            <span>
              RTX{' '}
              <small aria-hidden="true">
                {graphicsBusy ? '…' : rtx ? 'ON' : 'OFF'}
              </small>
            </span>
            <Switch
              id="rtx-switch"
              className="graphics-switch"
              checked={rtx}
              onCheckedChange={toggleRtx}
              disabled={!loaded || !!error || graphicsBusy}
              aria-label="RTX enhanced graphics"
              aria-describedby="graphics-description"
              aria-busy={graphicsBusy}
              onKeyDown={(e) => {
                if (e.code === 'Space' || e.code === 'Enter')
                  e.stopPropagation();
              }}
            />
          </label>
          <button
            className="icon-button"
            onClick={toggleSound}
            aria-label={muted ? 'Turn sound on' : 'Mute sound'}
            title={muted ? 'Sound off' : 'Sound on'}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <button
            className="icon-button fullscreen-button"
            onClick={fullscreen}
            disabled={!displayState.supported}
            aria-label={
              displayState.active ? 'Exit fullscreen' : 'Enter fullscreen'
            }
            aria-pressed={displayState.active}
            title={
              displayState.supported
                ? displayState.active
                  ? 'Exit fullscreen'
                  : 'Enter fullscreen'
                : 'Fullscreen unavailable in this browser'
            }
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
      <span id="graphics-description" className="graphics-description">
        Enhanced lighting, reflections and glow; not hardware ray tracing. Off
        by default. Pause to change graphics while using mouse look.
      </span>
      {graphicsError && (
        <output className="graphics-error">{graphicsError}</output>
      )}
      {ready && (
        <>
          <div className="level-stamp">
            <span>24</span>
            <div>
              COURSES · SIX WORLDS
              <small>From the meadows to Bowser’s castle.</small>
            </div>
          </div>
          <section className="intro">
            <div className="eyebrow">
              <span className="little-line" /> THE KINGDOM IS CALLING
            </div>
            <h1>
              SUPER
              <br />
              <span>MARIO</span>
              <span className="title-dot">.</span>
            </h1>
            <div className="perspective-label">A FIRST-PERSON ADVENTURE</div>
            <p>
              Six worlds. Seventy-two star coins. One red cap.
              <br className="desktop-break" /> Jump, stomp, and find your way to
              Bowser’s castle.
            </p>
            <div className="intro-actions">
              <button
                className="play-button"
                onClick={() =>
                  state.unlocked > 0 ? selectLevel(state.unlocked) : start()
                }
                disabled={!loaded || !!error || graphicsBusy}
              >
                <span>
                  {error
                    ? 'Unable to load'
                    : loaded
                      ? state.unlocked > 0
                        ? 'Continue adventure'
                        : 'Let’s play'
                      : 'Loading world…'}
                </span>
                <ArrowUpRight size={24} />
              </button>
              <button
                className="secondary-button"
                onClick={openMap}
                disabled={!loaded || !!error || graphicsBusy}
              >
                <Map size={17} /> Level map
              </button>
            </div>
            {error && (
              <p className="load-error" role="alert">
                {error}
              </p>
            )}
            <div className="play-meta">
              <span className="status-dot" /> 24 FULL COURSES <span>•</span>{' '}
              SAVED PROGRESS <span>•</span> 72 STAR COINS
            </div>
            <CreatorLinks />
            {displayState.message && (
              <output className="display-note">{displayState.message}</output>
            )}
          </section>
          <aside className="mission-card">
            <div className="mission-icon">
              <Flag size={23} />
            </div>
            <span>THE ADVENTURE</span>
            <h2>A kingdom worth saving.</h2>
            <p>
              Cross floating islands. Brave the Pipeworks. Take on Bowser.
              There’s a world beyond every flag.
            </p>
            <div className="mission-line">
              <span>{savedStars} / 72 STAR COINS</span>
              <Star size={17} />
            </div>
            <div
              className="chapter-dots"
              aria-label={`${state.records.filter((r) => r.cleared).length} of 24 courses cleared`}
            >
              {WORLDS.map((w, i) => (
                <span
                  key={w.name}
                  className={
                    state.records[i * 4 + 3]?.cleared ? 'complete' : ''
                  }
                />
              ))}
            </div>
          </aside>
          <footer className="start-footer">
            <div className="control-item">
              <div className="key-group">
                <kbd>W</kbd>
                <kbd>A</kbd>
                <kbd>S</kbd>
                <kbd>D</kbd>
              </div>
              <span>Move</span>
            </div>
            <div className="control-item">
              <Mouse size={20} />
              <span>Look around</span>
            </div>
            <div className="control-item">
              <kbd className="space-key">SPACE</kbd>
              <span>Hold to jump higher</span>
            </div>
            <div className="control-item">
              <kbd>⇧</kbd>
              <span>Sprint</span>
            </div>
            <div className="footer-note">
              <kbd>F</kbd> FIRE FLOWER <span>↗</span>
            </div>
          </footer>
        </>
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
            <div className="hud-stat lives">
              <Heart size={21} fill="#ff655d" stroke="#ff655d" />
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
                <strong>{String(state.score).padStart(6, '0')}</strong>
              </div>
            </div>
          </div>
          <div className="adventure-hud">
            <div
              className="star-slots"
              aria-label={`${countStars(state.stars)} of 3 star coins collected`}
            >
              {[0, 1, 2].map((i) => (
                <Star
                  key={i}
                  size={21}
                  className={state.stars & (1 << i) ? 'collected' : ''}
                />
              ))}
            </div>
            <span className={`power-pill power-${state.power}`}>
              {state.starTime > 0
                ? `★ INVINCIBLE ${state.starTime}s`
                : state.power === 'fire'
                  ? '✹ FIRE MARIO'
                  : state.power === 'super'
                    ? '● SUPER MARIO'
                    : 'SMALL MARIO'}
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
                <Flag size={16} />
                <span>
                  {state.bossHealth !== null && state.bossHealth > 0
                    ? 'Defeat Bowser'
                    : 'Reach the flag'}
                </span>
                <Progress
                  className="goal-track"
                  value={Math.round(state.progress * 100)}
                  aria-label="Progress to flag"
                />
              </div>
              {state.bossHealth !== null &&
                state.bossHealth > 0 &&
                state.progress > 0.95 && (
                  <div className="boss-hud">
                    <span>BOWSER</span>
                    <div>
                      {[0, 1, 2].map((i) => (
                        <Heart
                          key={i}
                          size={19}
                          fill={
                            i < state.bossHealth! ? '#ff6a55' : 'transparent'
                          }
                          stroke={
                            i < state.bossHealth! ? '#ff6a55' : '#ffffff55'
                          }
                        />
                      ))}
                    </div>
                    <small>Stomp his head or throw fireballs</small>
                  </div>
                )}
              <div className="playing-hint">
                <kbd>SPACE</kbd> Hold to jump higher <span>·</span> <kbd>⇧</kbd>{' '}
                Sprint <span>·</span> <kbd>F</kbd> Fire <span>·</span>{' '}
                <kbd>ESC</kbd> Pause
              </div>
              <div className="touch-controls">
                <div
                  className="touch-pad"
                  onPointerDown={(e) => {
                    if (joystickPointer.current !== null) return;
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
                <div className="touch-actions">
                  {state.power === 'fire' && (
                    <button
                      className="touch-action fire-action"
                      onPointerDown={(e) => {
                        e.preventDefault();
                        engine.current?.shoot();
                      }}
                      aria-label="Throw fireball"
                    >
                      <Flame size={20} />
                      FIRE
                    </button>
                  )}
                  <button
                    className="touch-action"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      engine.current?.keys.add('ShiftLeft');
                    }}
                    onPointerUp={() => engine.current?.keys.delete('ShiftLeft')}
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
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      engine.current?.jump();
                    }}
                    onPointerUp={() => engine.current?.releaseJump()}
                    onPointerCancel={() => engine.current?.releaseJump()}
                    onClick={(e) => {
                      if (e.detail === 0) engine.current?.jump();
                    }}
                    className="touch-jump"
                    aria-label="Jump"
                  >
                    <MoveUp size={24} />
                    JUMP
                  </button>
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
                    <Trophy size={34} />
                  ) : state.status === 'paused' ? (
                    <Pause size={32} />
                  ) : (
                    <Heart size={32} />
                  )}
                </div>
                <div className="eyebrow">
                  WORLD {state.worldId} · {state.levelName.toUpperCase()}
                </div>
                <h2>
                  {won
                    ? 'Kingdom saved!'
                    : cleared
                      ? 'Course clear!'
                      : state.status === 'paused'
                        ? 'Take a breather.'
                        : 'One more try?'}
                </h2>
                <p>
                  {won
                    ? 'Bowser is defeated. The Mushroom Kingdom is yours to explore.'
                    : cleared
                      ? `${state.coins} coins · ${countStars(state.stars)} star coins · 1 bonus life`
                      : state.status === 'paused'
                        ? LEVELS[state.level].hint
                        : 'Your unlocked courses and star coins are safe. Try this course again.'}
                </p>
                {state.notice.startsWith('Graphics were') && (
                  <p role="alert">{state.notice}</p>
                )}
                {state.status === 'paused' && (
                  <div className="course-objectives">
                    <span>
                      EXPLORER · {countStars(state.stars)} / 3 star coins
                    </span>
                    <span>
                      COIN MEDAL · {state.coins} /{' '}
                      {Math.ceil(state.total * 0.8)} coins
                    </span>
                    <span>
                      TIME MEDAL · clear in{' '}
                      {Math.floor((LEVELS[state.level].par ?? 300) / 60)}:
                      {String((LEVELS[state.level].par ?? 300) % 60).padStart(
                        2,
                        '0',
                      )}
                    </span>
                    <span>NO-HIT MEDAL · clear without damage</span>
                  </div>
                )}
                {(won || cleared) && (
                  <div className="clear-stats">
                    <div>
                      <strong>{state.score.toLocaleString()}</strong>
                      <span>ADVENTURE SCORE</span>
                    </div>
                    <div>
                      <strong>{savedStars} / 72</strong>
                      <span>STAR COINS SAVED</span>
                    </div>
                  </div>
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
                        ? `Next: ${LEVELS[state.level + 1].name}`
                        : won
                          ? 'Explore the kingdom'
                          : 'Try again'}
                  </span>
                  {state.status === 'paused' ? (
                    <Play size={20} />
                  ) : cleared || won ? (
                    <ArrowRight size={20} />
                  ) : (
                    <RotateCcw size={20} />
                  )}
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
                {!won && (
                  <button className="text-button" onClick={openMap}>
                    Level map
                  </button>
                )}
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
        className="map-dialog"
        aria-labelledby="map-title"
      >
        <div className="map-heading">
          <div>
            <div className="eyebrow">YOUR ADVENTURE</div>
            <h2 id="map-title">The Mushroom Kingdom</h2>
            <p>Clear a course to open the next. Find every star coin.</p>
          </div>
          <button
            className="icon-button"
            autoFocus
            onClick={() => mapDialog.current?.close()}
            aria-label="Close level map"
          >
            <X size={22} />
          </button>
        </div>
        <nav className="world-tabs" aria-label="Choose a world">
          {WORLDS.map((world, i) => (
            <button
              key={world.name}
              className={mapWorld === i ? 'selected' : ''}
              aria-pressed={mapWorld === i}
              onClick={() => setMapWorld(i)}
            >
              <span>{String(i + 1).padStart(2, '0')}</span>
              {world.name}
            </button>
          ))}
        </nav>
        <div className="map-world-heading">
          <span>{WORLDS[mapWorld].description}</span>
          <span>
            {
              state.records
                .slice(mapWorld * 4, mapWorld * 4 + 4)
                .filter((r) => r.cleared).length
            }{' '}
            / 4 CLEARED
          </span>
        </div>
        <div className="level-grid">
          {LEVELS.map((level, i) => {
            if (Math.floor(i / 4) !== mapWorld) return null;
            const record = state.records[i],
              locked = i > state.unlocked;
            return (
              <button
                key={level.id}
                className={`level-card level-${level.theme} ${locked ? 'locked' : ''}`}
                disabled={locked || !loaded || !!error || graphicsBusy}
                onClick={() => selectLevel(i)}
                aria-label={`${locked ? 'Locked: ' : ''}World ${level.id}, ${level.name}${record?.cleared ? ', cleared' : ''}`}
              >
                <div className="level-art" aria-hidden="true">
                  <span className="art-hill hill-one" />
                  <span className="art-hill hill-two" />
                  <span className="art-pipe" />
                  <span className="art-block">
                    {level.theme === 'castle' ? 'M' : '?'}
                  </span>
                  <span className="art-floor" />
                  {locked ? (
                    <Lock size={25} />
                  ) : record?.cleared ? (
                    <Check size={25} />
                  ) : (
                    <Flag size={25} />
                  )}
                </div>
                <div className="level-card-body">
                  <small>
                    WORLD {level.id}{' '}
                    <span>
                      {locked
                        ? 'LOCKED'
                        : record?.cleared
                          ? 'CLEARED'
                          : 'READY'}
                    </span>
                  </small>
                  <h3>{level.name}</h3>
                  <p>
                    Eight stages · Four checkpoints
                    <br />
                    Time medal: {Math.floor((level.par ?? 300) / 60)}:
                    {String((level.par ?? 300) % 60).padStart(2, '0')}
                  </p>
                  <div className="level-card-bottom">
                    <span className="star-slots">
                      {[0, 1, 2].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          className={
                            (record?.stars || 0) & (1 << star)
                              ? 'collected'
                              : ''
                          }
                        />
                      ))}
                    </span>
                    <span>
                      {record?.score
                        ? `${record.score.toLocaleString()} BEST`
                        : 'LET’S-A GO'}{' '}
                      <ArrowRight size={14} />
                    </span>
                  </div>
                  <div className="medal-row" aria-label="Course medals">
                    <span
                      className={record?.coinMedal ? 'earned' : ''}
                      title="Collect 80% of the course coins"
                    >
                      ● COINS
                    </span>
                    <span
                      className={record?.speedMedal ? 'earned' : ''}
                      title="Beat the course target time"
                    >
                      ◷ TIME
                    </span>
                    <span
                      className={record?.cleanMedal ? 'earned' : ''}
                      title="Clear without taking damage"
                    >
                      ♥ NO HIT
                    </span>
                  </div>
                  {record?.bestTime > 0 && (
                    <div className="personal-best">
                      BEST TIME {Math.floor(record.bestTime / 60)}:
                      {String(record.bestTime % 60).padStart(2, '0')}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        <div className="map-footer">
          <span>
            <Star size={16} /> {savedStars} / 72 star coins
          </span>
          <span>Progress saves on this device when you clear a course.</span>
        </div>
      </dialog>
    </main>
  );
}
