import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  newPlayer,
  stepPlayer,
  JUMP_SPEED,
  HEIGHT,
  type Box,
} from '../app/game/physics';
import { GameEngine, initialSnapshot } from '../app/game/engine';
import { LEVELS } from '../app/game/levels';
import {
  freshProgress,
  readProgress,
  saveProgress,
} from '../app/game/progress';
import { makeWorld } from '../app/game/world';
import { enhanceMaterials, graphicsPixelRatio } from '../app/game/graphics';
const ground: Box = { x: 0, y: -1, z: 0, w: 30, h: 2, d: 30 };
const step = (
  p: ReturnType<typeof newPlayer>,
  boxes: Box[],
  seconds: number,
) => {
  for (let t = 0; t < seconds; t += 1 / 120) stepPlayer(p, boxes, 1 / 120);
};
void test('standing player stays grounded and lands after a full jump', () => {
  const p = newPlayer();
  step(p, [ground], 2);
  assert.equal(p.y, 0);
  assert.equal(p.grounded, true);
  p.vy = JUMP_SPEED;
  p.grounded = false;
  step(p, [ground], 0.45);
  assert.ok(p.y > 3.7 && p.y < 4);
  step(p, [ground], 1);
  assert.equal(p.y, 0);
  assert.equal(p.vy, 0);
});
void test('player cannot pass through pipes or the underside of blocks', () => {
  const p = { ...newPlayer(), z: 0, vx: 7 };
  const wall = { x: 2, y: 1.5, z: 0, w: 2, h: 3, d: 2 };
  step(p, [ground, wall], 1);
  assert.ok(p.x <= 0.660001);
  const q = { ...newPlayer(), x: 0, z: 0, vy: JUMP_SPEED, grounded: false };
  const block = { x: 0, y: 3.05, z: 0, w: 1.35, h: 1.35, d: 1.35 };
  let hits = 0;
  for (let i = 0; i < 80; i++)
    stepPlayer(q, [ground, block], 1 / 120, () => hits++);
  assert.equal(hits, 1);
  assert.ok(q.y + HEIGHT < block.y - block.h / 2);
});
void test('a normal forward jump clears the four-unit course gaps', () => {
  const p = {
    ...newPlayer(),
    z: -35.2,
    vz: -7.1,
    vy: JUMP_SPEED,
    grounded: false,
  };
  const a = { x: 0, y: -1, z: -9, w: 26, h: 2, d: 56 },
    b = { x: 2, y: -1, z: -65, w: 22, h: 2, d: 48 };
  step(p, [a, b], 1.25);
  assert.ok(p.z < -41);
  assert.equal(p.grounded, true);
  assert.equal(p.y, 0);
});
const fakeContext = {
  fillStyle: '',
  font: '',
  textAlign: '',
  fillRect() {},
  fillText() {},
};
const storage = new Map<string, string>();
Object.assign(globalThis, {
  document: {
    createElement() {
      return {
        width: 128,
        height: 128,
        getContext() {
          return fakeContext;
        },
      };
    },
    pointerLockElement: null,
  },
  window: {
    matchMedia() {
      return { matches: false };
    },
  },
  localStorage: {
    getItem: (key: string) => storage.get(key) || null,
    setItem: (key: string, value: string) => storage.set(key, value),
  },
});
function game(index = 0): GameEngine {
  const scene = new THREE.Scene(),
    world = makeWorld(scene, undefined, LEVELS[index]);
  const g = Object.assign(Object.create(GameEngine.prototype) as GameEngine, {
    scene,
    world,
    runtime: {
      createTextureCanvas: () => document.createElement('canvas'),
      loadGraphics: () => import('../app/game/rtx'),
    },
    renderer: { domElement: {}, setClearColor() {} },
    sun: new THREE.DirectionalLight(),
    hemisphere: new THREE.HemisphereLight(),
    player: { ...newPlayer(), ...world.level.spawn },
    state: {
      ...initialSnapshot(),
      status: 'playing',
      level: index,
      total:
        world.coins.filter((c) => c.star === undefined).length +
        world.questions.filter((q) => q.reward === 'coin').length,
    },
    save: freshProgress(),
    remaining: world.level.time,
    keys: new Set<string>(),
    touch: { x: 0, y: 0 },
    yaw: 0,
    pitch: 0,
    jumpBuffer: 0,
    coyote: 0.1,
    invulnerable: 0,
    checkpoint: false,
    checkpointIndex: -1,
    damageCount: 0,
    courseTime: 0,
    levelStartScore: 0,
    levelStartCoins: 0,
    levelElapsed: 0,
    starTime: 0,
    shootCooldown: 0,
    noticeTimer: 0,
    particles: [],
    projectiles: [],
    spentBlockMaterial: new THREE.MeshStandardMaterial(),
    audio: {
      async activate() {},
      coin() {},
      jump() {},
      stomp() {},
      hurt() {},
      win() {},
      tone() {},
    },
    onChange() {},
  });
  return g;
}
void test('coin collision collects each coin exactly once', () => {
  const g = game();
  const c = g.world.coins[0];
  g.player.x = c.x;
  g.player.z = c.z;
  g.simulate(1 / 120);
  g.simulate(1 / 120);
  assert.equal(g.state.coins, 1);
  assert.equal(g.state.score, 100);
  assert.equal(c.taken, true);
});
void test('a question block pays out once and becomes a used block', () => {
  const g = game();
  const b = g.world.boxes.find((b) => b.kind === 'question')!;
  g.bump(b);
  g.bump(b);
  assert.equal(g.state.coins, 1);
  assert.equal(g.world.questions[b.id!].used, true);
  assert.equal(g.world.questions[b.id!].mesh.material, g.spentBlockMaterial);
});
void test('descending onto a Goomba stomps it; walking into one costs a life', () => {
  const g = game();
  const e = g.world.enemies[0];
  g.player.x = e.x;
  g.player.z = e.z;
  g.player.y = 1.08;
  g.player.vy = -7;
  for (let i = 0; i < 4; i++) g.simulate(1 / 120);
  assert.equal(e.alive, false);
  assert.equal(g.state.lives, 3);
  assert.ok(g.player.vy > 0);
  assert.equal(g.state.score, 200);
  const h = game();
  const f = h.world.enemies[0];
  h.player.x = f.x;
  h.player.z = f.z;
  h.simulate(1 / 120);
  assert.equal(h.state.lives, 2);
  assert.equal(h.player.z, 13);
});
void test('the latest 3D checkpoint is retained after falling and time-out renews the timer', () => {
  const g = game();
  const cp = g.world.level.checkpoints![1];
  Object.assign(g.player, cp);
  g.simulate(1 / 120);
  assert.equal(g.checkpoint, true);
  assert.equal(g.checkpointIndex, 1);
  g.player.y = -11;
  g.simulate(1 / 120);
  assert.equal(g.player.z, cp.z);
  assert.equal(g.state.lives, 2);
  g.remaining = 0.001;
  g.simulate(1 / 120);
  assert.equal(g.remaining, g.world.level.time);
  assert.equal(g.state.lives, 1);
});
void test('losing the last life ends play and reaching the flag wins with bonus', () => {
  const g = game();
  g.state.lives = 1;
  g.lose('fall');
  assert.equal(g.state.status, 'over');
  assert.equal(g.state.lives, 0);
  const h = game();
  Object.assign(h.player, h.world.level.goal);
  h.player.x += 1;
  h.simulate(1 / 120);
  assert.equal(h.state.status, 'clear');
  assert.ok(h.state.score >= 2700);
});

