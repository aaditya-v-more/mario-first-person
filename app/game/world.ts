import * as THREE from 'three';
import type { Box } from './physics';
import { createTextureCanvas } from './browser-runtime';
import { LEVELS, PALETTES, type Level, type Power } from './levels';
export type Coin = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  taken: boolean;
  star?: number;
};
export type Enemy = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  home: number;
  range: number;
  direction: number;
  alive: boolean;
  stompTime: number;
  kind: 'goomba' | 'koopa';
  shell: boolean;
  stun: number;
};
export type Question = {
  mesh: THREE.Mesh;
  used: boolean;
  baseY: number;
  bump: number;
  coin: THREE.Group;
  originalMaterial: THREE.Material;
  reward: 'coin' | Power;
  powerIndex: number;
};
export type Pickup = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  kind: Power;
  active: boolean;
  taken: boolean;
};
export type MovingPlatform = {
  mesh: THREE.Group;
  box: Box;
  axis: 'x' | 'y' | 'z';
  origin: number;
  distance: number;
  speed: number;
  phase: number;
};
export type Firebar = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  length: number;
  speed: number;
  angle: number;
};
export type Boss = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  home: number;
  health: number;
  cooldown: number;
  hurt: number;
  alive: boolean;
};
export type World = {
  root: THREE.Group;
  level: Level;
  boxes: Box[];
  coins: Coin[];
  enemies: Enemy[];
  questions: Question[];
  pickups: Pickup[];
  platforms: MovingPlatform[];
  firebars: Firebar[];
  boss?: Boss;
  clouds: THREE.Group[];
  flag: THREE.Mesh;
  flagGroup: THREE.Group;
  checkpoint: THREE.Group;
  checkpoints: THREE.Group[];
  decorations: THREE.Group;
  gate?: THREE.Mesh;
  gateBox?: Box;
  dispose: () => void;
};
const mat = (color: THREE.ColorRepresentation, roughness = 0.75) =>
  new THREE.MeshStandardMaterial({ color, roughness });

