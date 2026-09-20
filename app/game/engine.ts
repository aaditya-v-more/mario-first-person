import { moveGroundEnemy } from './enemy-motion';
import * as THREE from 'three';
import { makeWorld, type World, type Enemy } from './world';
import {
  newPlayer,
  stepPlayer,
  overlapXZ,
  JUMP_SPEED,
  HEIGHT,
  SMALL_HEIGHT,
  playerHeight,
  RADIUS,
  type Box,
  type Player,
} from './physics';
import { LEVELS, PALETTES, AREA_SPACING } from './levels';
import type { Portal, Point } from './level-types';
import {
  readProgress,
  saveProgress,
  type ProgressSave,
  type RecordEntry,
} from './progress';
import { createBrowserRuntime } from './browser-runtime';
import type { GameRuntime } from './runtime';
import type { RtxGraphics } from './rtx';
export type GameState =
  | 'ready'
  | 'playing'
  | 'paused'
  | 'clear'
  | 'won'
  | 'over';
export type Snapshot = {
  status: GameState;
  coins: number;
  total: number;
  lives: number;
  time: number;
  score: number;
  progress: number;
  notice: string;
  level: number;
  levelName: string;
  worldId: string;
  stars: number;
  power: 'small' | 'super' | 'fire';
  starTime: number;
  checkpoint: boolean;
  bossHealth: number | null;
  unlocked: number;
  records: RecordEntry[];
  campaignCoins: number;
  area: number;
  areaName: string;
  underwater: boolean;
  interaction: string;
};
export const initialSnapshot = (): Snapshot => ({
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
});
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number };
type Projectile = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  hostile: boolean;
  kind: 'fire' | 'hammer' | 'bullet';
};
export class GameEngine {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(68, 1, 0.05, 260);
  world: World;
  sun: THREE.DirectionalLight;
  hemisphere: THREE.HemisphereLight;
  rtx: RtxGraphics | null = null;
  private graphicsRequest = 0;
  private rtxWanted = false;
  player: Player = { ...newPlayer(), ...LEVELS[0].spawn, height: HEIGHT };
  audio: GameRuntime['audio'];
  state: Snapshot = initialSnapshot();
  save: ProgressSave = readProgress();
  running = true;
  elapsed = 0;
  levelElapsed = 0;
  lastFrame = 0;
  accumulator = 0;
  emitTime = 0;
  remaining = LEVELS[0].time;
  yaw = 0;
  pitch = 0;
  keys = new Set<string>();
  touch = { x: 0, y: 0 };
  drag: { id: number; x: number; y: number } | null = null;
  jumpBuffer = 0;
  coyote = 0.1;
  invulnerable = 0;
  noticeTimer = 0;
  checkpoint = false;
  pointerLocked = false;
  pointerCapture: Promise<boolean> = Promise.resolve(false);
  private finishCapture?: (active: boolean) => void;
  private captureTimer?: ReturnType<typeof setTimeout>;
  shootCooldown = 0;
  starTime = 0;
  levelStartScore = 0;
  levelStartCoins = 0;
  checkpointIndex = -1;
  damageCount = 0;
  courseTime = 0;
  area = 0;
  jumpHeld = false;
  portalCooldown = 0;
  mazePassed = new Set<string>();
  cannonClocks: number[] = [];
  bridgeDown = false;
  particles: Particle[] = [];
  projectiles: Projectile[] = [];
  spentBlockMaterial = new THREE.MeshStandardMaterial({
    color: '#bba079',
    roughness: 0.9,
  });
  hands = new THREE.Group();
  leftHand = new THREE.Group();
  rightHand = new THREE.Group();
  shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.33, 24),
    new THREE.MeshBasicMaterial({
      color: '#15252e',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    }),
  );
  reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  constructor(
    public container: HTMLElement,
    public onChange: (s: Snapshot) => void,
    public runtime: GameRuntime = createBrowserRuntime(),
  ) {
    this.audio = runtime.audio;
    this.spentBlockMaterial.userData.managedExternally = true;
    this.renderer = new THREE.WebGLRenderer({
      canvas: runtime.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(runtime.pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.domElement.setAttribute(
      'aria-label',
      'Game view. WASD to move, mouse or arrow keys to look, Space to jump, Shift to run, F to throw fireballs.',
    );
    if (!runtime.canvas) container.appendChild(this.renderer.domElement);
    this.hemisphere = new THREE.HemisphereLight('#e8faff', '#658342', 1.85);
    this.scene.add(this.hemisphere);
    this.sun = new THREE.DirectionalLight('#fff2cc', 3.1);
    this.sun.position.set(-20, 35, 18);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, {
      left: -28,
      right: 28,
      top: 32,
      bottom: -32,
      far: 110,
    });
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun, this.sun.target);
    this.world = makeWorld(
      this.scene,
      () => runtime.createTextureCanvas(),
      LEVELS[0],
    );
    this.applyTheme();
    this.updateLevelState();
    this.makeHands();
    this.scene.add(this.camera);
    this.camera.add(this.hands);
    this.hands.visible = false;
    this.shadow.rotation.x = -Math.PI / 2;
    this.scene.add(this.shadow);
    this.resize();
    this.bind();
    this.emit();
    this.runtime.startFrames(this.loop);
  }
  applyTheme() {
    const active = this.world.level.areas[this.area];
    this.audio.setTheme?.(active.theme);
    const c = PALETTES[active.theme];
    this.world.setArea(this.area);
    this.scene.background = new THREE.Color(c.sky);
    this.scene.fog = new THREE.Fog(c.fog, 40, 165);
    this.renderer.setClearColor(c.sky);
    this.hemisphere.color.set(c.ambient);
    this.hemisphere.groundColor.set(c.ground);
    this.sun.color.set(c.sun);
  }
  updateLevelState() {
    const l = this.world.level;
    Object.assign(this.state, {
      total:
        this.world.coins.filter((c) => c.star === undefined).length +
        this.world.questions
          .filter((q) => q.reward === 'coin')
          .reduce((n, q) => n + q.remaining, 0),
      levelName: l.name,
      worldId: l.id,
      unlocked: this.save.unlocked,
      records: this.save.records.map((r) => ({ ...r })),
      bossHealth: this.world.boss?.health ?? null,
    });
  }
  makeHands() {
    const sleeve = new THREE.MeshStandardMaterial({
        color: '#ed4436',
        roughness: 0.8,
      }),
      glove = new THREE.MeshStandardMaterial({
        color: '#fffbea',
        roughness: 0.65,
      });
    for (const [g, side] of [
      [this.leftHand, -1],
      [this.rightHand, 1],
    ] as const) {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.075, 0.12, 0.48, 12),
        sleeve,
      );
      arm.rotation.x = -0.6;
      arm.position.set(0, -0.13, 0.12);
      g.add(arm);
      const palm = new THREE.Mesh(
        new THREE.SphereGeometry(0.115, 14, 10),
        glove,
      );
      palm.scale.set(1, 1.08, 1.15);
      g.add(palm);
      const thumb = new THREE.Mesh(
        new THREE.SphereGeometry(0.065, 10, 8),
        glove,
      );
      thumb.position.set(-side * 0.08, 0, -0.04);
      g.add(thumb);
      g.position.set(side * 0.31, -0.32, -0.54);
      g.rotation.z = -side * 0.18;
      this.hands.add(g);
    }
  }
  bind() {
    const listen = (target: EventTarget, name: string, handler: unknown) =>
      this.runtime.listen(target, name, handler as EventListener);
    listen(window, 'resize', this.resize);
    listen(document, 'keydown', this.keyDown);
    listen(document, 'keyup', this.keyUp);
    listen(document, 'mousemove', this.mouseMove);
    listen(document, 'pointerlockchange', this.lockChange);
    listen(document, 'pointerlockerror', this.pointerError);
    listen(window, 'blur', this.onBlur);
    listen(document, 'visibilitychange', this.onVisibility);
    const c = this.renderer.domElement;
    listen(c, 'pointerdown', this.pointerDown);
    listen(c, 'pointermove', this.pointerMove);
    listen(c, 'pointerup', this.pointerUp);
    listen(c, 'pointercancel', this.pointerUp);
    listen(c, 'lostpointercapture', this.pointerUp);
    listen(c, 'webglcontextlost', this.contextLost);
  }
  resize = () => {
    const w = Math.max(1, this.container.clientWidth),
      h = Math.max(1, this.container.clientHeight);
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.rtx?.resize(w, h);
  };
  async setRtx(enabled: boolean): Promise<boolean> {
    this.rtxWanted = enabled;
    const request = ++this.graphicsRequest;
    if (!enabled) {
      this.rtx?.dispose();
      this.rtx = null;
      return false;
    }
    if (this.rtx) return true;
    try {
      const { RtxGraphics } = await this.runtime.loadGraphics();
      if (!this.running || request !== this.graphicsRequest) return false;
      const graphics = new RtxGraphics(
        this.renderer,
        this.scene,
        this.camera,
        this.sun,
        this.hemisphere,
      );
      graphics.enable(this.container.clientWidth, this.container.clientHeight);
      this.rtx = graphics;
      this.lastFrame = performance.now();
      return true;
    } catch {
      if (this.running && request === this.graphicsRequest) {
        this.rtxWanted = false;
        this.notify(
          'RTX is unavailable on this device. Classic graphics are still on.',
          5,
        );
      }
      return false;
    }
  }
  emit() {
    const l = this.world.level,
      area = l.areas[this.area];
    this.state.time = Math.ceil(this.remaining);
    if (this.area === l.mainArea)
      this.state.progress = Math.max(
        this.state.progress,
        THREE.MathUtils.clamp((13 - this.player.z) / area.length, 0, 0.98),
      );
    if (this.area === l.goalArea && this.area !== l.mainArea)
      this.state.progress = Math.max(this.state.progress, 0.92);
    this.state.checkpoint = this.checkpoint;
    this.state.starTime = Math.ceil(this.starTime);
    this.state.bossHealth = this.world.boss?.health ?? null;
    this.state.area = this.area;
    this.state.areaName = area.name;
    this.state.underwater = area.underwater;
    this.state.interaction = this.nearPortal()?.label ?? '';
    this.onChange({ ...this.state });
  }
  nearPortal(): Portal | undefined {
    if (this.portalCooldown > 0) return;
    return this.world.level.portals.find(
      (portal) =>
        portal.area === this.area &&
        (!portal.requiresBlock ||
          this.world.vines.get(portal.requiresBlock)?.visible) &&
        Math.hypot(this.player.x - portal.x, this.player.z - portal.z) <
          portal.radius &&
        Math.abs(this.player.y - portal.y) <
          (portal.mode === 'vine' ? 3 : portal.mode === 'walk' ? 2.2 : 1.15),
    );
  }
  enterArea(id: number, position: Point) {
    const enhance = this.rtxWanted;
    this.graphicsRequest++;
    this.rtx?.dispose();
    this.rtx = null;
    this.area = id;
    this.player = {
      ...newPlayer(),
      ...position,
      height: HEIGHT,
    };
    this.yaw = 0;
    this.pitch = 0;
    this.clearInput();
    this.clearProjectiles();
    this.portalCooldown = 1;
    this.coyote = 0;
    this.invulnerable = Math.max(1.5, this.invulnerable);
    this.applyTheme();
    this.emit();
    if (enhance) void this.setRtx(true);
  }
  interact() {
    if (this.state.status !== 'playing') return;
    const portal = this.nearPortal();
    if (!portal) return;
    if (portal.warpLevel !== undefined) {
      if (portal.warpLevel < 0 || portal.warpLevel > this.save.unlocked) {
        this.notify(
          'That world is locked. Clear each course in order to unlock it.',
          3,
        );
        return;
      }
      this.selectLevel(portal.warpLevel, false);
      return;
    }
    this.enterArea(portal.targetArea, portal.target);
    this.audio.tone(220, 0.3, 'triangle', 0.07);
    this.notify(
      this.world.level.areas[this.area].underwater
        ? 'Underwater! Hold Jump to swim up.'
        : portal.mode === 'vine'
          ? 'Above the clouds! Follow the bonus route.'
          : 'Through the pipe!',
      2,
    );
  }
  updateHeight() {
    const p = this.player,
      desired = this.keys.has('KeyC') ? SMALL_HEIGHT : HEIGHT;
    const blocked = this.world.boxes.some(
      (b) =>
        b.active !== false &&
        !b.hidden &&
        overlapXZ(p, b) &&
        b.y - b.h / 2 > p.y + 0.1 &&
        b.y - b.h / 2 < p.y + desired - 0.01,
    );
    p.height = blocked ? SMALL_HEIGHT : desired;
  }
  notify(text: string, duration = 2.5) {
    this.state.notice = text;
    this.noticeTimer = duration;
    this.emit();
  }
  clearInput() {
    this.keys.clear();
    this.jumpHeld = false;
    this.touch = { x: 0, y: 0 };
    this.jumpBuffer = 0;
    this.drag = null;
  }
  releasePointer() {
    if (document.pointerLockElement === this.renderer.domElement)
      document.exitPointerLock();
  }
  start(requestLock = true) {
    if (!['ready', 'paused'].includes(this.state.status)) return;
    const first = this.state.status === 'ready';
    this.state.status = 'playing';
    this.clearInput();
    this.accumulator = 0;
    this.lastFrame = performance.now();
    (document.activeElement as HTMLElement | null)?.blur?.();
    void this.audio.activate();
    this.emit();
    if (first) this.notify(this.world.level.hint, 6);
    if (requestLock) void this.captureMouse();
  }
  captureMouse(): Promise<boolean> {
    if (this.state.status !== 'playing') return Promise.resolve(false);
    if (document.pointerLockElement === this.renderer.domElement)
      return Promise.resolve(true);
    if (this.finishCapture) return this.pointerCapture;
    let finish!: (active: boolean) => void;
    this.pointerCapture = new Promise<boolean>((resolve) => {
      finish = (active) => {
        if (this.captureTimer !== undefined) clearTimeout(this.captureTimer);
        this.captureTimer = undefined;
        this.finishCapture = undefined;
        if (active && this.state.status !== 'playing') {
          this.releasePointer();
          active = false;
        }
        resolve(active);
        if (!active && this.running && this.state.status === 'playing')
          this.notify(
            'Click the game to capture the mouse. Escape releases it.',
            4,
          );
      };
    });
    this.finishCapture = finish;
    try {
      if (typeof this.renderer.domElement.requestPointerLock !== 'function') {
        finish(false);
        return this.pointerCapture;
      }
      // Focus the game surface within the same user gesture as native capture.
      this.renderer.domElement.tabIndex = 0;
      this.renderer.domElement.focus?.({ preventScroll: true });
      // Keep this native request synchronous with Start/Resume, before fullscreen.
      const result = this.renderer.domElement.requestPointerLock();
      if (this.finishCapture === finish) this.captureTimer = setTimeout(() => {
        if (this.finishCapture === finish)
          finish(document.pointerLockElement === this.renderer.domElement);
      }, 2500);
      if (result && typeof result.then === 'function')
        void result
          .then(() => {
            if (this.finishCapture === finish)
              finish(document.pointerLockElement === this.renderer.domElement);
          })
          .catch(() => {
            if (this.finishCapture === finish) finish(false);
          });
    } catch {
      finish(false);
    }
    return this.pointerCapture;
  }
  pointerError = () => {
    this.finishCapture?.(false);
  };

  pause() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'paused';
    this.renderer.domElement.blur?.();
    this.clearInput();
    this.accumulator = 0;
    this.releasePointer();
    this.emit();
  }
  loadLevel(index: number) {
    const enhance = this.rtxWanted;
    this.graphicsRequest++;
    this.rtx?.dispose();
    this.rtx = null;
    this.clearParticles();
    this.clearProjectiles();
    this.world.dispose();
    this.world = makeWorld(
      this.scene,
      () => this.runtime.createTextureCanvas(),
      LEVELS[index],
    );
    this.area = this.world.level.startArea;
    this.mazePassed.clear();
    this.portalCooldown = 0;
    this.bridgeDown = false;
    this.cannonClocks = this.world.level.cannons.map((_, i) => i * 0.2);
    this.applyTheme();
    this.player = {
      ...newPlayer(),
      ...this.world.level.spawn,
      height: HEIGHT,
    };
    this.camera?.position.set(
      this.player.x,
      this.player.y + playerHeight(this.player) - 0.12,
      this.player.z,
    );
    this.sun.position.set(this.player.x - 20, 35, this.player.z + 18);
    this.sun.target.position.set(this.player.x, 0, this.player.z - 5);
    this.yaw = 0;
    this.pitch = 0;
    this.remaining = this.world.level.time;
    this.levelElapsed = 0;
    this.courseTime = 0;
    this.damageCount = 0;
    this.checkpointIndex = -1;
    this.accumulator = 0;
    this.lastFrame = performance.now();
    this.checkpoint = false;
    this.invulnerable = 0;
    this.jumpBuffer = 0;
    this.coyote = 0;
    this.starTime = 0;
    this.shootCooldown = 0;
    this.noticeTimer = 0;
    this.clearInput();
    Object.assign(this.state, {
      status: 'ready',
      level: index,
      coins: 0,
      stars: 0,
      progress: 0,
      notice: '',
      checkpoint: false,
      starTime: 0,
    });
    this.updateLevelState();
    this.audio.noteIndex = 0;
    this.emit();
    if (enhance) void this.setRtx(true);
  }
  selectLevel(index: number, requestLock = true) {
    if (
      !Number.isInteger(index) ||
      index < 0 ||
      index > this.save.unlocked ||
      index >= LEVELS.length
    )
      return;
    this.state = initialSnapshot();
    this.levelStartScore = 0;
    this.levelStartCoins = 0;
    this.loadLevel(index);
    this.start(requestLock);
  }
  restart(requestLock = true) {
    this.state.score = this.levelStartScore;
    this.state.campaignCoins = this.levelStartCoins;
    this.state.lives = 3;
    this.state.power = 'small';
    this.loadLevel(this.state.level);
    this.start(requestLock);
  }
  nextLevel(requestLock = true) {
    if (this.state.status !== 'clear') return;
    this.levelStartScore = this.state.score;
    this.levelStartCoins = this.state.campaignCoins;
    this.loadLevel(this.state.level + 1);
    this.start(requestLock);
  }
  goHome() {
    this.pause();
    this.state.status = 'ready';
    this.clearInput();
    this.releasePointer();
    this.emit();
  }
  setMuted(muted: boolean) {
    this.audio.muted = muted;
  }
  jump() {
    if (this.state.status === 'playing') {
      this.jumpBuffer = 0.16;
      this.jumpHeld = true;
    }
  }
  releaseJump() {
    this.jumpHeld = false;
    if (this.player.vy > 5) this.player.vy *= 0.52;
  }
  setTouch(x: number, y: number) {
    const length = Math.max(1, Math.hypot(x, y));
    this.touch = { x: x / length, y: y / length };
  }
  look(x: number, y: number) {
    if (this.state.status !== 'playing') return;
    this.yaw -= x * 0.0024;
    this.pitch = THREE.MathUtils.clamp(this.pitch - y * 0.0024, -1.38, 1.38);
  }
  keyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target?.closest?.('button,input,[role="switch"],select,textarea'))
      return;
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (this.state.status === 'playing') {
        e.preventDefault();
        this.pause();
      }
      return;
    }
    if (this.state.status !== 'playing') return;
    if (
      [
        'Space',
        'ArrowUp',
        'ArrowDown',
        'ArrowLeft',
        'ArrowRight',
        'KeyW',
        'KeyA',
        'KeyS',
        'KeyD',
        'ShiftLeft',
        'ShiftRight',
        'KeyF',
      ].includes(e.code)
    )
      e.preventDefault();
    this.keys.add(e.code);
    if (e.code === 'Space' && !e.repeat) this.jump();
    if (e.code === 'KeyF' && !e.repeat) this.shoot();
    if (e.code === 'KeyE' && !e.repeat) {
      e.preventDefault();
      this.interact();
    }
  };
  keyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
    if (e.code === 'Space' && this.state.status === 'playing')
      this.releaseJump();
  };
  mouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement === this.renderer.domElement)
      this.look(e.movementX, e.movementY);
  };
  lockChange = () => {
    const locked = document.pointerLockElement === this.renderer.domElement;
    if (this.pointerLocked && !locked && this.state.status === 'playing')
      this.pause();
    this.pointerLocked = locked;
    this.renderer.domElement.setAttribute?.(
      'data-mouse-locked',
      String(locked),
    );
    if (locked) {
      this.drag = null;
      this.finishCapture?.(true);
    }
  };
  pointerDown = (e: PointerEvent) => {
    if (this.state.status !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.shoot();
      return;
    }
    if (e.pointerType !== 'touch') void this.captureMouse();
    if (this.drag) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  pointerMove = (e: PointerEvent) => {
    if (this.drag?.id !== e.pointerId || !e.buttons) return;
    this.look((e.clientX - this.drag.x) * 1.6, (e.clientY - this.drag.y) * 1.6);
    this.drag.x = e.clientX;
    this.drag.y = e.clientY;
  };
  pointerUp = (e: PointerEvent) => {
    if (this.drag?.id === e.pointerId) this.drag = null;
  };
  onBlur = () => {
    this.pause();
  };
  onVisibility = () => {
    if (document.hidden) this.pause();
  };
  contextLost = (event: Event) => {
    event.preventDefault();
    this.pause();
    this.notify('Graphics were interrupted. Reload the page to continue.', 999);
  };
  bump(b: Box) {
    if (b.kind === 'brick') {
      const brick = this.world.bricks.find((item) => item.box === b);
      if (brick && this.state.power !== 'small') {
        b.active = false;
        brick.mesh.visible = false;
        brick.hide?.();
        this.state.score += 50;
        this.burst(b.x, b.y, b.z, 8);
        this.audio.stomp();
      } else this.audio.tone(140, 0.06, 'triangle', 0.05);
      return;
    }
    if (b.kind !== 'question' || b.id === undefined) return;
    const q = this.world.questions[b.id];
    if (q.used) return;
    q.used = true;
    q.mesh.visible = true;
    q.box.hidden = false;
    q.mesh.material = this.spentBlockMaterial;
    q.bump = 0.34;
    if (q.reward === 'coin') {
      q.remaining--;
      q.used = q.remaining <= 0;
      q.mesh.material = q.used ? this.spentBlockMaterial : q.originalMaterial;
      q.coin.visible = true;
      q.coin.position.set(b.x, b.y + 1.2, b.z);
      this.collect();
    } else if (q.reward === 'vine') {
      if (q.portal) this.world.vines.get(q.portal)!.visible = true;
      this.notify('A hidden vine! Press E near it to climb.', 3);
    } else {
      const kind =
        q.reward === 'upgrade'
          ? this.state.power === 'small'
            ? 'mushroom'
            : 'flower'
          : q.reward;
      this.world.showPower(q.powerIndex, kind);
      this.audio.tone(660, 0.25, 'triangle', 0.08);
    }
  }
  collect() {
    const before = Math.floor(this.state.campaignCoins / 100);
    this.state.coins++;
    this.state.campaignCoins++;
    this.state.score += 100;
    this.audio.coin();
    if (Math.floor(this.state.campaignCoins / 100) > before) {
      this.state.lives = Math.min(9, this.state.lives + 1);
      this.notify('100 coins · 1-UP!', 3);
    }
    this.emit();
  }
  lose(reason: 'fall' | 'goomba' | 'time' | 'fire') {
    if (this.state.status !== 'playing') return;
    if (reason === 'goomba' || reason === 'fire') {
      if (this.invulnerable > 0 || this.starTime > 0) return;
      if (this.state.power !== 'small') {
        this.damageCount++;
        this.state.power = 'small';
        this.invulnerable = 2;
        this.audio.hurt();
        this.player.vy = 6;
        this.notify('Power-up lost. You have a moment to get clear.', 2);
        return;
      }
    }
    this.damageCount++;
    this.mazePassed.clear();
    this.state.lives--;
    this.state.power = 'small';
    this.starTime = 0;
    this.audio.hurt();
    this.invulnerable = 2.5;
    this.clearInput();
    this.clearProjectiles();
    if (this.state.lives <= 0) {
      this.state.status = 'over';
      this.state.notice = '';
      this.releasePointer();
      this.emit();
      return;
    }
    this.player = {
      ...newPlayer(),
      ...(this.checkpoint
        ? (this.world.level.checkpoints?.[this.checkpointIndex] ??
          this.world.level.checkpoint)
        : this.world.level.spawn),
    };
    this.area = Math.round(this.player.x / AREA_SPACING);
    this.player.height = HEIGHT;
    this.applyTheme();
    this.portalCooldown = 1;
    this.yaw = 0;
    this.pitch = 0;
    this.coyote = 0;
    this.remaining = this.world.level.time;
    this.notify(
      reason === 'goomba'
        ? 'Jump onto enemies from above.'
        : reason === 'fall'
          ? 'Watch your landing. Hold Jump for a higher jump.'
          : reason === 'fire'
            ? 'Wait for an opening, then jump over the fire.'
            : 'Time’s up! Your checkpoint is safe.',
      3,
    );
  }
  win() {
    const goal = this.world.level.goal;
    if (
      this.state.status !== 'playing' ||
      this.world.boss?.alive ||
      this.area !== this.world.level.goalArea ||
      Math.hypot(this.player.x - goal.x, this.player.z - goal.z) > 1.8 ||
      this.player.y < goal.y - 0.1
    )
      return;
    this.state.status =
      this.state.level === LEVELS.length - 1 ? 'won' : 'clear';
    this.state.score += Math.ceil(this.remaining) * 10 + 1000;
    this.state.notice = '';
    this.clearInput();
    this.audio.win();
    this.releasePointer();
    const record = this.save.records[this.state.level];
    record.cleared = true;
    record.stars |= this.state.stars;
    record.bestTime = record.bestTime
      ? Math.min(record.bestTime, Math.ceil(this.courseTime))
      : Math.ceil(this.courseTime);
    record.coinMedal ||= this.state.coins >= Math.ceil(this.state.total * 0.8);
    record.speedMedal ||= this.courseTime <= (this.world.level.par ?? 300);
    record.cleanMedal ||= this.damageCount === 0;
    record.score = Math.max(
      record.score,
      this.state.score - this.levelStartScore,
    );
    while (
      this.save.unlocked < LEVELS.length - 1 &&
      this.save.records[this.save.unlocked].cleared
    )
      this.save.unlocked++;
    saveProgress(this.save);
    this.updateLevelState();
    this.burst(this.player.x, this.player.y + 2, this.player.z - 4, 55);
    this.emit();
  }
  burst(x: number, y: number, z: number, count = 6) {
    const colors = ['#ffca32', '#f85545', '#f4fcdb', '#79da63'];
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(0.11, 0.11, 0.035),
        new THREE.MeshStandardMaterial({ color: colors[i % 4] }),
      );
      m.position.set(x, y, z);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        velocity: new THREE.Vector3(
          (Math.random() - 0.5) * 5,
          2 + Math.random() * 5,
          (Math.random() - 0.5) * 5,
        ),
        life: 1 + Math.random() * 1.2,
      });
    }
  }
  clearParticles() {
    for (const p of this.particles) {
      p.mesh.removeFromParent();
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];
  }
  projectile(
    x: number,
    y: number,
    z: number,
    vx: number,
    vy: number,
    vz: number,
    hostile = false,
    kind: Projectile['kind'] = 'fire',
  ) {
    const mesh = new THREE.Mesh(
      kind === 'hammer'
        ? new THREE.BoxGeometry(0.32, 0.4, 0.18)
        : new THREE.SphereGeometry(hostile ? 0.22 : 0.17, 10, 8),
      new THREE.MeshStandardMaterial({
        color:
          kind === 'bullet'
            ? '#232939'
            : kind === 'hammer'
              ? '#876d52'
              : hostile
                ? '#ff5433'
                : '#ffe164',
        emissive: '#ff6a1b',
        emissiveIntensity: kind === 'fire' ? 1.5 : 0,
      }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    if (kind === 'bullet') mesh.scale.z = 2;
    this.projectiles.push({
      kind,
      mesh,
      vx,
      vy,
      vz,
      life: hostile ? 4 : 2.4,
      hostile,
    });
  }
  shoot() {
    if (
      this.state.status !== 'playing' ||
      this.state.power !== 'fire' ||
      this.shootCooldown > 0
    )
      return;
    this.shootCooldown = 0.3;
    const dx = -Math.sin(this.yaw),
      dz = -Math.cos(this.yaw);
    this.projectile(
      this.player.x + dx * 0.55,
      this.player.y + 1.1,
      this.player.z + dz * 0.55,
      dx * 18,
      Math.sin(this.pitch) * 9 + 1,
      dz * 18,
    );
    this.audio.tone(180, 0.08, 'sawtooth', 0.035);
  }
  removeProjectile(index: number) {
    const p = this.projectiles[index];
    p.mesh.removeFromParent();
    p.mesh.geometry.dispose();
    (p.mesh.material as THREE.Material).dispose();
    this.projectiles.splice(index, 1);
  }
  clearProjectiles() {
    while (this.projectiles.length)
      this.removeProjectile(this.projectiles.length - 1);
  }
  defeatEnemy(e: Enemy) {
    e.alive = false;
    e.stompTime = 0.3;
    this.state.score += e.kind === 'koopa' ? 400 : 200;
    this.burst(e.x, e.y + 0.7, e.z);
    this.audio.stomp();
  }
  hitBoss() {
    const b = this.world.boss;
    if (!b?.alive || b.hurt > 0) return;
    b.health--;
    b.hurt = 0.5;
    this.audio.stomp();
    this.burst(b.x, b.y + 1.5, b.z, 15);
    if (b.health <= 0) {
      b.alive = false;
      b.mesh.visible = false;
      this.state.score += 5000;
      this.clearProjectiles();
      this.notify('Bowser defeated! Continue into the rescue room.', 5);
    } else
      this.notify(
        `${b.health} ${b.health === 1 ? 'hit' : 'hits'} to go! Watch for the next fireball.`,
        2,
      );
  }
  dropBridge() {
    if (this.bridgeDown) return;
    this.bridgeDown = true;
    for (const bridge of this.world.bridges) {
      bridge.box.active = false;
      bridge.mesh.visible = false;
      bridge.hide?.();
    }
    const boss = this.world.boss;
    if (boss?.alive) {
      boss.health = 0;
      boss.alive = false;
      boss.mesh.visible = false;
      this.state.score += 5000;
    }
    if (this.world.axe) this.world.axe.visible = false;
    this.clearProjectiles();
    this.audio.win();
    this.notify('The bridge is down! Continue to the rescue room.', 4);
  }
  movePlatforms(dt: number) {
    this.levelElapsed += dt;
    const p = this.player;
    const riding = (b: Box) =>
      p.grounded && Math.abs(p.y - (b.y + b.h / 2)) < 0.06 && overlapXZ(p, b);
    for (const platform of this.world.platforms) {
      const b = platform.box,
        old = b[platform.axis],
        on = riding(b);
      if (platform.mode === 'elevator')
        b.y =
          ((((this.levelElapsed * platform.speed * (platform.direction ?? 1) +
            platform.phase * platform.distance) %
            platform.distance) +
            platform.distance) %
            platform.distance) -
          0.225;
      else if (platform.mode === 'falling') {
        if (on) b.y -= platform.speed * dt;
        else if (b.y < platform.origin - 3) b.y = platform.origin;
      } else if (platform.mode === 'scale') {
        const other = this.world.platforms.find(
          (q) => q !== platform && q.pair === platform.pair,
        );
        if (on)
          b.y = Math.max(
            platform.origin - platform.distance,
            b.y - platform.speed * dt,
          );
        else if (other && riding(other.box))
          b.y = Math.min(
            platform.origin + platform.distance,
            b.y + platform.speed * dt,
          );
      } else if (platform.mode === 'ride') {
        if (on) platform.started = true;
        if (platform.started)
          b[platform.axis] += (platform.direction ?? -1) * platform.speed * dt;
      } else
        b[platform.axis] =
          platform.origin +
          Math.sin(this.levelElapsed * platform.speed + platform.phase) *
            platform.distance;
      platform.mesh.position[platform.axis] = b[platform.axis];
      if (on && Math.abs(b[platform.axis] - old) < 1)
        p[platform.axis] += b[platform.axis] - old;
    }
  }
  updateEnemies(dt: number, oldY: number) {
    const p = this.player,
      wet = this.world.level.areas[this.area].underwater;
    for (const [index, e] of this.world.enemies.entries()) {
      if (!e.alive || (e.area ?? 0) !== this.area) continue;
      if (!e.activated && Math.abs(p.z - e.z) > 24) continue;
      e.activated = true;
      e.stun = Math.max(0, e.stun - dt);
      e.cooldown -= dt;
      if (e.kind === 'piranha') {
        const near = Math.hypot(p.x - e.homeX, p.z - e.homeZ) < 1.7;
        e.y =
          e.homeY +
          (near ? -1.2 : Math.sin(this.levelElapsed * 1.7 + index) * 1.0 - 0.8);
      } else if (e.kind === 'podoboo' || e.leaping) {
        e.y =
          e.homeY + Math.max(0, Math.sin(this.levelElapsed * 1.6 + index)) * 7;
        if (e.kind === 'cheep')
          e.x = e.homeX + Math.sin(this.levelElapsed * 1.6 + index) * 0.8;
      } else if (e.kind === 'blooper') {
        e.y = THREE.MathUtils.clamp(e.y + (p.y + 0.3 - e.y) * dt * 0.8, 0.5, 8);
        e.z += (p.z - e.z) * dt * 0.28;
        e.x += (p.x - e.x) * dt * 0.4;
      } else if (e.kind === 'cheep') {
        e.z = e.homeZ + Math.sin(this.levelElapsed * 0.7 + index) * 3;
        e.y = e.homeY + Math.sin(this.levelElapsed * 1.2 + index) * 0.5;
      } else if (e.kind === 'lakitu') {
        e.z = THREE.MathUtils.lerp(e.z, p.z - 5, dt * 0.6);
        e.y = Math.max(e.homeY, p.y + 5);
        if (e.cooldown <= 0) {
          e.cooldown = 2.5;
          this.spawnSpiny(e.x, e.y - 0.4, e.z);
        }
      } else {
        if (e.flying)
          e.y =
            e.homeY + Math.abs(Math.sin(this.levelElapsed * 1.8 + index)) * 2.5;
        else {
          const old = e.y;
          e.vy -= 25 * dt;
          e.y += e.vy * dt;
          for (const box of this.world.boxes)
            if (
              box.active !== false &&
              !box.hidden &&
              Math.abs(e.x - box.x) < box.w / 2 + 0.3 &&
              Math.abs(e.z - box.z) < box.d / 2 + 0.3
            ) {
              const top = box.y + box.h / 2;
              if (e.vy <= 0 && old >= top - 0.08 && e.y <= top) {
                e.y = top;
                e.vy = 0;
              }
            }
        }
        if (e.roam && !e.flying) {
          moveGroundEnemy(e, p, this.world.boxes, dt, this.levelElapsed, index);
        } else if (!e.shell && e.kind !== 'hammer') {
          const axis = e.axis ?? 'z',
            speed =
              e.kind === 'spiny' ? 1.15 : e.kind === 'koopa' ? 1.15 : 0.85;
          const next = e[axis] + e.direction * speed * dt;
          const probe = { ...p, x: e.x, y: e.y + 0.04, z: e.z };
          probe[axis] = next + e.direction * 0.45;
          const supported = this.world.boxes.some(
            (b) =>
              b.active !== false &&
              !b.hidden &&
              Math.abs(b.y + b.h / 2 - e.y) < 0.15 &&
              overlapXZ(probe, b),
          );
          const blocked = this.world.boxes.some(
            (b) =>
              b.active !== false &&
              !b.hidden &&
              b.y + b.h / 2 > e.y + 0.2 &&
              b.y - b.h / 2 < e.y + 0.8 &&
              overlapXZ(probe, b),
          );
          if (
            Math.abs(next - e.home) > e.range ||
            blocked ||
            (!supported && !e.flying)
          )
            e.direction *= -1;
          else e[axis] = next;
        }
        if (
          e.kind === 'hammer' &&
          e.cooldown <= 0 &&
          Math.abs(p.z - e.z) < 14
        ) {
          e.cooldown = 1.5;
          const direction = Math.sign(p.z - e.z);
          this.projectile(
            e.x,
            e.y + 1.3,
            e.z + direction * 0.5,
            0,
            7,
            direction * 4,
            true,
            'hammer',
          );
        }
      }
      if (e.y < -8) {
        e.alive = false;
        e.mesh.visible = false;
        continue;
      }
      const top =
        e.y +
        (e.shell
          ? 0.45
          : e.kind === 'koopa' || e.kind === 'hammer'
            ? 1.3
            : e.kind === 'piranha'
              ? 1
              : 1.05);
      if (
        Math.hypot(p.x - e.x, p.z - e.z) < 0.88 &&
        p.y < top &&
        p.y + playerHeight(p) > e.y + 0.08
      ) {
        if (this.starTime > 0 && !['podoboo'].includes(e.kind)) {
          this.defeatEnemy(e);
          continue;
        }
        const stompable =
          !wet && !['piranha', 'podoboo', 'spiny'].includes(e.kind);
        if (stompable && p.vy < 0 && oldY >= top - 0.22 && e.stun <= 0) {
          if ((e.kind === 'koopa' || e.kind === 'beetle') && !e.shell) {
            e.shell = true;
            e.flying = false;
            e.stun = 0.25;
            e.mesh.scale.y = 0.42;
            this.state.score += 100;
            this.audio.stomp();
          } else this.defeatEnemy(e);
          p.y = top + 0.02;
          p.vy = 10;
          p.grounded = false;
          this.coyote = 0;
        } else if (this.invulnerable <= 0 && e.stun <= 0) {
          this.lose('goomba');
          return;
        }
      }
    }
  }
  spawnSpiny(x: number, y: number, z: number) {
    if (
      this.world.enemies.filter((e) => e.kind === 'spiny' && e.alive).length >=
      12
    )
      return;
    const mesh = new THREE.Group(),
      body = new THREE.Mesh(
        new THREE.SphereGeometry(0.4, 10, 8),
        new THREE.MeshStandardMaterial({ color: '#ec5548' }),
      );
    body.position.y = 0.4;
    mesh.add(body);
    for (const side of [-1, 0, 1]) {
      const spike = new THREE.Mesh(
        new THREE.ConeGeometry(0.1, 0.3, 6),
        new THREE.MeshStandardMaterial({ color: '#fff1d4' }),
      );
      spike.position.set(side * 0.22, 0.8, 0);
      mesh.add(spike);
    }
    mesh.position.set(x, y, z);
    this.world.root.add(mesh);
    this.world.enemies.push({
      mesh,
      x,
      y,
      z,
      home: z,
      homeX: x,
      homeY: y,
      homeZ: z,
      axis: 'z',
      range: 4,
      direction: 1,
      alive: true,
      stompTime: 0,
      kind: 'spiny',
      shell: false,
      stun: 0,
      cooldown: 1,
      activated: true,
      vy: 0,
      area: this.area,
    });
  }
  simulate(dt: number) {
    if (this.state.status !== 'playing') return;
    this.courseTime += dt;
    this.movePlatforms(dt);
    this.updateHeight();
    const p = this.player,
      wet = this.world.level.areas[this.area].underwater;
    this.remaining = Math.max(0, this.remaining - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.starTime = Math.max(0, this.starTime - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.portalCooldown = Math.max(0, this.portalCooldown - dt);
    if (wet) {
      p.vy = THREE.MathUtils.clamp(
        p.vy + (this.jumpHeld ? 18 : 0) * dt,
        -2.3,
        4,
      );
      this.coyote = 0;
    } else {
      if (p.grounded) this.coyote = 0.1;
      else this.coyote = Math.max(0, this.coyote - dt);
      if (this.jumpBuffer > 0 && this.coyote > 0) {
        p.vy = JUMP_SPEED;
        p.grounded = false;
        this.coyote = 0;
        this.jumpBuffer = 0;
        this.audio.jump();
      }
    }
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    if (this.keys.has('KeyF')) this.shoot();
    if (this.keys.has('ArrowLeft')) this.yaw += 1.8 * dt;
    if (this.keys.has('ArrowRight')) this.yaw -= 1.8 * dt;
    let forward =
      (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) -
      (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) -
      this.touch.y;
    let strafe =
      (this.keys.has('KeyD') ? 1 : 0) -
      (this.keys.has('KeyA') ? 1 : 0) +
      this.touch.x;
    const length = Math.max(1, Math.hypot(forward, strafe));
    forward /= length;
    strafe /= length;
    const speed = wet
      ? 3.1
      : this.keys.has('KeyC')
        ? 2.4
        : this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')
          ? 10.8
          : 7.1;
    const targetX =
        (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed,
      targetZ =
        (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    const smoothing = 1 - Math.exp(-(p.grounded ? 20 : wet ? 6 : 9) * dt);
    p.vx = THREE.MathUtils.lerp(p.vx, targetX, smoothing);
    p.vz = THREE.MathUtils.lerp(p.vz, targetZ, smoothing);
    const oldY = p.y;
    stepPlayer(p, this.world.boxes, dt, (b) => this.bump(b), wet ? 6 : 25);
    if (wet && p.y + playerHeight(p) > 9.4) {
      p.y = 9.4 - playerHeight(p);
      p.vy = Math.min(0, p.vy);
    }
    if (p.grounded)
      for (const spring of this.world.springs)
        if (
          Math.abs(p.y - spring.y - spring.h / 2) < 0.1 &&
          overlapXZ(p, spring)
        ) {
          p.vy = 19;
          p.grounded = false;
          this.coyote = 0;
          this.audio.jump();
        }
    const inLava =
      !wet &&
      this.world.level.lava.some(
        (b) =>
          b.area === this.area && overlapXZ(p, b) && p.y < b.y + b.h / 2 + 0.04,
      );
    const skyExit = this.world.level.areas[this.area].exit;
    if (skyExit && p.y < -2) {
      this.enterArea(skyExit.area, skyExit.point);
      this.notify('Back to the main course.', 2);
      return;
    }
    if (p.y < -8 || inLava) {
      this.lose('fall');
      return;
    }
    if (this.remaining <= 0) {
      this.lose('time');
      return;
    }
    for (const c of this.world.coins)
      if (
        !c.taken &&
        Math.hypot(p.x - c.x, p.z - c.z) < 0.7 &&
        p.y + playerHeight(p) > c.y - 0.3 &&
        p.y < c.y + 0.3
      ) {
        c.taken = true;
        c.mesh.visible = false;
        this.collect();
        this.burst(c.x, c.y, c.z, 4);
      }
    for (const power of this.world.pickups)
      if (
        power.active &&
        !power.taken &&
        Math.hypot(p.x - power.x, p.z - power.z) < 0.85 &&
        p.y + playerHeight(p) > power.y - 0.4 &&
        p.y < power.y + 0.4
      ) {
        power.taken = true;
        power.mesh.visible = false;
        this.state.score += 300;
        if (power.kind === 'star') this.starTime = 12;
        else if (power.kind === 'life')
          this.state.lives = Math.min(9, this.state.lives + 1);
        else if (power.kind === 'flower') this.state.power = 'fire';
        else if (this.state.power === 'small') this.state.power = 'super';
        this.audio.tone(880, 0.25, 'triangle', 0.08);
        this.notify(
          power.kind === 'life'
            ? '1-UP!'
            : power.kind === 'star'
              ? 'Invincible!'
              : power.kind === 'flower'
                ? 'Fire Mario! F or click to throw.'
                : 'Super Mario!',
          2,
        );
      }
    this.updateEnemies(dt, oldY);
    if (this.player !== p) return;
    for (const bar of this.world.firebars) {
      if ((bar.area ?? 0) !== this.area) continue;
      bar.angle = this.levelElapsed * bar.speed;
      if (bar.plane === 'horizontal') bar.mesh.rotation.y = -bar.angle;
      else bar.mesh.rotation.x = bar.angle;
      for (let r = 0.4; r <= bar.length; r += 0.45) {
        const horizontal = bar.plane === 'horizontal';
        const x = horizontal ? bar.x + Math.cos(bar.angle) * r : bar.x,
          y = horizontal ? bar.y : bar.y - Math.sin(bar.angle) * r,
          z =
            bar.z +
            (horizontal ? Math.sin(bar.angle) : Math.cos(bar.angle)) * r;
        if (
          Math.hypot(p.x - x, p.z - z) < RADIUS + 0.25 &&
          p.y < y + 0.25 &&
          p.y + playerHeight(p) > y - 0.25 &&
          this.invulnerable <= 0 &&
          this.starTime <= 0
        ) {
          this.lose('fire');
          return;
        }
      }
    }
    for (const [i, cannon] of this.world.level.cannons.entries())
      if (cannon.area === this.area && Math.abs(p.z - cannon.z) < 22) {
        this.cannonClocks[i] = (this.cannonClocks[i] ?? i * 0.2) - dt;
        if (this.cannonClocks[i] <= 0) {
          this.cannonClocks[i] = 2.6;
          const dir = Math.sign(p.z - cannon.z) || 1;
          this.projectile(
            cannon.x,
            Math.max(0.65, cannon.y - 0.3),
            cannon.z + dir * 0.7,
            0,
            0,
            dir * 6,
            true,
            'bullet',
          );
        }
      }
    const boss = this.world.boss;
    if (boss?.alive && this.area === this.world.level.goalArea) {
      boss.hurt = Math.max(0, boss.hurt - dt);
      boss.x = boss.home + Math.sin(this.levelElapsed * 0.75) * 2.7;
      boss.mesh.position.set(boss.x, boss.y, boss.z);
      boss.mesh.visible = boss.hurt <= 0 || Math.floor(boss.hurt * 8) % 2 === 0;
      if (Math.hypot(p.x - boss.x, p.z - boss.z) < 22) {
        boss.cooldown -= dt;
        if (boss.cooldown <= 0) {
          boss.cooldown = 2.8 - this.world.level.world * 0.14;
          const aim = new THREE.Vector3(
            p.x - boss.x,
            p.y + 0.8 - (boss.y + 0.65),
            p.z - boss.z,
          ).normalize();
          const dir = Math.sign(p.z - boss.z) || 1;
          this.projectile(
            boss.x,
            boss.y + 0.65,
            boss.z + dir * 1.2,
            aim.x * 7,
            aim.y * 7,
            aim.z * 7,
            true,
          );
          if (this.world.level.world >= 5)
            this.projectile(
              boss.x,
              boss.y + 1.2,
              boss.z + dir * 0.7,
              0,
              7,
              dir * 4,
              true,
              'hammer',
            );
        }
      }
      if (
        Math.hypot(p.x - boss.x, p.z - boss.z) < 1.35 &&
        p.y < boss.y + 2.4 &&
        p.y + playerHeight(p) > boss.y + 0.15 &&
        this.invulnerable <= 0 &&
        this.starTime <= 0
      ) {
        this.lose('goomba');
        return;
      }
    }
    const axe = this.world.level.axe;
    if (
      axe &&
      !this.bridgeDown &&
      Math.hypot(p.x - axe.x, p.z - axe.z) < 0.9 &&
      p.y + playerHeight(p) > axe.y - 0.4 &&
      p.y < axe.y + 0.4
    )
      this.dropBridge();
    this.updateProjectiles(dt);
    if (this.player !== p || this.state.status !== 'playing') return;
    for (const route of this.world.level.mazeRoutes) {
      if (route.area !== this.area || p.z > route.startZ || p.z < route.endZ)
        continue;
      if (p.y >= route.minY - 0.15 && p.y < route.maxY - 0.1)
        this.mazePassed.add(route.id);
      else this.mazePassed.delete(route.id);
    }
    for (const exit of this.world.level.mazeExits)
      if (
        exit.area === this.area &&
        p.z < exit.z &&
        p.z > exit.z - 1.5 &&
        (exit.requires.length === 0 ||
          !exit.requires.every((id) => this.mazePassed.has(id)))
      ) {
        this.enterArea(this.area, exit.target);
        for (const id of exit.requires) this.mazePassed.delete(id);
        this.notify('The castle loops back. Try a different passage.', 3);
        return;
      }
    const auto = this.nearPortal();
    if (auto?.mode === 'walk') {
      this.interact();
      return;
    }
    for (const [i, cp] of this.world.level.checkpoints.entries())
      if (
        i > this.checkpointIndex &&
        p.grounded &&
        Math.hypot(p.x - cp.x, p.z - cp.z) < 1.2 &&
        Math.abs(p.y - cp.y) < 0.15
      ) {
        this.checkpoint = true;
        this.checkpointIndex = i;
        this.audio.tone(784, 0.2, 'triangle', 0.08);
        this.notify('Checkpoint reached.', 2);
      }
    this.win();
  }
  updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i],
        pos = shot.mesh.position,
        oldY = pos.y;
      shot.life -= dt;
      if (!shot.hostile || shot.kind === 'hammer')
        shot.vy -= (shot.hostile ? 18 : 14) * dt;
      if (shot.kind === 'hammer') shot.mesh.rotation.x += dt * 9;
      pos.x += shot.vx * dt;
      pos.y += shot.vy * dt;
      pos.z += shot.vz * dt;
      let hit = false;
      for (const b of this.world.boxes) {
        if (
          b.active === false ||
          b.hidden ||
          Math.abs(pos.x - b.x) > b.w / 2 + 0.15 ||
          Math.abs(pos.z - b.z) > b.d / 2 + 0.15
        )
          continue;
        const top = b.y + b.h / 2,
          bottom = b.y - b.h / 2;
        if (
          !shot.hostile &&
          shot.vy < 0 &&
          oldY - 0.15 >= top - 0.03 &&
          pos.y - 0.15 <= top
        ) {
          pos.y = top + 0.16;
          shot.vy = 5;
          break;
        }
        if (pos.y + 0.15 > bottom && pos.y - 0.15 < top) {
          hit = true;
          break;
        }
      }
      if (shot.hostile) {
        if (
          Math.hypot(pos.x - this.player.x, pos.z - this.player.z) < 0.65 &&
          pos.y > this.player.y - 0.1 &&
          pos.y < this.player.y + playerHeight(this.player) + 0.1
        ) {
          hit = true;
          if (this.invulnerable <= 0 && this.starTime <= 0) {
            this.lose('fire');
            return;
          }
        }
      } else if (!hit) {
        for (const e of this.world.enemies)
          if (
            e.alive &&
            Math.hypot(pos.x - e.x, pos.z - e.z) < 0.8 &&
            pos.y > e.y - 0.1 &&
            pos.y < e.y + 1.5
          ) {
            if (e.kind !== 'beetle' && e.kind !== 'podoboo')
              this.defeatEnemy(e);
            hit = true;
            break;
          }
        const b = this.world.boss;
        if (
          !hit &&
          b?.alive &&
          Math.hypot(pos.x - b.x, pos.z - b.z) < 1.3 &&
          pos.y > b.y &&
          pos.y < b.y + 2.5
        ) {
          const last = b.health === 1;
          this.hitBoss();
          if (last && !b.alive) return;
          hit = true;
        }
      }
      if (hit || shot.life <= 0 || pos.y < -6) this.removeProjectile(i);
    }
  }
  animate(dt: number) {
    this.elapsed += dt;
    for (const [i, c] of this.world.coins.entries())
      if (!c.taken) {
        c.mesh.rotation.y = this.elapsed * 1.7 + i * 0.2;
        c.mesh.position.y = c.y + Math.sin(this.elapsed * 2.4 + i) * 0.075;
      }
    for (const q of this.world.questions)
      if (q.bump > 0) {
        q.bump -= dt;
        q.mesh.position.y =
          q.baseY + Math.sin((Math.max(0, q.bump) / 0.34) * Math.PI) * 0.22;
        q.coin.position.y += dt * 3;
        q.coin.rotation.y += dt * 7;
        if (q.bump <= 0) {
          q.coin.visible = false;
          q.mesh.position.y = q.baseY;
        }
      }
    for (const o of this.world.pickups)
      if (o.active && !o.taken) {
        o.mesh.rotation.y = this.elapsed;
        o.mesh.position.y = o.y + Math.sin(this.elapsed * 3) * 0.09;
      }
    for (const e of this.world.enemies) {
      e.mesh.position.set(e.x, e.y, e.z);
      if (e.alive) {
        e.mesh.rotation.z = e.shell
          ? 0
          : Math.sin(this.elapsed * 7 + e.z) * 0.06;
        e.mesh.rotation.y = e.heading ?? 0.15 * e.direction;
      } else if (e.stompTime > 0) {
        e.stompTime -= dt;
        e.mesh.scale.y = 0.22;
        if (e.stompTime <= 0) e.mesh.visible = false;
      }
    }
    this.world.flag.rotation.y = Math.sin(this.elapsed * 2) * 0.15;
    if (this.state.status === 'won' || this.state.status === 'clear')
      this.world.flagGroup.position.y = THREE.MathUtils.lerp(
        this.world.flagGroup.position.y,
        this.world.level.goal.y + 2,
        dt * 0.8,
      );
    for (const [i, checkpoint] of this.world.checkpoints.entries())
      checkpoint.children[1].scale.y = i <= this.checkpointIndex ? 1.1 : 0.6;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.velocity.y -= dt * 7;
      p.mesh.position.addScaledVector(p.velocity, dt);
      p.mesh.rotation.x += dt * 4;
      p.mesh.rotation.z += dt * 3;
      if (p.life <= 0) {
        p.mesh.removeFromParent();
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
      }
    }
  }
  loop = (now: number) => {
    if (!this.running) return;
    const dt = this.lastFrame
      ? Math.min(Math.max(0, (now - this.lastFrame) / 1000), 0.08)
      : 1 / 60;
    this.lastFrame = now;
    const playing = this.state.status === 'playing';
    if (playing) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 120) {
        this.simulate(1 / 120);
        this.accumulator -= 1 / 120;
        if (this.state.status !== 'playing') {
          this.accumulator = 0;
          break;
        }
      }
      this.audio.music(dt);
      if (this.noticeTimer > 0) {
        this.noticeTimer -= dt;
        if (this.noticeTimer <= 0) {
          this.state.notice = '';
          this.emit();
        }
      }
    }
    if (!['paused', 'over'].includes(this.state.status)) this.animate(dt);
    if (this.state.status === 'ready') {
      this.camera.position.set(
        17 + (this.reducedMotion ? 0 : Math.sin(this.elapsed * 0.08) * 1.3),
        11.5,
        24,
      );
      this.camera.lookAt(-1, 1, -15);
      this.hands.visible = false;
      this.shadow.visible = false;
    } else {
      const speed = Math.hypot(this.player.vx, this.player.vz),
        bob =
          playing && this.player.grounded && !this.reducedMotion
            ? Math.sin(this.elapsed * 12) * Math.min(speed / 160, 0.035)
            : 0;
      this.camera.position.set(
        this.player.x,
        this.player.y + playerHeight(this.player) - 0.12 + bob,
        this.player.z,
      );
      this.camera.rotation.order = 'YXZ';
      this.camera.rotation.set(this.pitch, this.yaw, 0);
      this.hands.visible =
        playing &&
        (this.invulnerable <= 0 ||
          Math.floor(this.invulnerable * 10) % 2 === 0);
      this.leftHand.position.y =
        -0.34 + Math.sin(this.elapsed * 11) * Math.min(speed * 0.005, 0.04);
      this.rightHand.position.y =
        -0.34 - Math.sin(this.elapsed * 11) * Math.min(speed * 0.005, 0.04);
      const fov =
        playing &&
        !this.reducedMotion &&
        (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))
          ? 74
          : 68;
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, fov, dt * 4);
      this.camera.updateProjectionMatrix();
      this.sun.position.set(this.player.x - 20, 35, this.player.z + 18);
      this.sun.target.position.set(this.player.x, 0, this.player.z - 5);
      let ground = -Infinity;
      for (const b of this.world.boxes)
        if (
          b.active !== false &&
          overlapXZ(this.player, b) &&
          b.y + b.h / 2 <= this.player.y + 0.05
        )
          ground = Math.max(ground, b.y + b.h / 2);
      this.shadow.visible = playing && ground > -Infinity;
      this.shadow.position.set(this.player.x, ground + 0.022, this.player.z);
      this.shadow.scale.setScalar(
        1 + Math.max(0, this.player.y - ground) * 0.07,
      );
    }
    this.emitTime += dt;
    if (playing && this.emitTime > 0.15) {
      this.emitTime = 0;
      this.emit();
    }
    if (this.rtx) this.rtx.render();
    else this.renderer.render(this.scene, this.camera);
  };
  destroy() {
    this.running = false;
    this.finishCapture?.(false);
    if (this.captureTimer !== undefined) clearTimeout(this.captureTimer);
    this.runtime.destroy();
    this.releasePointer();
    this.graphicsRequest++;
    this.rtx?.dispose();
    this.rtx = null;
    this.audio.destroy();
    this.clearParticles();
    this.clearProjectiles();
    this.world.dispose();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>();
    this.scene.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          materials.add(m);
      }
    });
    materials.forEach((m) => m.dispose());
    geometries.forEach((g) => g.dispose());
    this.spentBlockMaterial.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