void test('restart resets the whole course, including used blocks and defeated enemies', () => {
  const g = game();
  g.world.coins[0].taken = true;
  g.world.coins[0].mesh.visible = false;
  g.world.enemies[0].alive = false;
  g.bump(g.world.boxes.find((b) => b.kind === 'question')!);
  g.state.lives = 1;
  g.remaining = 5;
  g.checkpoint = true;
  g.restart(false);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.coins, 0);
  assert.equal(g.state.lives, 3);
  assert.equal(g.remaining, g.world.level.time);
  assert.equal(g.player.z, 13);
  assert.equal(g.checkpoint, false);
  assert.ok(g.world.coins.every((c) => !c.taken && c.mesh.visible));
  assert.ok(g.world.enemies.every((e) => e.alive));
  assert.ok(
    g.world.questions.every(
      (q) => !q.used && q.mesh.material === q.originalMaterial,
    ),
  );
});

void test('jump height is sufficient to land on floating blocks and the tallest pipe', () => {
  for (const height of [3.725, 3.5]) {
    const p = {
      ...newPlayer(),
      x: 0,
      z: 0,
      vx: 7.1,
      vy: JUMP_SPEED,
      grounded: false,
    };
    const platform = { x: 4, y: height / 2, z: 0, w: 2, h: height, d: 2 };
    let landed = false;
    for (let i = 0; i < 100; i++) {
      stepPlayer(p, [ground, platform], 1 / 120);
      if (p.grounded && p.y === height) {
        landed = true;
        break;
      }
    }
    assert.ok(landed, `Could not reach a ${height}-unit platform`);
  }
});