export function makeWorld(
  scene: THREE.Scene,
  textureCanvas: () => HTMLCanvasElement = createTextureCanvas,
  level: Level = LEVELS[0],
): World {
  const root = new THREE.Group();
  scene.add(root);
  const boxes: Box[] = [],
    coins: Coin[] = [],
    enemies: Enemy[] = [],
    questions: Question[] = [],
    pickups: Pickup[] = [],
    platforms: MovingPlatform[] = [],
    firebars: Firebar[] = [],
    clouds: THREE.Group[] = [];
  const palette = PALETTES[level.theme];
  const grass = mat(palette.ground),
    edge = mat(palette.edge),
    green = mat('#159341', 0.35),
    rim = mat('#24bf55', 0.3),
    darkGreen = mat('#0a5735'),
    brown = mat('#a55730'),
    cream = mat('#fff7db'),
    gold = mat('#ffca2d', 0.28),
    white = mat('#fffdfa'),
    dark = mat('#282b3b'),
    red = mat('#ef4e42');
  const decorations = new THREE.Group();
  root.add(decorations);
  const cubeGeo = new THREE.BoxGeometry(1, 1, 1),
    sphereGeo = new THREE.SphereGeometry(1, 16, 12);
  const allMaterials = new Set<THREE.Material>([
    grass,
    edge,
    green,
    rim,
    darkGreen,
    brown,
    cream,
    gold,
    white,
    dark,
    red,
  ]);
  function cube(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    m: THREE.Material,
    parent: THREE.Object3D = root,
    solid = false,
  ) {
    allMaterials.add(m);
    const mesh = new THREE.Mesh(cubeGeo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (solid) boxes.push({ x, y, z, w, h, d });
    return mesh;
  }
  function ball(
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    m: THREE.Material,
    parent: THREE.Object3D = root,
  ) {
    allMaterials.add(m);
    const mesh = new THREE.Mesh(sphereGeo, m);
    mesh.position.set(x, y, z);
    mesh.scale.set(sx, sy, sz);
    mesh.castShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function texture(draw: (ctx: CanvasRenderingContext2D) => void) {
    const c = textureCanvas();
    c.width = c.height = 128;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const soilTex = texture((c) => {
    c.fillStyle = '#a6633e';
    c.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 4; j++)
      for (let i = 0; i < 4; i++) {
        c.fillStyle = (i + j) % 2 ? '#bd8050' : '#9d5938';
        c.fillRect(i * 32 + 2, j * 32 + 2, 28, 28);
        c.fillStyle = '#ce9360';
        c.fillRect(i * 32 + 3, j * 32 + 3, 25, 3);
      }
  });
  soilTex.wrapS = soilTex.wrapT = THREE.RepeatWrapping;
  soilTex.repeat.set(4, 1);
  const soil = new THREE.MeshStandardMaterial({ map: soilTex, roughness: 1 });
  const brickTex = texture((c) => {
    c.fillStyle = '#633c32';
    c.fillRect(0, 0, 128, 128);
    for (let j = 0; j < 4; j++)
      for (let i = -1; i < 3; i++) {
        const x = i * 64 + (j % 2) * 32;
        c.fillStyle = '#bb7042';
        c.fillRect(x + 2, j * 32 + 2, 60, 28);
        c.fillStyle = '#e6a46c';
        c.fillRect(x + 3, j * 32 + 3, 58, 3);
      }
  });
  const brick = new THREE.MeshStandardMaterial({ map: brickTex });
  const qmat = new THREE.MeshStandardMaterial({
    map: texture((c) => {
      c.fillStyle = '#f6b92e';
      c.fillRect(0, 0, 128, 128);
      c.fillStyle = '#ffe379';
      c.fillRect(5, 5, 118, 5);
      c.fillRect(5, 5, 5, 118);
      c.fillStyle = '#ce8312';
      c.fillRect(5, 118, 118, 5);
      c.fillRect(118, 5, 5, 118);
      c.fillStyle = '#a5661a';
      for (const x of [15, 106])
        for (const y of [15, 106]) c.fillRect(x, y, 7, 7);
      c.font = '900 91px Arial';
      c.textAlign = 'center';
      c.fillStyle = '#ac6b16';
      c.fillText('?', 67, 103);
      c.fillStyle = '#fff0a8';
      c.fillText('?', 63, 99);
    }),
    roughness: 0.65,
  });
  const stone = mat(palette.ground),
    wood = mat('#c88849'),
    stripe = mat('#ffda63'),
    cloud = mat('#f7f2ef');
  [soil, brick, qmat, stone, wood, stripe, cloud].forEach((m) =>
    allMaterials.add(m),
  );
  for (const surface of level.surfaces) {
    const { x, y, z, w, h, d, style, moving } = surface;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    root.add(g);
    const material =
      style === 'brick'
        ? brick
        : style === 'wood'
          ? wood
          : style === 'cloud'
            ? cloud
            : style === 'stone'
              ? stone
              : soil;
    cube(0, -0.09, 0, w, h - 0.18, d, material, g);
    cube(
      0,
      h / 2 - 0.09,
      0,
      w,
      0.18,
      d,
      style === 'ground' ? grass : style === 'wood' ? stripe : edge,
      g,
    );
    const box = { x, y, z, w, h, d, kind: moving ? 'moving' : 'terrain' };
    boxes.push(box);
    if (moving) {
      platforms.push({
        mesh: g,
        box,
        axis: moving.axis,
        origin: box[moving.axis],
        distance: moving.distance,
        speed: moving.speed,
        phase: moving.phase || 0,
      });
      for (let i = 0; i < 5; i++)
        cube(
          -w / 2 + 0.45 + (i * (w - 0.9)) / 4,
          h / 2 + 0.008,
          0,
          0.14,
          0.016,
          d - 0.2,
          dark,
          g,
        );
    } else if (style === 'ground') {
      const tiles: THREE.Matrix4[] = [];
      for (let iz = 1; iz < d; iz += 2)
        for (let ix = 1; ix < w; ix += 2)
          if (((ix + iz) / 2) % 2 === 0)
            tiles.push(
              new THREE.Matrix4().compose(
                new THREE.Vector3(-w / 2 + ix, h / 2 + 0.006, -d / 2 + iz),
                new THREE.Quaternion(),
                new THREE.Vector3(Math.min(1.97, w), 0.012, 1.97),
              ),
            );
      const lawn = new THREE.InstancedMesh(cubeGeo, edge, tiles.length);
      tiles.forEach((m, i) => lawn.setMatrixAt(i, m));
      lawn.receiveShadow = true;
      g.add(lawn);
    }
    if (style === 'cloud')
      for (const side of [-1, 1])
        for (let j = 0; j < Math.ceil(d / 3); j++)
          ball(
            side * (w / 2 - 0.4),
            -0.5,
            -d / 2 + 1.5 + j * 3,
            1.1,
            0.7,
            1.6,
            cloud,
            g,
          );
  }
  for (const b of level.walls) {
    cube(b.x, b.y, b.z, b.w, b.h, b.d, stone, root, true);
    for (let z = b.z - b.d / 2 + 3; z < b.z + b.d / 2; z += 9) {
      cube(b.x * 0.98, 2, z, b.w + 0.3, 8, 0.7, edge);
      cube(b.x * 0.93, 1.8, z, 0.18, 0.45, 0.6, gold);
    }
  }
  function pipe(x: number, y: number, z: number, h: number) {
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, h, 24), green);
    body.position.set(x, y + h / 2, z);
    body.castShadow = true;
    body.receiveShadow = true;
    root.add(body);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.48, 24),
      rim,
    );
    collar.position.set(x, y + h - 0.08, z);
    collar.castShadow = true;
    root.add(collar);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.91, 24), darkGreen);
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(x, y + h + 0.165, z);
    root.add(hole);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.045, 0.15, 8, 24),
      rim,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, y + h + 0.16, z);
    root.add(ring);
    boxes.push({
      x,
      y: y + (h + 0.3) / 2,
      z,
      w: 2.4,
      h: h + 0.3,
      d: 2.4,
      kind: 'pipe',
    });
  }
  level.pipes.forEach((o) => pipe(o.x, o.y, o.z, o.height));
  const coinGeometry = new THREE.CylinderGeometry(0.34, 0.34, 0.105, 20),
    coinRingGeometry = new THREE.TorusGeometry(0.255, 0.024, 6, 20);
  function makeCoin(
    x: number,
    y: number,
    z: number,
    tracked = true,
    star?: number,
  ) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const outer = new THREE.Mesh(coinGeometry, gold);
    outer.rotation.x = Math.PI / 2;
    outer.castShadow = true;
    g.add(outer);
    const inner = new THREE.Mesh(coinRingGeometry, cream);
    inner.position.z = 0.065;
    g.add(inner);
    cube(0, 0, 0.07, 0.055, 0.32, 0.02, stripe, g);
    if (star !== undefined) {
      g.scale.setScalar(1.7);
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.13 : 0.27;
        const x = Math.cos(a) * r,
          y = Math.sin(a) * r;
        if (!i) shape.moveTo(x, y);
        else shape.lineTo(x, y);
      }
      shape.closePath();
      const emblem = new THREE.Mesh(new THREE.ShapeGeometry(shape), red);
      emblem.position.z = 0.085;
      g.add(emblem);
    }
    root.add(g);
    if (tracked) coins.push({ mesh: g, x, y, z, taken: false, star });
    return g;
  }
  level.coins.forEach((o) => makeCoin(o.x, o.y, o.z));
  level.stars.forEach((o, i) => makeCoin(o.x, o.y, o.z, true, i));
  function pickup(x: number, y: number, z: number, kind: Power) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    root.add(g);
    g.visible = false;
    if (kind === 'mushroom') {
      ball(0, -0.08, 0, 0.24, 0.32, 0.24, cream, g);
      ball(0, 0.18, 0, 0.52, 0.28, 0.52, red, g);
      for (const s of [-1, 1]) {
        ball(s * 0.25, 0.37, 0.16, 0.13, 0.05, 0.12, white, g);
        ball(s * 0.09, -0.12, 0.23, 0.035, 0.075, 0.025, dark, g);
      }
    } else if (kind === 'flower') {
      cube(0, -0.18, 0, 0.1, 0.5, 0.1, green, g);
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ball(
          Math.cos(a) * 0.3,
          0.3 + Math.sin(a) * 0.3,
          0,
          0.2,
          0.2,
          0.12,
          red,
          g,
        );
      }
      ball(0, 0.3, 0.08, 0.23, 0.23, 0.12, gold, g);
      ball(-0.08, 0.3, 0.2, 0.025, 0.065, 0.025, dark, g);
      ball(0.08, 0.3, 0.2, 0.025, 0.065, 0.025, dark, g);
    } else {
      const shape = new THREE.Shape();
      for (let i = 0; i < 10; i++) {
        const a = Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 0.23 : 0.52;
        if (!i) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      shape.closePath();
      g.add(new THREE.Mesh(new THREE.ShapeGeometry(shape), gold));
    }
    pickups.push({ mesh: g, x, y, z, kind, active: false, taken: false });
    return pickups.length - 1;
  }
  for (const b of level.blocks) {
    const mesh = cube(b.x, b.y, b.z, 1.35, 1.35, 1.35, qmat);
    boxes.push({
      ...b,
      w: 1.35,
      h: 1.35,
      d: 1.35,
      kind: 'question',
      id: questions.length,
    });
    const c = makeCoin(b.x, b.y + 1.2, b.z, false);
    c.visible = false;
    questions.push({
      mesh,
      used: false,
      baseY: b.y,
      bump: 0,
      coin: c,
      originalMaterial: qmat,
      reward: b.reward,
      powerIndex:
        b.reward === 'coin' ? -1 : pickup(b.x, b.y + 1.25, b.z, b.reward),
    });
  }
  for (const e of level.enemies) {
    const g = new THREE.Group();
    g.position.set(e.x, e.y, e.z);
    root.add(g);
    if (e.kind === 'goomba') {
      ball(0, 0.62, 0, 0.68, 0.57, 0.58, brown, g);
      ball(0, 0.31, 0, 0.36, 0.35, 0.36, cream, g);
      for (const s of [-1, 1]) {
        ball(s * 0.29, 0.13, 0.12, 0.29, 0.16, 0.38, dark, g);
        ball(s * 0.23, 0.73, 0.47, 0.18, 0.22, 0.1, white, g);
        ball(s * 0.2, 0.72, 0.55, 0.07, 0.13, 0.035, dark, g);
        const brow = cube(s * 0.23, 0.95, 0.51, 0.35, 0.065, 0.07, dark, g);
        brow.rotation.z = s * 0.25;
      }
    } else {
      ball(0, 0.57, -0.05, 0.56, 0.55, 0.5, green, g);
      ball(0, 0.51, 0.18, 0.4, 0.42, 0.3, cream, g);
      ball(0, 1.06, 0.25, 0.3, 0.35, 0.28, gold, g);
      for (const s of [-1, 1]) {
        ball(s * 0.3, 0.13, 0.16, 0.24, 0.14, 0.33, brown, g);
        ball(s * 0.12, 1.17, 0.49, 0.095, 0.13, 0.07, white, g);
        ball(s * 0.12, 1.17, 0.55, 0.036, 0.07, 0.025, dark, g);
      }
    }
    enemies.push({
      ...e,
      mesh: g,
      home: e.x,
      direction: 1,
      alive: true,
      stompTime: 0,
      shell: false,
      stun: 0,
    });
  }
  const flame = new THREE.MeshStandardMaterial({
    color: '#ff9737',
    emissive: '#ff541c',
    emissiveIntensity: 1.3,
  });
  allMaterials.add(flame);
  for (const f of level.firebars) {
    const g = new THREE.Group();
    g.position.set(f.x, f.y, f.z);
    root.add(g);
    ball(f.x, f.y - 0.2, f.z, 0.35, 0.4, 0.35, stone);
    for (let r = 0.6; r <= f.length; r += 0.55)
      ball(r, 0, 0, 0.26, 0.26, 0.26, flame, g);
    firebars.push({ ...f, mesh: g, angle: 0 });
  }
  if (level.theme === 'lava' || level.theme === 'castle') {
    cube(
      0,
      -3,
      level.goal.z / 2,
      180,
      0.5,
      Math.abs(level.goal.z) + 120,
      flame,
    );
    for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 4); i++)
      cube(
        (i % 2 ? 1 : -1) * (10 + (i % 5) * 7),
        -2.73,
        14 - i * 4,
        4,
        0.04,
        1.5,
        stripe,
      );
  }
  // Distant scenery stays beyond jump range and never creates a hidden bypass.
  if (['meadow', 'sky', 'night'].includes(level.theme)) {
    for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 11); i++) {
      const x = (i % 2 ? 1 : -1) * (48 + (i % 3) * 12),
        z = 26 - i * 11,
        s = 8 + (i % 4) * 3;
      ball(x, -9, z, s, s * 1.5, s, i % 2 ? grass : edge, decorations);
    }
    for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 20); i++) {
      const g = new THREE.Group();
      g.position.set(Math.sin(i * 4.4) * 55, 18 + (i % 4) * 4, 35 - i * 13);
      root.add(g);
      for (let j = 0; j < 4; j++)
        ball(j * 1.8, Math.sin(j * 2) * 0.4, 0, 2.1, 1.4, 1.1, white, g);
      clouds.push(g);
    }
  }
  if (level.theme === 'meadow')
    for (const s of [-1, 1]) {
      // Trees stand on their own unreachable outcrops.
      for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 35); i++) {
        const x = s * (32 + (i % 2) * 4),
          z = 4 - i * 23;
        ball(x, -3, z, 4, 3, 4, grass, decorations);
        cube(x, 1, z, 0.55, 2.6, 0.55, brown, decorations);
        ball(x, 3, z, 1.6, 2.1, 1.6, grass, decorations);
        ball(x + 0.4, 3.7, z, 1.15, 1.35, 1.15, edge, decorations);
      }
    }
  function sign(x: number, y: number, z: number, label: string) {
    const material = new THREE.MeshStandardMaterial({
      map: texture((c) => {
        c.fillStyle = '#fff3ce';
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = '#9a5634';
        c.fillRect(4, 4, 120, 5);
        c.font = '900 20px Arial';
        c.textAlign = 'center';
        c.fillText(label, 64, 60);
        c.font = '900 42px Arial';
        c.fillText('↑', 64, 109);
      }),
      roughness: 0.9,
    });
    cube(x, y + 0.8, z, 0.15, 1.6, 0.15, brown, root, true);
    cube(x, y + 1.65, z, 1.6, 1.4, 0.12, material, root, true);
  }
  sign(-4.5, 0, 5, 'JUMP');
  for (let act = 1; act < 4; act++)
    sign(-4.5, 0, 5 - act * 280, `ACT ${act + 1}`);
  if (level.theme === 'cave')
    cube(
      0,
      12.6,
      level.goal.z / 2,
      18,
      0.6,
      Math.abs(level.goal.z) + 45,
      stone,
      root,
      true,
    );
  const cp = level.checkpoint;
  const checkpoint = new THREE.Group();
  checkpoint.position.set(cp.x, cp.y, cp.z);
  root.add(checkpoint);
  cube(-2.5, 1.1, 0, 0.1, 2.2, 0.1, cream, checkpoint);
  cube(-1.95, 1.85, 0, 1, 0.6, 0.05, red, checkpoint);
  // Ground marker identifies the exact, safe respawn location.
  const cpRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.85, 0.07, 8, 32),
    gold,
  );
  cpRing.rotation.x = -Math.PI / 2;
  cpRing.position.y = 0.045;
  checkpoint.add(cpRing);
  const checkpoints = [checkpoint];
  for (const other of (level.checkpoints ?? []).slice(1)) {
    const marker = checkpoint.clone(true);
    marker.position.set(other.x, other.y, other.z);
    root.add(marker);
    checkpoints.push(marker);
  }
  const goal = level.goal;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 10, 12),
    cream,
  );
  pole.position.set(goal.x, goal.y + 5, goal.z);
  pole.castShadow = true;
  root.add(pole);
  ball(goal.x, goal.y + 10.1, goal.z, 0.23, 0.23, 0.23, gold);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(2, -0.7);
  shape.lineTo(0, -1.4);
  shape.closePath();
  const flag = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshStandardMaterial({
      color: '#ed4042',
      side: THREE.DoubleSide,
    }),
  );
  const flagGroup = new THREE.Group();
  flagGroup.position.set(goal.x + 0.08, goal.y + 9.5, goal.z);
  flagGroup.add(flag);
  root.add(flagGroup);
  ball(0.5, -0.5, 0.03, 0.24, 0.24, 0.03, white, flagGroup);
  cube(goal.x, goal.y + 0.2, goal.z, 1, 0.4, 1, brick, root, true);
  // The castle is beyond the flag and uses the same visible and collision bounds.
  cube(0, goal.y + 2.2, goal.z - 7, 5, 4.4, 2.5, cream, root, true);
  cube(0, goal.y + 0.9, goal.z - 5.73, 1.15, 1.8, 0.03, dark);
  for (const x of [-2.8, 2.8]) {
    cube(x, goal.y + 2.6, goal.z - 7, 1.6, 5.2, 2, cream, root, true);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2, 4), red);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(x, goal.y + 6.2, goal.z - 7);
    root.add(roof);
  }
  for (let i = 0; i < 5; i++)
    cube(-2 + i, goal.y + 4.7, goal.z - 7, 0.55, 0.7, 2.5, cream);
  let boss: Boss | undefined,
    gate: THREE.Mesh | undefined,
    gateBox: Box | undefined;
  if (level.boss) {
    const b = level.boss,
      g = new THREE.Group();
    g.position.set(b.x, b.y, b.z);
    root.add(g);
    ball(0, 1.05, -0.18, 1.15, 1.12, 0.8, green, g);
    ball(0, 0.95, 0.35, 0.84, 0.92, 0.65, gold, g);
    ball(0, 1.94, 0.55, 0.65, 0.64, 0.6, gold, g);
    ball(0, 1.7, 1, 0.68, 0.3, 0.4, cream, g);
    for (const side of [-1, 1]) {
      ball(side * 0.65, 0.19, 0.4, 0.43, 0.25, 0.65, brown, g);
      ball(side * 0.98, 1.1, 0.4, 0.36, 0.58, 0.34, gold, g);
      ball(side * 0.25, 2.15, 1.02, 0.18, 0.19, 0.1, white, g);
      ball(side * 0.25, 2.15, 1.1, 0.06, 0.11, 0.03, dark, g);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 8), cream);
      horn.position.set(side * 0.55, 2.48, 0.35);
      horn.rotation.z = -side * 0.4;
      g.add(horn);
    }
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 8), cream);
      spike.position.set(
        Math.sin(i * 1.26) * 0.86,
        1.1 + Math.cos(i * 1.26) * 0.8,
        -0.9,
      );
      spike.rotation.x = -Math.PI / 2;
      g.add(spike);
    }
    ball(0, 2.53, 0.24, 0.35, 0.22, 0.6, red, g);
    boss = {
      ...b,
      mesh: g,
      home: b.x,
      health: 3,
      cooldown: 1.5,
      hurt: 0,
      alive: true,
    };
    gate = cube(0, 6, goal.z + 4, 12, 12, 0.5, red);
    gateBox = { x: 0, y: 6, z: goal.z + 4, w: 12, h: 12, d: 0.5, kind: 'gate' };
    boxes.push(gateBox);
  }
  function dispose() {
    root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>(),
      textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        geometries.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          allMaterials.add(m);
      }
    });
    // Include original question materials even after every block is spent.
    for (const m of allMaterials) {
      if (m.userData.managedExternally) continue;
      for (const value of Object.values(m))
        if (value instanceof THREE.Texture) textures.add(value);
      m.dispose();
    }
    textures.forEach((t) => t.dispose());
    geometries.forEach((g) => g.dispose());
  }
  return {
    root,
    level,
    boxes,
    coins,
    enemies,
    questions,
    pickups,
    platforms,
    firebars,
    boss,
    clouds,
    flag,
    flagGroup,
    checkpoint,
    checkpoints,
    decorations,
    gate,
    gateBox,
    dispose,
  };
}
