import { moveGroundEnemy } from '../app/game/enemy-motion';
import { FORWARD_SCALE } from '../app/game/spatial-layout';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  newPlayer,
  stepPlayer,
  JUMP_SPEED,
  HEIGHT,
  SMALL_HEIGHT,
  playerHeight,
  type Box,
} from '../app/game/physics';
import { GameEngine, initialSnapshot } from '../app/game/engine';
import { makeWorld } from '../app/game/world';
import {
  LEVELS,
  MAP_UNIT,
  AREA_SPACING,
} from '../app/game/levels';
import {
  freshProgress,
  readProgress,
  saveProgress,
} from '../app/game/progress';
import { enhanceMaterials, graphicsPixelRatio } from '../app/game/graphics';
const ground: Box = { x: 0, y: -1, z: 0, w: 30, h: 2, d: 30 };
const step = (
  p: ReturnType<typeof newPlayer>,
  boxes: Box[],
  seconds: number,
) => {
  for (let t = 0; t < seconds; t += 1 / 120) stepPlayer(p, boxes, 1 / 120);
};
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
    getItem: (k: string) => storage.get(k) || null,
    setItem: (k: string, v: string) => storage.set(k, v),
  },
});
function game(index = 0): GameEngine {
  const scene = new THREE.Scene(),
    world = makeWorld(scene, undefined, LEVELS[index]),
    save = freshProgress();
  for (let i = 0; i < index; i++) save.records[i].cleared = true;
  save.unlocked = index;
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
    camera: new THREE.PerspectiveCamera(),
    player: { ...newPlayer(), ...world.level.spawn, height: SMALL_HEIGHT },
    state: { ...initialSnapshot(), status: 'playing', level: index },
    save,
    remaining: world.level.time,
    keys: new Set<string>(),
    touch: { x: 0, y: 0 },
    yaw: 0,
    pitch: 0,
    jumpBuffer: 0,
    jumpHeld: false,
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
    area: world.level.startArea,
    portalCooldown: 0,
    mazePassed: new Set<string>(),
    cannonClocks: [],
    bridgeDown: false,
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
  g.updateLevelState();
  return g;
}
void test('standing stays grounded; a full jump lands cleanly', () => {
  const p = newPlayer();
  step(p, [ground], 2);
  assert.equal(p.y, 0);
  p.vy = JUMP_SPEED;
  p.grounded = false;
  step(p, [ground], 0.45);
  assert.ok(p.y > 3.7 && p.y < 4);
  step(p, [ground], 1);
  assert.equal(p.y, 0);
  assert.equal(p.vy, 0);
});
void test('pipe sides and block undersides are solid', () => {
  const p = { ...newPlayer(), z: 0, vx: 7 };
  step(p, [ground, { x: 2, y: 1.5, z: 0, w: 2, h: 3, d: 2 }], 1);
  assert.ok(p.x <= 0.660001);
  const q = { ...newPlayer(), z: 0, vy: JUMP_SPEED, grounded: false };
  let hits = 0;
  stepPlayer(
    q,
    [ground, { x: 0, y: 3, z: 0, w: 2, h: 1, d: 2 }],
    0.2,
    () => hits++,
  );
  assert.equal(hits, 1);
});
void test('high-speed movement cannot tunnel through a thin wall', () => {
  const p = { ...newPlayer(), x: 0, z: 0, vx: 80 };
  stepPlayer(p, [ground, { x: 2, y: 4, z: 0, w: 0.04, h: 8, d: 20 }], 0.12);
  assert.ok(p.x < 1.65);
});
void test('landing selects the highest crossed surface regardless of order', () => {
  const a = { x: 0, y: 1, z: 0, w: 4, h: 2, d: 4 },
    b = { x: 0, y: 0.5, z: 0, w: 4, h: 1, d: 4 };
  for (const boxes of [
    [a, b],
    [b, a],
  ]) {
    const p = { ...newPlayer(), z: 0, y: 3, vy: -80, grounded: false };
    stepPlayer(p, boxes, 0.05);
    assert.equal(p.y, 2);
  }
});
void test('small Mario fits a one-tile passage; tall Mario is blocked', () => {
  const ceiling = { x: 2, y: 1.35, z: 0, w: 2, h: 0.9, d: 5 };
  const small = { ...newPlayer(), z: 0, vx: 4, height: SMALL_HEIGHT },
    big = { ...newPlayer(), z: 0, vx: 4, height: HEIGHT };
  step(small, [ground, ceiling], 0.8);
  step(big, [ground, ceiling], 0.8);
  assert.ok(small.x > 3);
  assert.ok(big.x < 1);
});
void test('hidden blocks do not block walking but can be revealed from below', () => {
  const b: Box = { x: 0, y: 2, z: 0, w: 3, h: 0.9, d: 0.9, hidden: true };
  const p = {
    ...newPlayer(),
    z: 0,
    y: 0,
    vy: 10,
    grounded: false,
    height: SMALL_HEIGHT,
  };
  let hits = 0;
  for (let i = 0; i < 70; i++)
    stepPlayer(p, [ground, b], 1 / 120, () => {
      hits++;
      b.hidden = false;
    });
  assert.equal(hits, 1);
});
void test('all 32 NES courses, eight worlds and 63 areas are present', () => {
  assert.equal(LEVELS.length, 32);
  assert.equal(
    LEVELS.reduce((n, l) => n + l.areas.length, 0),
    63,
  );
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, 32);
  for (const [i, l] of LEVELS.entries()) {
    assert.equal(l.id, `${Math.floor(i / 4) + 1}–${(i % 4) + 1}`);
    assert.equal(l.world, Math.floor(i / 4));
    assert.equal(l.stars.length, 0);
    assert.equal(l.referenceId, l.id.replace('–', '-'));
  }
});
void test('World 1-1 follows the reference question block, pipes, Goomba and first pit', () => {
  const l = LEVELS[0];
  assert.deepEqual(
    l.pipes
      .filter((p) => p.area === 0)
      .slice(0, 4)
      .map((p) => p.sourceX),
    [224, 304, 368, 456],
  );
  assert.deepEqual(
    l.pipes
      .filter((p) => p.area === 0)
      .slice(0, 4)
      .map((p) => Math.round(p.height / MAP_UNIT)),
    [16, 24, 32, 32],
  );
  assert.ok(l.blocks.some((b) => b.sourceX === 128 && b.sourceY === 32));
  assert.ok(l.enemies.some((e) => e.sourceX === 176 && e.kind === 'goomba'));
  const startLand = l.surfaces.filter(
    (s) => s.area === 0 && s.sourceX === 0 && s.style === 'ground',
  );
  assert.ok(
    Math.abs(
      startLand.reduce((n, s) => n + s.d, 0) - 552 * MAP_UNIT * FORWARD_SCALE,
    ) < 0.00001,
  );
  assert.ok(l.surfaces.some((s) => s.area === 0 && s.sourceX === 568));
});
void test('underwater, athletic, bridge and castle courses retain their original mechanics', () => {
  assert.equal(LEVELS[5].kind, 'Underwater');
  assert.equal(LEVELS[26].kind, 'Bridge');
  assert.equal(LEVELS[30].kind, 'Overworld');
  assert.ok(
    LEVELS[2].surfaces.some((s) => s.style === 'tree' && s.sourceX === 144),
  );
  assert.ok(LEVELS[5].enemies.some((e) => e.kind === 'blooper'));
  assert.equal(LEVELS[15].mazeRoutes.length, 2);
  assert.equal(LEVELS[27].mazeRoutes.length, 5);
  assert.equal(LEVELS[31].areas.length, 5);
  assert.ok(LEVELS[31].portals.some((p) => p.area === 3 && p.targetArea === 4));
});
void test('timer corrections match the annotated original maps', () => {
  assert.equal(LEVELS[8].time, 400);
  assert.equal(LEVELS[15].time, 400);
  assert.equal(LEVELS[16].time, 300);
});
void test('every area is reachable through its source pipes or vines and has a path back', () => {
  for (const l of LEVELS) {
    const reached = new Set([l.startArea]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of l.portals)
        if (
          p.warpLevel === undefined &&
          reached.has(p.area) &&
          !reached.has(p.targetArea)
        ) {
          reached.add(p.targetArea);
          changed = true;
        }
    }
    assert.equal(
      reached.size,
      l.areas.length,
      `${l.id}: unreachable bonus area`,
    );
    for (const p of l.portals) {
      assert.ok(l.areas[p.targetArea]);
      assert.ok([p.target.x, p.target.y, p.target.z].every(Number.isFinite));
    }
    assert.ok(reached.has(l.goalArea));
  }
});
void test('all visible terrain has finite positive collision bounds', () => {
  for (const l of LEVELS)
    for (const b of l.surfaces) {
      assert.ok([b.x, b.y, b.z, b.w, b.h, b.d].every(Number.isFinite), l.id);
      assert.ok(b.w > 0 && b.h > 0 && b.d > 0, l.id);
      assert.ok(b.w >= 0.9);
    }
});
void test('outdoor islands allow real lateral movement and have open cliff edges', () => {
  const l = LEVELS[0];
  assert.ok(l.walls.every((w) => w.kind !== 'boundary'));
  assert.ok(l.surfaces.some((s) => s.w >= 12));
  const p = { ...newPlayer(), ...l.spawn, vx: 7 };
  step(p, [...l.surfaces, ...l.walls], 0.55);
  assert.ok(p.x > 3.5);
  assert.equal(p.grounded, true);
  step(p, [...l.surfaces, ...l.walls], 1);
  assert.ok(p.x > 9);
  assert.equal(p.grounded, false);
  assert.ok(p.y < 0);
});
void test('walking cannot bypass an original full-width pit or a pipe crossing', () => {
  const l = LEVELS[0];
  for (const x of [-5, 0, 5]) {
    const p = {
      ...newPlayer(),
      x,
      z: 13 - 550 * MAP_UNIT * FORWARD_SCALE,
      vz: -7.1,
    };
    step(p, [...l.surfaces, ...l.walls], 0.7);
    assert.ok(p.y < -0.5);
  }
  const g = game(),
    pipe = l.pipes.find((p) => p.area === 0)!;
  for (const side of [-1, 1]) {
    const p = {
      ...newPlayer(),
      x: pipe.x + side * 1.56,
      z: pipe.z + 3,
      vz: -7.1,
    };
    step(p, g.world.boxes, 0.8);
    assert.ok(p.y < -0.5);
  }
  const jumping = {
    ...newPlayer(),
    x: pipe.x + 1.56,
    z: pipe.z + 3,
    vz: -7.1,
    vy: JUMP_SPEED,
    grounded: false,
  };
  step(jumping, g.world.boxes, 1.2);
  assert.equal(jumping.grounded, true);
});
void test('blocks are cubic, pipes are circular and elevated routes vary laterally', () => {
  for (const l of LEVELS) {
    for (const q of l.blocks) {
      assert.equal(q.w, q.h);
      assert.equal(q.h, q.d);
    }
    for (const p of l.pipes) assert.equal(p.w, p.d);
  }
  const platforms = LEVELS[2].surfaces.filter(
    (s) => s.style === 'tree' || s.moving,
  );
  assert.ok(new Set(platforms.map((s) => s.x)).size >= 4);
  assert.ok(platforms.every((s) => s.w >= 4));
});
void test('coins collect only once at their reference positions', () => {
  const g = game(),
    c = g.world.coins[0];
  g.enterArea(Math.round(c.x / AREA_SPACING), { x: c.x, y: c.y - 0.3, z: c.z });
  g.simulate(1 / 120);
  g.simulate(1 / 120);
  assert.equal(g.state.coins, 1);
  assert.equal(c.taken, true);
});
void test('single-coin blocks pay once; multi-coin bricks have a finite supply', () => {
  const g = game(),
    single = g.world.questions.find(
      (q) => q.reward === 'coin' && q.remaining === 1,
    )!;
  g.bump(single.box);
  g.bump(single.box);
  assert.equal(g.state.coins, 1);
  assert.equal(single.used, true);
  const multi = g.world.questions.find(
    (q) => q.reward === 'coin' && q.remaining === 10,
  )!;
  for (let i = 0; i < 12; i++) g.bump(multi.box);
  assert.equal(g.state.coins, 11);
  assert.equal(multi.remaining, 0);
});
void test('hidden blocks become visible on a head bump and bricks require a power-up', () => {
  const g = game(),
    q = g.world.questions.find((q) => q.box.hidden)!;
  assert.equal(q.mesh.visible, false);
  g.bump(q.box);
  assert.equal(q.mesh.visible, true);
  assert.equal(q.box.hidden, false);
  const b = g.world.bricks[0];
  g.bump(b.box);
  assert.notEqual(b.box.active, false);
  g.state.power = 'super';
  g.bump(b.box);
  assert.equal(b.box.active, false);
  assert.equal(b.mesh.visible, false);
});
void test('upgrade blocks spawn a mushroom for small Mario and a flower for Super Mario', () => {
  for (const [power, wanted] of [
    ['small', 'mushroom'],
    ['super', 'flower'],
  ] as const) {
    const g = game();
    g.state.power = power;
    const q = g.world.questions.find((q) => q.reward === 'upgrade')!;
    g.bump(q.box);
    const item = g.world.pickups[q.powerIndex];
    assert.equal(item.kind, wanted);
    assert.equal(item.active, true);
    g.enterArea(0, { x: item.x, y: item.y - 0.3, z: item.z });
    g.simulate(1 / 120);
    assert.equal(g.state.power, power === 'small' ? 'super' : 'fire');
  }
});
void test('descending onto a Goomba stomps it; walking into one costs a life', () => {
  const g = game(),
    e = g.world.enemies[0];
  g.player = {
    ...newPlayer(),
    x: e.x,
    y: e.y + 1.08,
    z: e.z,
    vy: -7,
    grounded: false,
    height: SMALL_HEIGHT,
  };
  g.simulate(1 / 120);
  assert.equal(e.alive, false);
  assert.equal(g.state.lives, 3);
  const h = game(),
    f = h.world.enemies[0];
  h.player = { ...newPlayer(), x: f.x, y: f.y, z: f.z, height: SMALL_HEIGHT };
  h.simulate(1 / 120);
  assert.equal(h.state.lives, 2);
  assert.equal(h.player.z, h.world.level.spawn.z);
});
void test('power-ups absorb one hit and stars protect against fire, but not falls', () => {
  const g = game();
  g.state.power = 'super';
  g.lose('goomba');
  assert.equal(g.state.lives, 3);
  assert.equal(g.state.power, 'small');
  g.lose('goomba');
  assert.equal(g.state.lives, 3);
  g.invulnerable = 0;
  g.starTime = 10;
  g.lose('fire');
  assert.equal(g.state.lives, 3);
  g.lose('fall');
  assert.equal(g.state.lives, 2);
  assert.equal(g.starTime, 0);
});
void test('underwater movement swims upward and stops at the surface', () => {
  const g = game(5),
    a = g.world.level.areas[1];
  g.enterArea(1, { ...a.spawn, y: 2 });
  g.jump();
  for (let i = 0; i < 90; i++) g.simulate(1 / 120);
  assert.ok(g.player.y > 2.5);
  assert.equal(g.state.underwater, true);
  g.releaseJump();
  assert.equal(g.jumpHeld, false);
  g.player.y = 12;
  g.simulate(1 / 120);
  assert.ok(g.player.y + playerHeight(g.player) <= 9.40001);
});
void test('the 1-1 bonus pipe returns to its original exit pipe', () => {
  const g = game(),
    entry = g.world.level.portals.find((p) => p.area === 0)!;
  g.enterArea(entry.area, entry);
  g.portalCooldown = 0;
  g.interact();
  assert.equal(g.area, 1);
  const exit = g.world.level.portals.find((p) => p.area === 1)!;
  g.enterArea(1, exit);
  g.portalCooldown = 0;
  g.interact();
  assert.equal(g.area, 0);
  assert.deepEqual(
    { x: g.player.x, y: g.player.y, z: g.player.z },
    exit.target,
  );
});
void test('warp pipes cannot unlock or enter an uncleared future world', () => {
  const g = game(1),
    warp = g.world.level.portals.find((p) => p.warpLevel !== undefined)!;
  g.enterArea(warp.area, warp);
  g.portalCooldown = 0;
  g.interact();
  assert.equal(g.state.level, 1);
  assert.equal(g.save.unlocked, 1);
  assert.match(g.state.notice, /locked/);
});
void test('moving platforms carry the player without an initial teleport and freeze on pause', () => {
  const g = game(2),
    m = g.world.platforms[0],
    b = m.box;
  g.player = {
    ...newPlayer(),
    x: b.x,
    y: b.y + b.h / 2,
    z: b.z,
    height: SMALL_HEIGHT,
  };
  const before = g.player.y;
  g.simulate(1 / 120);
  assert.ok(Math.abs(g.player.y - before) < 0.1);
  assert.equal(g.player.grounded, true);
  g.pause();
  const p = { ...g.player },
    box = { ...b };
  g.simulate(1);
  assert.deepEqual(g.player, p);
  assert.deepEqual(b, box);
});
void test('wrong castle passages loop; correct passages allow the exit', () => {
  const g = game(15),
    exit = g.world.level.mazeExits[0];
  g.player = {
    ...newPlayer(),
    x: g.world.level.areas[exit.area].center,
    y: 8,
    z: exit.z - 0.2,
    grounded: false,
    height: SMALL_HEIGHT,
  };
  g.invulnerable = 99;
  g.simulate(1 / 120);
  assert.ok(g.player.z > exit.z);
  for (const id of exit.requires) g.mazePassed.add(id);
  g.player.z = exit.z - 0.2;
  g.player.y = 8;
  g.simulate(1 / 120);
  assert.ok(g.player.z < exit.z);
});
void test('the axe drops the original castle bridge and permits a clear', () => {
  const g = game(3);
  g.enterArea(g.world.level.goalArea, g.world.level.goal);
  g.win();
  assert.equal(g.state.status, 'playing');
  g.dropBridge();
  assert.equal(g.world.boss?.alive, false);
  assert.ok(g.world.bridges.every((b) => b.box.active === false));
  g.win();
  assert.equal(g.state.status, 'clear');
  assert.equal(g.save.unlocked, 4);
});
void test('starting, pausing, dying and selecting locked courses never unlock anything', () => {
  const g = game();
  g.selectLevel(31, false);
  assert.equal(g.state.level, 0);
  g.pause();
  g.start(false);
  g.win();
  assert.equal(g.save.unlocked, 0);
  g.lose('fall');
  g.restart(false);
  assert.equal(g.save.unlocked, 0);
  assert.ok(g.save.records.every((r) => !r.cleared));
});
void test('clearing a course unlocks exactly the next one; replay does not skip ahead', () => {
  const g = game();
  g.enterArea(0, g.world.level.goal);
  g.win();
  assert.equal(g.save.unlocked, 1);
  assert.equal(g.state.status, 'clear');
  g.selectLevel(0, false);
  g.enterArea(0, g.world.level.goal);
  g.win();
  assert.equal(g.save.unlocked, 1);
  g.nextLevel(false);
  assert.equal(g.state.level, 1);
  assert.equal(g.save.records[1].cleared, false);
});
void test('all 32 courses can clear in sequence without losing progress', () => {
  const g = game();
  for (let i = 0; i < 32; i++) {
    assert.equal(g.state.level, i);
    if (g.world.boss) g.dropBridge();
    g.enterArea(g.world.level.goalArea, g.world.level.goal);
    g.win();
    assert.equal(g.save.records[i].cleared, true);
    assert.equal(g.save.unlocked, Math.min(31, i + 1));
    if (i < 31) g.nextLevel(false);
  }
  assert.equal(g.state.status, 'won');
});
void test('a hundred coins gives a life; restart rolls course earnings back', () => {
  const g = game();
  for (let i = 0; i < 100; i++) g.collect();
  assert.equal(g.state.lives, 4);
  g.restart(false);
  assert.equal(g.state.campaignCoins, 0);
  assert.equal(g.state.score, 0);
  assert.equal(g.state.lives, 3);
});
void test('completion survives reload and malformed saves cannot unlock courses', () => {
  storage.clear();
  const save = freshProgress();
  save.records[0] = {
    cleared: true,
    stars: 0,
    score: 9000,
    bestTime: 173,
    coinMedal: true,
    speedMedal: false,
    cleanMedal: false,
  };
  save.unlocked = 1;
  saveProgress(save);
  assert.deepEqual(readProgress(), save);
  storage.set(
    'mario-first-person.nes.v1',
    JSON.stringify({ version: 3, unlocked: 31, records: [] }),
  );
  assert.equal(readProgress().unlocked, 0);
  storage.set('mario-first-person.nes.v1', 'broken');
  assert.equal(readProgress().unlocked, 0);
  storage.clear();
});
void test('optional graphics material changes restore exactly', () => {
  const g = game();
  const materials = new Map<THREE.MeshStandardMaterial, string>();
  const serialize = (m: THREE.MeshStandardMaterial) =>
    JSON.stringify({
      roughness: m.roughness,
      metalness: m.metalness,
      emissive: m.emissive,
      emissiveIntensity: m.emissiveIntensity,
      env: m.envMapIntensity,
    });
  g.scene.traverse((o) => {
    if (o instanceof THREE.Mesh)
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (m instanceof THREE.MeshStandardMaterial)
          materials.set(m, serialize(m));
  });
  const restore = enhanceMaterials(g.scene);
  restore();
  for (const [m, s] of materials) assert.equal(serialize(m), s);
});
void test('RTX off disposes effects without resetting a paused level', async () => {
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
  const before = { ...g.state },
    player = { ...g.player };
  assert.equal(await g.setRtx(false), false);
  assert.equal(disposed, 1);
  assert.deepEqual(g.state, before);
  assert.deepEqual(g.player, player);
});
void test('cancelled or destroyed RTX loads never initialize the pipeline', async () => {
  const g = game();
  Object.assign(g, { graphicsRequest: 0, rtx: null, running: true });
  const pending = g.setRtx(true);
  await g.setRtx(false);
  assert.equal(await pending, false);
  const dead = g.setRtx(true);
  g.running = false;
  assert.equal(await dead, false);
});
void test('unsupported RTX preserves the playable world', async () => {
  const g = game();
  Object.assign(g, { graphicsRequest: 0, rtx: null, running: true });
  Object.assign(g.renderer, { extensions: { has: () => false } });
  assert.equal(await g.setRtx(true), false);
  assert.equal(g.state.status, 'playing');
  assert.match(g.state.notice, /Classic graphics/);
});
void test('RTX resolution stays inside its pixel budget', () => {
  for (const [w, h, dpr] of [
    [390, 844, 3],
    [1920, 1080, 2],
    [3840, 2160, 2],
  ]) {
    const r = graphicsPixelRatio(w, h, dpr);
    assert.ok(w * h * r * r <= 2_000_001);
    assert.ok(r <= 1.5 && r <= dpr);
  }
});