void test('RTX material changes restore exactly without undoing collected coins or used blocks', () => {
  const g = game();
  const serialize = (m: THREE.MeshStandardMaterial) =>
    JSON.stringify({
      color: m.color,
      roughness: m.roughness,
      metalness: m.metalness,
      envMapIntensity: m.envMapIntensity,
      emissive: m.emissive,
      emissiveIntensity: m.emissiveIntensity,
      map: m.map?.uuid,
    });
  const materials = new Map<THREE.MeshStandardMaterial, string>();
  g.scene.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m instanceof THREE.MeshStandardMaterial)
          materials.set(m, serialize(m));
  });
  const restore = enhanceMaterials(g.scene);
  const gold = [...materials.keys()].find(
    (m) => m.color.getHexString() === 'ffca2d',
  )!;
  assert.equal(gold.metalness, 0.82);
  const c = g.world.coins[0];
  g.player.x = c.x;
  g.player.z = c.z;
  g.simulate(1 / 120);
  g.bump(g.world.boxes.find((b) => b.kind === 'question')!);
  const position = { ...g.player },
    state = { ...g.state };
  restore();
  for (const [m, original] of materials) assert.equal(serialize(m), original);
  assert.deepEqual(g.player, position);
  assert.deepEqual(g.state, state);
  assert.equal(c.taken, true);
  assert.equal(c.mesh.visible, false);
  assert.equal(g.world.questions[0].mesh.material, g.spentBlockMaterial);
  // A second enable/disable cycle must not accumulate material changes.
  enhanceMaterials(g.scene)();
  for (const [m, original] of materials) assert.equal(serialize(m), original);
});

void test('RTX resolution respects device density and the two-million-pixel budget', () => {
  for (const [w, h, dpr] of [
    [390, 844, 3],
    [1920, 1080, 2],
    [3840, 2160, 2],
    [1280, 720, 1],
  ]) {
    const ratio = graphicsPixelRatio(w, h, dpr);
    assert.ok(ratio <= dpr && ratio <= 1.5);
    assert.ok(w * h * ratio ** 2 <= 2_000_001);
  }
  assert.equal(graphicsPixelRatio(1280, 720, 1), 1);
});

void test('turning RTX off disposes effects without resetting a paused course', async () => {
  const g = game();
  let disposed = 0;
  Object.assign(g, {
    graphicsRequest: 0,
    rtx: {
      dispose() {
        disposed++;
      },
    },
  });
  g.state.status = 'paused';
  g.state.coins = 7;
  g.state.lives = 2;
  g.remaining = 93;
  g.player.z = -65;
  g.checkpoint = true;
  const state = { ...g.state },
    player = { ...g.player };
  assert.equal(await g.setRtx(false), false);
  assert.equal(disposed, 1);
  assert.equal(g.rtx, null);
  assert.deepEqual(g.state, state);
  assert.deepEqual(g.player, player);
  assert.equal(g.remaining, 93);
  assert.equal(g.checkpoint, true);
});

void test('a cancelled or destroyed RTX request never initializes the graphics pipeline', async () => {
  const g = game();
  Object.assign(g, { graphicsRequest: 0, rtx: null, running: true });
  const pending = g.setRtx(true);
  await g.setRtx(false);
  assert.equal(await pending, false);
  assert.equal(g.rtx, null);
  assert.equal(g.state.notice, '');
  const destroyed = g.setRtx(true);
  g.running = false;
  assert.equal(await destroyed, false);
  assert.equal(g.rtx, null);
  assert.equal(g.state.notice, '');
});

void test('unsupported enhanced graphics retain the original scene and playable course', async () => {
  const g = game();
  Object.assign(g, { graphicsRequest: 0, rtx: null, running: true });
  Object.assign(g.renderer, { extensions: { has: () => false } });
  const player = { ...g.player },
    background = g.scene.background,
    materials = g.world.questions.map((q) => q.mesh.material);
  assert.equal(await g.setRtx(true), false);
  assert.equal(g.rtx, null);
  assert.deepEqual(g.player, player);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.scene.background, background);
  assert.deepEqual(
    g.world.questions.map((q) => q.mesh.material),
    materials,
  );
  assert.match(g.state.notice, /Classic graphics are still on/);
});

