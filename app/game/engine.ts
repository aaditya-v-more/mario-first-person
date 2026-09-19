import * as THREE from 'three';
import { makeWorld, type World, type Enemy } from './world';
import {
  newPlayer,
  stepPlayer,
  overlapXZ,
  JUMP_SPEED,
  HEIGHT,
  RADIUS,
  type Box,
} from './physics';
import { LEVELS, PALETTES } from './levels';
import {
  countStars,
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
});
type Particle = { mesh: THREE.Mesh; velocity: THREE.Vector3; life: number };
type Projectile = {
  mesh: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  hostile: boolean;
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
  player = newPlayer();
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
  shootCooldown = 0;
  starTime = 0;
  levelStartScore = 0;
  levelStartCoins = 0;
  checkpointIndex = -1;
  damageCount = 0;
  courseTime = 0;
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
    this.hemisphere = new THREE.HemisphereLight('#e8faff', '#658342', 2.7);
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
    this.audio.setTheme?.(this.world.level.theme);
    const c = PALETTES[this.world.level.theme];
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
        this.world.questions.filter((q) => q.reward === 'coin').length,
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
    const l = this.world.level;
    this.state.time = Math.ceil(this.remaining);
    this.state.progress = THREE.MathUtils.clamp(
      (l.spawn.z - this.player.z) / (l.spawn.z - l.goal.z),
      0,
      1,
    );
    this.state.checkpoint = this.checkpoint;
    this.state.starTime = Math.ceil(this.starTime);
    this.state.bossHealth = this.world.boss?.health ?? null;
    this.onChange({ ...this.state });
  }
  notify(text: string, duration = 2.5) {
    this.state.notice = text;
    this.noticeTimer = duration;
    this.emit();
  }
  clearInput() {
    this.keys.clear();
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
    if (requestLock && !window.matchMedia('(pointer: coarse)').matches) {
      try {
        const lock = this.renderer.domElement.requestPointerLock?.();
        if (lock && typeof lock.catch === 'function')
          void lock.catch(() => {
            if (this.state.status === 'playing')
              this.notify('Drag to look, or use ← → to turn.', 4);
          });
      } catch {
        this.notify('Drag to look, or use ← → to turn.', 4);
      }
    }
  }
  pause() {
    if (this.state.status !== 'playing') return;
    this.state.status = 'paused';
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
    this.applyTheme();
    this.player = { ...newPlayer(), ...this.world.level.spawn };
    this.camera?.position.set(
      this.player.x,
      this.player.y + HEIGHT - 0.12,
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
    if (this.state.status === 'playing') this.jumpBuffer = 0.16;
  }
  releaseJump() {
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
  };
  pointerDown = (e: PointerEvent) => {
    if (this.state.status !== 'playing') return;
    if (document.pointerLockElement === this.renderer.domElement) {
      this.shoot();
      return;
    }
    if (this.drag) return;
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    this.renderer.domElement.setPointerCapture(e.pointerId);
  };
  pointerMove = (e: PointerEvent) => {
    if (this.drag?.id !== e.pointerId) return;
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
    if (b.kind !== 'question' || b.id === undefined) return;
    const q = this.world.questions[b.id];
    if (q.used) return;
    q.used = true;
    q.mesh.material = this.spentBlockMaterial;
    q.bump = 0.34;
    if (q.reward === 'coin') {
      q.coin.visible = true;
      q.coin.position.set(b.x, b.y + 1.2, b.z);
      this.collect();
    } else {
      const pickup = this.world.pickups[q.powerIndex];
      pickup.active = true;
      pickup.mesh.visible = true;
      this.audio.tone(660, 0.25, 'triangle', 0.08);
      this.notify(
        q.reward === 'flower'
          ? 'Fire flower! Grab it, then press F or click to throw.'
          : q.reward === 'star'
            ? 'Super Star! Grab it for 12 seconds of invincibility.'
            : 'A Super Mushroom! Grab it for an extra hit.',
        3,
      );
    }
  }
  collect() {
    const before = Math.floor(this.state.campaignCoins / 50);
    this.state.coins++;
    this.state.campaignCoins++;
    this.state.score += 100;
    this.audio.coin();
    if (Math.floor(this.state.campaignCoins / 50) > before) {
      this.state.lives = Math.min(9, this.state.lives + 1);
      this.notify('50 coins · 1-UP!', 3);
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
    if (this.state.status !== 'playing' || this.world.boss?.alive) return;
    this.state.status =
      this.state.level === LEVELS.length - 1 ? 'won' : 'clear';
    this.state.score += Math.ceil(this.remaining) * 10 + 1000;
    this.state.lives = Math.min(9, this.state.lives + 1);
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
    this.save.unlocked = Math.max(
      this.save.unlocked,
      Math.min(LEVELS.length - 1, this.state.level + 1),
    );
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
  ) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(hostile ? 0.29 : 0.17, 10, 8),
      new THREE.MeshStandardMaterial({
        color: hostile ? '#ff5433' : '#ffe164',
        emissive: '#ff6a1b',
        emissiveIntensity: 1.5,
      }),
    );
    mesh.position.set(x, y, z);
    this.scene.add(mesh);
    this.projectiles.push({
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
    b.hurt = 1.8;
    this.audio.stomp();
    this.burst(b.x, b.y + 1.5, b.z, 15);
    if (b.health <= 0) {
      b.alive = false;
      b.mesh.visible = false;
      this.state.score += 5000;
      if (this.world.gate) this.world.gate.visible = false;
      if (this.world.gateBox) this.world.gateBox.active = false;
      this.clearProjectiles();
      this.notify(
        'Bowser defeated! The castle gate is open. Reach the flag!',
        5,
      );
    } else
      this.notify(
        `${b.health} ${b.health === 1 ? 'hit' : 'hits'} to go! Watch for the next fireball.`,
        2,
      );
  }
  movePlatforms(dt: number) {
    this.levelElapsed += dt;
    const p = this.player;
    for (const platform of this.world.platforms) {
      const b = platform.box,
        old = b[platform.axis],
        riding =
          p.grounded &&
          Math.abs(p.y - (b.y + b.h / 2)) < 0.06 &&
          overlapXZ(p, b);
      b[platform.axis] =
        platform.origin +
        Math.sin(this.levelElapsed * platform.speed + platform.phase) *
          platform.distance;
      platform.mesh.position[platform.axis] = b[platform.axis];
      if (riding) p[platform.axis] += b[platform.axis] - old;
    }
  }
  simulate(dt: number) {
    if (this.state.status !== 'playing') return;
    this.courseTime += dt;
    this.movePlatforms(dt);
    const p = this.player;
    this.remaining = Math.max(0, this.remaining - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.starTime = Math.max(0, this.starTime - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (p.grounded) this.coyote = 0.1;
    else this.coyote = Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0) {
      p.vy = JUMP_SPEED;
      p.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
      this.audio.jump();
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
    const speed =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 10.8 : 7.1;
    const targetX =
        (-Math.sin(this.yaw) * forward + Math.cos(this.yaw) * strafe) * speed,
      targetZ =
        (-Math.cos(this.yaw) * forward - Math.sin(this.yaw) * strafe) * speed;
    const smoothing = 1 - Math.exp(-(p.grounded ? 20 : 9) * dt);
    p.vx = THREE.MathUtils.lerp(p.vx, targetX, smoothing);
    p.vz = THREE.MathUtils.lerp(p.vz, targetZ, smoothing);
    const oldY = p.y;
    stepPlayer(p, this.world.boxes, dt, (b) => this.bump(b));
    if (
      p.y < -8 ||
      ((this.world.level.theme === 'lava' ||
        this.world.level.theme === 'castle') &&
        p.y < -2.4)
    ) {
      this.lose('fall');
      return;
    }
    if (this.remaining <= 0) {
      this.lose('time');
      return;
    }
    for (const c of this.world.coins) {
      if (c.taken) continue;
      if (
        Math.hypot(p.x - c.x, p.z - c.z) < (c.star === undefined ? 0.78 : 1) &&
        p.y + HEIGHT > c.y - 0.4 &&
        p.y < c.y + 0.4
      ) {
        c.taken = true;
        c.mesh.visible = false;
        if (c.star === undefined) this.collect();
        else {
          this.state.stars |= 1 << c.star;
          this.state.score += 1000;
          this.audio.coin();
          this.notify(`Star coin ${countStars(this.state.stars)} / 3!`, 2);
        }
        this.burst(c.x, c.y, c.z, 5);
      }
    }
    for (const power of this.world.pickups) {
      if (!power.active || power.taken) continue;
      if (
        Math.hypot(p.x - power.x, p.z - power.z) < 0.85 &&
        p.y + HEIGHT > power.y - 0.5 &&
        p.y < power.y + 0.5
      ) {
        power.taken = true;
        power.mesh.visible = false;
        this.state.score += 300;
        if (power.kind === 'star') this.starTime = 12;
        else if (power.kind === 'flower') this.state.power = 'fire';
        else if (this.state.power === 'small') this.state.power = 'super';
        this.audio.tone(880, 0.25, 'triangle', 0.08);
        this.notify(
          power.kind === 'star'
            ? 'Invincible for 12 seconds!'
            : power.kind === 'flower'
              ? 'Fire Mario! Press F or click to throw fireballs.'
              : 'Super Mario! You can take an extra hit.',
          3,
        );
      }
    }
    for (const e of this.world.enemies) {
      if (!e.alive) continue;
      e.stun = Math.max(0, e.stun - dt);
      if (!e.shell) {
        const next = e.x + e.direction * (e.kind === 'koopa' ? 1.4 : 1.05) * dt;
        // Patrols turn at walls, pipes and unsupported edges, including elevated floors.
        const probe = {
          ...p,
          x: next + e.direction * 0.6,
          y: e.y + 0.04,
          z: e.z,
        };
        const supported = this.world.boxes.some(
          (b) =>
            b.active !== false &&
            Math.abs(b.y + b.h / 2 - e.y) < 0.1 &&
            overlapXZ(probe, b),
        );
        const blocked = this.world.boxes.some(
          (b) =>
            b.active !== false &&
            b.y + b.h / 2 > e.y + 0.2 &&
            b.y - b.h / 2 < e.y + 1 &&
            overlapXZ(probe, b),
        );
        if (Math.abs(next - e.home) > e.range || !supported || blocked)
          e.direction *= -1;
        else e.x = next;
      }
      const top = e.y + (e.shell ? 0.5 : e.kind === 'koopa' ? 1.3 : 1.05);
      if (
        Math.hypot(p.x - e.x, p.z - e.z) < 0.88 &&
        p.y < top &&
        p.y + HEIGHT > e.y + 0.12
      ) {
        if (this.starTime > 0) {
          this.defeatEnemy(e);
          continue;
        }
        if (p.vy < 0 && oldY >= top - 0.22 && e.stun <= 0) {
          if (e.kind === 'koopa' && !e.shell) {
            e.shell = true;
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
    for (const bar of this.world.firebars) {
      bar.angle = this.levelElapsed * bar.speed;
      bar.mesh.rotation.y = -bar.angle;
      for (let r = 0.6; r <= bar.length; r += 0.55) {
        const x = bar.x + Math.cos(bar.angle) * r,
          z = bar.z + Math.sin(bar.angle) * r;
        if (
          Math.hypot(p.x - x, p.z - z) < RADIUS + 0.27 &&
          p.y < bar.y + 0.27 &&
          p.y + HEIGHT > bar.y - 0.27
        ) {
          if (this.invulnerable <= 0 && this.starTime <= 0) {
            this.lose('fire');
            return;
          }
        }
      }
    }
    const boss = this.world.boss;
    if (boss?.alive) {
      boss.hurt = Math.max(0, boss.hurt - dt);
      boss.x = boss.home + Math.sin(this.levelElapsed * 0.75) * 3;
      boss.mesh.position.set(boss.x, boss.y, boss.z);
      boss.mesh.visible = boss.hurt <= 0 || Math.floor(boss.hurt * 8) % 2 === 0;
      if (Math.hypot(p.x - boss.x, p.z - boss.z) < 28) {
        boss.cooldown -= dt;
        if (boss.cooldown <= 0) {
          boss.cooldown = 2.8 - (this.world.level.world ?? 0) * 0.16;
          const direction = new THREE.Vector3(
            p.x - boss.x,
            p.y + 0.8 - (boss.y + 1.5),
            p.z - boss.z,
          ).normalize();
          this.projectile(
            boss.x,
            boss.y + 1.5,
            boss.z + 1.3,
            direction.x * 9,
            direction.y * 9,
            direction.z * 9,
            true,
          );
          if ((this.world.level.world ?? 0) >= 3 && boss.health <= 2) {
            for (const angle of [-0.22, 0.22])
              this.projectile(
                boss.x,
                boss.y + 1.5,
                boss.z + 1.3,
                (direction.x * Math.cos(angle) -
                  direction.z * Math.sin(angle)) *
                  9,
                direction.y * 9,
                (direction.x * Math.sin(angle) +
                  direction.z * Math.cos(angle)) *
                  9,
                true,
              );
          }
        }
      }
      if (
        Math.hypot(p.x - boss.x, p.z - boss.z) < 1.35 &&
        p.y < boss.y + 2.5 &&
        p.y + HEIGHT > boss.y + 0.2
      ) {
        if (p.vy < 0 && oldY >= boss.y + 2.25) {
          this.hitBoss();
          p.vy = 12;
          p.y = boss.y + 2.52;
          p.grounded = false;
          this.coyote = 0;
        } else if (this.starTime > 0) this.hitBoss();
        else if (boss.hurt <= 0 && this.invulnerable <= 0) {
          this.lose('goomba');
          return;
        }
      }
    }
    this.updateProjectiles(dt);
    if (this.player !== p || this.state.status !== 'playing') return;
    const checkpoints = this.world.level.checkpoints ?? [
      this.world.level.checkpoint,
    ];
    for (const [i, cp] of checkpoints.entries())
      if (
        i > this.checkpointIndex &&
        p.grounded &&
        Math.hypot(p.x - cp.x, p.z - cp.z) < 3 &&
        Math.abs(p.y - cp.y) < 0.15
      ) {
        this.checkpoint = true;
        this.checkpointIndex = i;
        this.audio.tone(784, 0.2, 'triangle', 0.08);
        this.notify(
          `Checkpoint ${i + 1} / ${checkpoints.length}! A safe place to start again.`,
          3,
        );
      }
    const goal = this.world.level.goal;
    if (
      Math.hypot(p.x - goal.x, p.z - goal.z) < 1.8 &&
      p.y >= goal.y - 0.1 &&
      p.y < goal.y + 5
    )
      this.win();
  }
  updateProjectiles(dt: number) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const shot = this.projectiles[i],
        pos = shot.mesh.position,
        oldY = pos.y;
      shot.life -= dt;
      if (!shot.hostile) shot.vy -= 14 * dt;
      pos.x += shot.vx * dt;
      pos.y += shot.vy * dt;
      pos.z += shot.vz * dt;
      let hit = false;
      for (const b of this.world.boxes) {
        if (
          b.active === false ||
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
          pos.y < this.player.y + HEIGHT + 0.1
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
        e.mesh.rotation.y = 0.15 * e.direction;
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
        this.player.y + HEIGHT - 0.12 + bob,
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