void test('castle loop destinations are supported and never embedded in a ceiling', () => {
  for (const l of LEVELS)
    for (const exit of l.mazeExits) {
      const p = exit.target;
      assert.ok(
        l.surfaces.some(
          (b) =>
            b.area === exit.area &&
            Math.abs(p.z - b.z) < b.d / 2 &&
            Math.abs(p.y - b.y - b.h / 2) < 0.02,
        ),
        `${l.id}: loop has no floor`,
      );
      assert.ok(
        !l.surfaces.some(
          (b) =>
            b.area === exit.area &&
            Math.abs(p.z - b.z) < b.d / 2 + 0.33 &&
            p.y + SMALL_HEIGHT > b.y - b.h / 2 + 0.01 &&
            p.y < b.y + b.h / 2 - 0.01,
        ),
        `${l.id}: loop intersects solid terrain`,
      );
    }
});

void test('Goombas occupy different lanes across the first course', () => {
  const enemies = LEVELS[0].enemies.filter(e => e.kind === 'goomba');
  assert.ok(new Set(enemies.map(e => e.x.toFixed(1))).size >= 5);
  assert.ok(enemies.some(e => e.x < -2) && enemies.some(e => e.x > 2));
  for (const level of LEVELS) for (const e of level.enemies) if (e.roam) {
    assert.ok(e.roam.minX <= e.x && e.x <= e.roam.maxX);
    assert.ok(e.roam.minZ <= e.roam.maxZ);
  }
});
void test('ground enemies intercept sideways movement, stay leashed and stop at walls and cliffs', () => {
  const g = game(), e = g.world.enemies.find(e => e.kind === 'goomba')!;
  const reset = () => Object.assign(e, { x: 0, y: 0, z: 0, homeX: 0, homeZ: 0, stun: 0, shell: false, roam: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 } });
  const floor = { x: 0, y: -1, z: 0, w: 12, h: 2, d: 12 };
  reset();
  for (let i = 0; i < 180; i++) moveGroundEnemy(e, { x: 4, y: 0, z: -3 }, [floor], 1 / 120, i / 120, 0);
  assert.ok(e.x > 1.5 && e.z < -1, 'Pursuit must move diagonally towards a sidestepping player');
  reset();
  const wall = { x: 2, y: 1, z: 0, w: 1, h: 2, d: 12 };
  for (let i = 0; i < 1200; i++) moveGroundEnemy(e, { x: 4, y: 0, z: 0 }, [floor, wall], 1 / 120, i / 120, 0);
  assert.ok(e.x < 1.2, 'Cannot pursue through a wall');
  reset();
  for (let i = 0; i < 1200; i++) moveGroundEnemy(e, { x: 4, y: 0, z: 0 }, [{ ...floor, w: 3 }], 1 / 120, i / 120, 0);
  assert.ok(e.x < 1.15, 'The entire footprint must remain supported at a cliff');
  reset();
  for (let i = 0; i < 3600; i++) moveGroundEnemy(e, { x: 100, y: 0, z: 100 }, [floor], 1 / 120, i / 120, 2);
  assert.ok(Math.abs(e.x) <= 5 && Math.abs(e.z) <= 5);
  g.world.dispose();
});