void test('thin walls stop high-speed movement even across a slow frame', () => {
  const p = { ...newPlayer(), x: 0, z: 0, vx: 80 };
  const wall = { x: 2, y: 4, z: 0, w: 0.04, h: 8, d: 20 };
  stepPlayer(p, [ground, wall], 0.12);
  assert.ok(p.x < 1.65);
});
void test('landing chooses the highest crossed surface regardless of box order', () => {
  const high = { x: 0, y: 1, z: 0, w: 4, h: 2, d: 4 },
    low = { x: 0, y: 0.5, z: 0, w: 4, h: 1, d: 4 };
  for (const boxes of [
    [high, low],
    [low, high],
  ]) {
    const p = { ...newPlayer(), z: 0, y: 3, vy: -80, grounded: false };
    stepPlayer(p, boxes, 0.05);
    assert.equal(p.y, 2);
  }
});
void test('campaign contains 24 long, unique courses, 72 star coins and four safe checkpoints each', () => {
  assert.equal(LEVELS.length, 24);
  assert.equal(new Set(LEVELS.map((l) => l.name)).size, 24);
  assert.equal(
    LEVELS.reduce((n, l) => n + l.stars.length, 0),
    72,
  );
  for (const l of LEVELS) {
    assert.ok(l.spawn.z - l.goal.z > 1000, l.name);
    assert.equal(l.checkpoints?.length, 4);
    assert.equal(l.stars.length, 3);
    for (const cp of [l.spawn, ...l.checkpoints!, l.goal])
      assert.ok(
        l.surfaces.some(
          (b) =>
            !b.moving &&
            Math.abs(b.y + b.h / 2 - cp.y) < 0.01 &&
            Math.abs(cp.x - b.x) < b.w / 2 - 0.34 &&
            Math.abs(cp.z - b.z) < b.d / 2 - 0.34,
        ),
        `${l.name}: unsupported safe point ${JSON.stringify(cp)}`,
      );
    for (const e of l.enemies)
      assert.ok(
        l.surfaces.some(
          (b) =>
            !b.moving &&
            Math.abs(b.y + b.h / 2 - e.y) < 0.01 &&
            Math.abs(e.x - b.x) < b.w / 2 &&
            Math.abs(e.z - b.z) < b.d / 2,
        ),
        `${l.name}: enemy has no floor`,
      );
  }
});
void test('walking forward or along either edge cannot bypass the first full-width gap', () => {
  const l = LEVELS[0],
    floor = l.surfaces[0];
  for (const x of [-5.5, 0, 5.5]) {
    const p = { ...newPlayer(), x, z: floor.z - floor.d / 2 + 0.3, vz: -7.1 };
    step(p, l.surfaces, 1.1);
    assert.ok(p.y < -5, `Gap bypass at x=${x}`);
  }
});
void test('all course goals are connected by jumpable terrain, including ferry travel', () => {
  for (const level of LEVELS) {
    const surfaces = level.surfaces.map((b) => ({ ...b }));
    // Extents are the swept footprints of ferries; they can be ridden between edges.
    for (const s of surfaces)
      if (s.moving) {
        if (s.moving.axis === 'x') s.w += 2 * s.moving.distance;
        if (s.moving.axis === 'z') s.d += 2 * s.moving.distance;
      }
    const top = (b: (typeof surfaces)[number]) => b.y + b.h / 2;
    const contains = (
      b: (typeof surfaces)[number],
      point: { x: number; y: number; z: number },
    ) =>
      Math.abs(point.x - b.x) < b.w / 2 &&
      Math.abs(point.z - b.z) < b.d / 2 &&
      Math.abs(point.y - top(b)) < 0.1;
    const start = surfaces.findIndex((b) => contains(b, level.spawn)),
      end = surfaces.findIndex((b) => contains(b, level.goal));
    const reached = new Set([start]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const from of reached)
        for (const [to, b] of surfaces.entries()) {
          if (reached.has(to)) continue;
          const a = surfaces[from],
            dy = top(b) - top(a),
            discriminant = JUMP_SPEED ** 2 - 2 * 25 * dy;
          if (discriminant < 0) continue;
          const flight = (JUMP_SPEED + Math.sqrt(discriminant)) / 25;
          const gapX = Math.max(0, Math.abs(a.x - b.x) - (a.w + b.w) / 2 + 0.7),
            gapZ = Math.max(0, Math.abs(a.z - b.z) - (a.d + b.d) / 2 + 0.7);
          if (Math.hypot(gapX, gapZ) < 10.8 * flight - 0.5) {
            reached.add(to);
            changed = true;
          }
        }
    }
    assert.ok(reached.has(end), `${level.name}: the finish is unreachable`);
    for (const cp of level.checkpoints!)
      assert.ok(
        surfaces.some((b, i) => reached.has(i) && contains(b, cp)),
        `${level.name}: checkpoint not reachable`,
      );
    for (const star of level.stars)
      assert.ok(
        surfaces.some(
          (b, i) =>
            reached.has(i) &&
            Math.abs(star.x - b.x) < b.w / 2 + 0.4 &&
            Math.abs(star.z - b.z) < b.d / 2 + 0.4 &&
            star.y - top(b) < JUMP_SPEED ** 2 / 50 + HEIGHT,
        ),
        `${level.name}: star coin is out of reach`,
      );
  }
});
void test('moving platforms carry a grounded player and stop exactly while paused', () => {
  const g = game(2),
    platform = g.world.platforms[0],
    b = platform.box;
  g.player = { ...newPlayer(), x: b.x, y: b.y + b.h / 2, z: b.z };
  const before = { x: g.player.x, y: g.player.y, z: g.player.z };
  g.simulate(1 / 120);
  assert.ok(Math.abs(g.player[platform.axis] - before[platform.axis]) > 0);
  assert.equal(g.player.grounded, true);
  g.pause();
  const position = { ...g.player },
    platformPosition = { ...b };
  g.simulate(1);
  assert.deepEqual(g.player, position);
  assert.deepEqual(b, platformPosition);
});
void test('enemies can be stomped on elevated platforms', () => {
  const g = game(1),
    e = g.world.enemies.find((e) => e.y >= 2 && e.kind === 'goomba')!;
  g.player = {
    ...newPlayer(),
    x: e.x,
    y: e.y + 1.08,
    z: e.z,
    vy: -7,
    grounded: false,
  };
  g.simulate(1 / 120);
  assert.equal(e.alive, false);
  assert.equal(g.state.lives, 3);
});
void test('Koopas enter a shell, then a second stomp defeats them', () => {
  const g = game(),
    e = g.world.enemies.find((e) => e.kind === 'koopa')!;
  g.player = {
    ...newPlayer(),
    x: e.x,
    y: e.y + 1.34,
    z: e.z,
    vy: -8,
    grounded: false,
  };
  g.simulate(1 / 120);
  assert.equal(e.shell, true);
  assert.equal(e.alive, true);
  e.stun = 0;
  g.player = {
    ...newPlayer(),
    x: e.x,
    y: e.y + 0.52,
    z: e.z,
    vy: -8,
    grounded: false,
  };
  g.simulate(1 / 120);
  assert.equal(e.alive, false);
});
void test('power-up blocks yield a collectible only once and mushroom absorbs a hit', () => {
  const g = game();
  const b = g.world.boxes.find(
    (b) =>
      b.kind === 'question' && g.world.questions[b.id!].reward === 'mushroom',
  )!;
  g.bump(b);
  g.bump(b);
  const q = g.world.questions[b.id!],
    pickup = g.world.pickups[q.powerIndex];
  assert.equal(pickup.active, true);
  assert.equal(g.state.coins, 0);
  g.player = {
    ...newPlayer(),
    x: pickup.x,
    y: pickup.y - 0.2,
    z: pickup.z,
    grounded: false,
  };
  g.simulate(1 / 120);
  assert.equal(g.state.power, 'super');
  assert.equal(pickup.taken, true);
  g.lose('goomba');
  assert.equal(g.state.lives, 3);
  assert.equal(g.state.power, 'small');
  g.lose('goomba');
  assert.equal(g.state.lives, 3);
});
void test('star power blocks contact and fire damage but never protects from falling', () => {
  const g = game();
  g.starTime = 10;
  g.lose('fire');
  g.lose('goomba');
  assert.equal(g.state.lives, 3);
  g.lose('fall');
  assert.equal(g.state.lives, 2);
  assert.equal(g.starTime, 0);
});
void test('fifty coins grant a life; retries cannot accumulate coins or score', () => {
  const g = game();
  for (let i = 0; i < 50; i++) g.collect();
  assert.equal(g.state.lives, 4);
  assert.equal(g.state.campaignCoins, 50);
  g.restart(false);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.campaignCoins, 0);
  assert.equal(g.state.lives, 3);
});
void test('fireballs damage enemies, bounce from terrain, and respect solid walls', () => {
  const g = game();
  g.projectile(0, 0.2, 10, 0, -4, -18);
  g.updateProjectiles(1 / 120);
  g.updateProjectiles(1 / 120);
  assert.ok(g.projectiles[0].vy > 0);
  g.clearProjectiles();
  const e = g.world.enemies[0];
  g.projectile(e.x, e.y + 0.7, e.z + 0.1, 0, 0, -18);
  g.updateProjectiles(1 / 120);
  assert.equal(e.alive, false);
  assert.equal(g.projectiles.length, 0);
  g.world.boxes.push({ x: 0, y: 1, z: 10, w: 4, h: 2, d: 1 });
  g.projectile(0, 1, 10, 0, 0, -18);
  g.updateProjectiles(1 / 120);
  assert.equal(g.projectiles.length, 0);
});
void test('Bowser blocks the finish, requires separate hits and opens a solid gate', () => {
  const g = game(23),
    b = g.world.boss!;
  g.win();
  assert.equal(g.state.status, 'playing');
  g.hitBoss();
  g.hitBoss();
  assert.equal(b.health, 2);
  b.hurt = 0;
  g.hitBoss();
  b.hurt = 0;
  g.hitBoss();
  assert.equal(b.alive, false);
  assert.equal(g.world.gateBox?.active, false);
  g.win();
  assert.equal(g.state.status, 'won');
});
void test('checkpoints cannot trigger in midair, below a ledge, or move backwards', () => {
  const g = game(),
    cp = g.world.level.checkpoints![1];
  Object.assign(g.player, cp, { y: cp.y - 3, grounded: false });
  g.simulate(1 / 120);
  assert.equal(g.checkpoint, false);
  Object.assign(g.player, cp, { grounded: true, vy: 0 });
  g.simulate(1 / 120);
  assert.equal(g.checkpointIndex, 1);
  Object.assign(g.player, g.world.level.checkpoints![0]);
  g.simulate(1 / 120);
  assert.equal(g.checkpointIndex, 1);
});
void test('campaign transitions preserve lives, power and score, and the final course wins', () => {
  const g = game();
  g.state.power = 'fire';
  g.state.coins = g.state.total;
  g.courseTime = 100;
  g.win();
  const score = g.state.score;
  assert.equal(g.state.status, 'clear');
  assert.equal(g.save.unlocked, 1);
  assert.ok(g.save.records[0].coinMedal);
  assert.ok(g.save.records[0].speedMedal);
  assert.ok(g.save.records[0].cleanMedal);
  g.nextLevel(false);
  assert.equal(g.state.level, 1);
  assert.equal(g.state.status, 'playing');
  assert.equal(g.state.score, score);
  assert.equal(g.state.power, 'fire');
  assert.equal(g.state.lives, 4);
  assert.equal(g.state.coins, 0);
  assert.equal(g.checkpoint, false);
  g.selectLevel(23, false);
  assert.equal(g.state.level, 1, 'Locked levels must stay locked');
});
void test('saved unlocks, star masks and best times survive reload; damaged saves fail safely', () => {
  storage.clear();
  const save = freshProgress();
  save.records[0] = {
    cleared: true,
    stars: 5,
    score: 9000,
    bestTime: 173,
    coinMedal: true,
    speedMedal: true,
    cleanMedal: false,
  };
  save.unlocked = 1;
  saveProgress(save);
  assert.deepEqual(readProgress(), save);
  storage.set('mario-first-person.campaign.v2', 'broken');
  assert.equal(readProgress().unlocked, 0);
  storage.set(
    'mario-first-person.campaign.v2',
    JSON.stringify({
      version: 2,
      unlocked: 999,
      records: [{ cleared: false, stars: 999, score: -2, bestTime: -3 }],
    }),
  );
  const safe = readProgress();
  assert.equal(safe.unlocked, 0);
  assert.equal(safe.records[0].stars, 7);
  assert.equal(safe.records[0].score, 0);
  storage.clear();
});
