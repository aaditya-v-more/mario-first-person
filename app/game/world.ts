import { shadeSurface } from './surface-shaders';
import * as THREE from 'three';
import type { Box } from './physics';
import { createTextureCanvas } from './browser-runtime';
import {
  LEVELS,
  PALETTES,
  AREA_SPACING,
  COURSE_WIDTH,
  type Level,
  type Power,
  type Reward,
  type EnemySpec,
} from './levels';
import type { Motion } from './level-types';
export type Coin = {
  mesh: THREE.Group;
  x: number;
  y: number;
  z: number;
  taken: boolean;
  star?: number;
};
export type Enemy = EnemySpec & {
  mesh: THREE.Group;
  heading?: number;
  home: number;
  homeX: number;
  homeY: number;
  homeZ: number;
  direction: number;
  alive: boolean;
  stompTime: number;
  shell: boolean;
  stun: number;
  cooldown: number;
  activated: boolean;
  vy: number;
};
export type Question = {
  mesh: THREE.Mesh;
  used: boolean;
  baseY: number;
  bump: number;
  coin: THREE.Group;
  originalMaterial: THREE.Material;
  reward: Reward;
  box: Box;
  portal?: string;
  powerIndex: number;
  remaining: number;
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
export type MovingPlatform = Motion & {
  started?: boolean;
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
  plane?: 'vertical' | 'horizontal';
  area?: number;
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
type TerrainVisual = { mesh: THREE.Object3D; box: Box; hide?: () => void };
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
  dispose: () => void;
  setArea: (id: number) => void;
  bricks: TerrainVisual[];
  bridges: TerrainVisual[];
  springs: Box[];
  axe?: THREE.Group;
  vines: Map<string, THREE.Group>;
  showPower: (index: number, kind: Power) => void;
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
  const areaGroups = level.areas.map(() => {
    const g = new THREE.Group();
    root.add(g);
    return g;
  });
  const add = (
    object: THREE.Object3D,
    area = Math.round(object.position.x / AREA_SPACING),
  ) => (areaGroups[area] ?? root).add(object);
  const staticGroups: { mesh: THREE.Group; area: number }[] = [];
  const bricks: TerrainVisual[] = [],
    bridges: TerrainVisual[] = [],
    springs: Box[] = [];
  const vines = new Map<string, THREE.Group>();
  const boxes: Box[] = [],
    coins: Coin[] = [],
    enemies: Enemy[] = [],
    questions: Question[] = [],
    pickups: Pickup[] = [],
    platforms: MovingPlatform[] = [],
    firebars: Firebar[] = [],
    clouds: THREE.Group[] = [];
  const palette = PALETTES[level.theme];
  const grass = mat('#69bf38'),
    edge = mat('#86d747'),
    green = new THREE.MeshPhysicalMaterial({ color: '#159341', roughness: 0.3, clearcoat: 0.65, clearcoatRoughness: 0.22 }),
    rim = new THREE.MeshPhysicalMaterial({ color: '#24bf55', roughness: 0.24, clearcoat: 0.7, clearcoatRoughness: 0.18 }),
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
    if (parent === root) add(mesh);
    else parent.add(mesh);
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
    if (parent === root) add(mesh);
    else parent.add(mesh);
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
  const brick = new THREE.MeshStandardMaterial({ map: brickTex, bumpMap: brickTex, bumpScale: 0.045, roughness: 0.88 });
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
  const areaStone = level.areas.map((a) => mat(PALETTES[a.theme].ground)),
    areaEdge = level.areas.map((a) => mat(PALETTES[a.theme].edge));
  for (const m of [...areaStone, ...areaEdge]) allMaterials.add(m);
  for (const surface of level.surfaces) {
    const { x, y, z, w, h, d, style, moving } = surface;
    const g = new THREE.Group();
    g.position.set(x, y, z);
    add(g);
    const material =
      style === 'brick'
        ? brick
        : style === 'wood'
          ? wood
          : style === 'cloud'
            ? cloud
            : style === 'stone'
              ? areaStone[surface.area ?? 0]
              : style === 'shroom'
                ? red
                : style === 'coral'
                  ? mat('#ed91ad')
                  : soil;
    cube(0, -0.09, 0, w, h - 0.18, d, material, g);
    cube(
      0,
      h / 2 - 0.09,
      0,
      w,
      0.18,
      d,
      style === 'ground' || style === 'tree'
        ? grass
        : style === 'brick'
          ? brick
          : style === 'stone'
            ? areaStone[surface.area ?? 0]
            : style === 'shroom'
              ? red
              : style === 'coral'
                ? mat('#ed91ad')
                : style === 'wood' || style === 'bridge'
                  ? stripe
                  : areaEdge[surface.area ?? 0],
      g,
    );
    if (!moving) staticGroups.push({ mesh: g, area: surface.area ?? 0 });
    const box: Box = {
      x,
      y,
      z,
      w,
      h,
      d,
      kind: surface.breakable ? 'brick' : moving ? 'moving' : 'terrain',
    };
    if (surface.breakable) bricks.push({ mesh: g, box });
    if (surface.castleBridge) bridges.push({ mesh: g, box });
    if (surface.spring) springs.push(box);
    boxes.push(box);
    if (moving && !moving.mode) {
      const initial =
        box[moving.axis] + Math.sin(moving.phase ?? 0) * moving.distance;
      g.position[moving.axis] = initial;
    }
    if (moving) {
      platforms.push({
        ...moving,
        mesh: g,
        box,
        axis: moving.axis,
        origin: box[moving.axis],
        distance: moving.distance,
        speed: moving.speed,
        phase: moving.phase || 0,
      });
      if (!moving.mode) box[moving.axis] = g.position[moving.axis];
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
    if (style === 'tree' || style === 'shroom') {
      cube(
        0,
        -(h / 2 + 2.5),
        0,
        style === 'shroom' ? 0.6 : 1,
        5,
        Math.max(0.3, d * 0.3),
        style === 'shroom' ? cream : brown,
        g,
      );
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
    boxes.push({ ...b });
    const a = Math.max(
      0,
      Math.min(level.areas.length - 1, Math.round(b.x / AREA_SPACING)),
    );
    cube(b.x, b.y, b.z, b.w, b.h, b.d, areaStone[a]);
  }
  for (const o of level.pipes) {
    const w = o.w ?? 2.4,
      d = o.d ?? 2.4,
      h = o.height;
    const group = new THREE.Group();
    group.position.set(o.x, o.y, o.z);
    add(group, o.area);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, Math.max(0.1, h - 0.15), 24),
      green,
    );
    body.position.y = (h - 0.15) / 2;
    body.scale.set(w / 2.4, 1, d / 2.4);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 0.24, 24),
      rim,
    );
    collar.position.y = h - 0.12;
    collar.scale.set(w / 2.4, 1, d / 2.4);
    collar.castShadow = true;
    group.add(collar);
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.93, 24), darkGreen);
    hole.rotation.x = -Math.PI / 2;
    hole.position.y = h + 0.006;
    hole.scale.set(w / 2.4, d / 2.4, 1);
    group.add(hole);
    if (o.horizontal) {
      const mouth = new THREE.Mesh(
        new THREE.CircleGeometry(0.72, 24),
        darkGreen,
      );
      mouth.position.set(0, Math.min(0.8, h / 2), d / 2 + 0.01);
      mouth.scale.x = w / 1.6;
      group.add(mouth);
    }
    boxes.push({ x: o.x, y: o.y + h / 2, z: o.z, w, h, d, kind: 'pipe' });
  }
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
    add(g);
    if (tracked) coins.push({ mesh: g, x, y, z, taken: false, star });
    return g;
  }
  level.coins.forEach((o) => makeCoin(o.x, o.y, o.z));
  level.stars.forEach((o, i) => makeCoin(o.x, o.y, o.z, true, i));
  function pickup(x: number, y: number, z: number, kind: Power) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    add(g);
    g.visible = false;
    if (kind === 'mushroom' || kind === 'life') {
      ball(0, -0.08, 0, 0.24, 0.32, 0.24, cream, g);
      ball(0, 0.18, 0, 0.52, 0.28, 0.52, kind === 'life' ? green : red, g);
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
    const material = b.brick ? brick : qmat;
    const mesh = cube(
      b.x,
      b.y,
      b.z,
      b.w ?? 1.35,
      b.h ?? 1.35,
      b.d ?? 1.35,
      material,
    );
    mesh.visible = !b.hidden;
    const box: Box = {
      ...b,
      w: b.w ?? 1.35,
      h: b.h ?? 1.35,
      d: b.d ?? 1.35,
      kind: 'question',
      hidden: b.hidden,
      id: questions.length,
    };
    boxes.push(box);
    const c = makeCoin(b.x, b.y + 1.2, b.z, false);
    c.visible = false;
    const actual = b.reward === 'upgrade' ? 'mushroom' : b.reward;
    questions.push({
      mesh,
      used: false,
      baseY: b.y,
      bump: 0,
      coin: c,
      box,
      portal: b.portal,
      originalMaterial: material,
      reward: b.reward,
      remaining: b.coins ?? 1,
      powerIndex:
        actual === 'coin' || actual === 'vine'
          ? -1
          : pickup(b.x, b.y + (b.h ?? 1.35) / 2 + 0.55, b.z, actual),
    });
    if (b.portal) {
      const vine = new THREE.Group();
      vine.position.set(b.x, b.y + 0.5, b.z);
      add(vine, b.area);
      cube(0, 3, 0, 0.12, 6, 0.12, green, vine);
      for (let i = 0; i < 7; i++)
        ball(
          (i % 2 ? 1 : -1) * 0.2,
          i * 0.8,
          0.05,
          0.23,
          0.12,
          0.12,
          rim,
          vine,
        );
      vine.visible = false;
      vines.set(b.portal, vine);
    }
  }
  for (const e of level.enemies) {
    const g = new THREE.Group();
    g.position.set(e.x, e.y, e.z);
    add(g);
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
    } else if (
      [
        'cheep',
        'blooper',
        'piranha',
        'podoboo',
        'lakitu',
        'spiny',
        'beetle',
      ].includes(e.kind)
    ) {
      const color =
        e.kind === 'blooper'
          ? white
          : e.kind === 'beetle'
            ? dark
            : e.kind === 'lakitu'
              ? gold
              : red;
      if (e.kind === 'blooper') {
        ball(0, 0.55, 0, 0.42, 0.55, 0.35, white, g);
        for (let i = 0; i < 4; i++)
          ball(-0.27 + i * 0.18, 0.08, 0.04, 0.08, 0.24, 0.1, white, g);
      } else if (e.kind === 'piranha') {
        cube(0, 0.2, 0, 0.12, 0.8, 0.12, green, g);
        ball(0, 0.65, 0, 0.5, 0.35, 0.4, red, g);
        cube(0, 0.65, 0.38, 0.8, 0.09, 0.05, cream, g);
        for (const side of [-1, 1])
          ball(side * 0.2, 0.85, 0.2, 0.1, 0.05, 0.1, cream, g);
      } else if (e.kind === 'lakitu') {
        ball(0, 0.1, 0, 0.8, 0.35, 0.48, white, g);
        ball(0, 0.65, 0, 0.3, 0.5, 0.28, gold, g);
      } else {
        ball(0, 0.45, 0, 0.55, 0.42, 0.42, color, g);
        if (e.kind === 'cheep') {
          ball(-0.52, 0.4, 0, 0.18, 0.3, 0.1, cream, g);
          ball(0.52, 0.4, 0, 0.18, 0.3, 0.1, cream, g);
        }
        if (e.kind === 'spiny')
          for (const side of [-1, 0, 1]) {
            const spike = new THREE.Mesh(
              new THREE.ConeGeometry(0.12, 0.35, 6),
              cream,
            );
            spike.position.set(side * 0.24, 0.91, 0);
            g.add(spike);
          }
      }
      if (e.kind !== 'podoboo')
        for (const side of [-1, 1]) {
          ball(side * 0.15, 0.6, 0.35, 0.12, 0.14, 0.07, white, g);
          ball(side * 0.15, 0.6, 0.42, 0.045, 0.07, 0.025, dark, g);
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
      home: e.axis === 'z' ? e.z : e.x,
      homeX: e.x,
      homeY: e.y,
      homeZ: e.z,
      cooldown: 1.4,
      activated: false,
      vy: 0,
      direction: enemies.length % 2 ? -1 : 1,
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
    add(g);
    ball(f.x, f.y - 0.2, f.z, 0.35, 0.4, 0.35, stone);
    const positions: THREE.Matrix4[] = [];
    for (let r = 0.4; r <= f.length; r += 0.45)
      positions.push(
        new THREE.Matrix4().compose(
          f.plane === 'horizontal'
            ? new THREE.Vector3(r, 0, 0)
            : new THREE.Vector3(0, 0, r),
          new THREE.Quaternion(),
          new THREE.Vector3(0.23, 0.23, 0.23),
        ),
      );
    const flames = new THREE.InstancedMesh(sphereGeo, flame, positions.length);
    positions.forEach((matrix, i) => flames.setMatrixAt(i, matrix));
    flames.castShadow = true;
    g.add(flames);
    firebars.push({ ...f, mesh: g, angle: 0 });
  }
  for (const water of level.lava) {
    const wet = level.areas[water.area].underwater;
    cube(
      water.x,
      water.y + water.h / 2 - 0.05,
      water.z,
      water.w,
      0.1,
      water.d,
      wet ? mat('#29a6ce') : flame,
    );
  }
  for (const area of level.areas)
    if (area.underwater) {
      const water = new THREE.MeshStandardMaterial({
        color: '#329fd0',
        transparent: true,
        opacity: 0.17,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      cube(
        area.center,
        9.5,
        13 - area.length / 2,
        area.width ?? COURSE_WIDTH,
        0.03,
        area.length,
        water,
      );
      for (let i = 0; i < 18; i++)
        ball(
          area.center + ((i % 3) - 1) * 0.7,
          1 + (i % 7),
          10 - (i * area.length) / 18,
          0.05,
          0.05,
          0.05,
          cream,
        );
    }
  // Distant scenery stays beyond jump range and never creates a hidden bypass.
  if (level.areas.some((a) => ['meadow', 'sky', 'night'].includes(a.theme))) {
    for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 11); i++) {
      const x = (i % 2 ? 1 : -1) * (48 + (i % 3) * 12),
        z = 26 - i * 11,
        s = 8 + (i % 4) * 3;
      ball(x, -9, z, s, s * 1.5, s, i % 2 ? grass : edge, decorations);
    }
    for (let i = 0; i < Math.ceil(Math.abs(level.goal.z) / 20); i++) {
      const g = new THREE.Group();
      g.position.set(Math.sin(i * 4.4) * 55, 18 + (i % 4) * 4, 35 - i * 13);
      add(g);
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
  sign(-4.5, 0, 7, 'JUMP');
  const cp = level.checkpoint;
  const checkpoint = new THREE.Group();
  checkpoint.position.set(cp.x, cp.y, cp.z);
  add(checkpoint);
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
  const checkpoints = level.checkpoints.length ? [checkpoint] : [];
  checkpoint.visible = level.checkpoints.length > 0;
  for (const other of (level.checkpoints ?? []).slice(1)) {
    const marker = checkpoint.clone(true);
    marker.position.set(other.x, other.y, other.z);
    add(marker);
    checkpoints.push(marker);
  }
  const goal = level.goal;
  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 10, 12),
    cream,
  );
  pole.position.set(goal.x, goal.y + 5, goal.z);
  pole.castShadow = true;
  pole.visible = !level.boss;
  add(pole);
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
  flagGroup.visible = !level.boss;
  add(flagGroup);
  ball(0.5, -0.5, 0.03, 0.24, 0.24, 0.03, white, flagGroup);
  cube(goal.x, goal.y + 0.2, goal.z, 1, 0.4, 1, brick, root, true);
  if (!level.boss) {
    // The castle is beyond the flag and uses the same visible and collision bounds.
    cube(goal.x, goal.y + 2.2, goal.z - 7, 5, 4.4, 2.5, cream, root, true);
    cube(goal.x, goal.y + 0.9, goal.z - 5.73, 1.15, 1.8, 0.03, dark);
    for (const x of [goal.x - 2.8, goal.x + 2.8]) {
      cube(x, goal.y + 2.6, goal.z - 7, 1.6, 5.2, 2, cream, root, true);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2, 4), red);
      roof.rotation.y = Math.PI / 4;
      roof.position.set(x, goal.y + 6.2, goal.z - 7);
      add(roof);
    }
    for (let i = 0; i < 5; i++)
      cube(goal.x - 2 + i, goal.y + 4.7, goal.z - 7, 0.55, 0.7, 2.5, cream);
  }
  let axe: THREE.Group | undefined;
  let boss: Boss | undefined;
  if (level.boss) {
    const b = level.boss,
      g = new THREE.Group();
    g.position.set(b.x, b.y, b.z);
    add(g);
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
      health: 5,
      cooldown: 1.5,
      hurt: 0,
      alive: true,
    };
    if (level.axe) {
      axe = new THREE.Group();
      axe.position.set(level.axe.x, level.axe.y, level.axe.z);
      add(axe, level.goalArea);
      cube(0, 0, 0, 0.1, 1.1, 0.1, brown, axe);
      ball(0.2, 0.4, 0, 0.4, 0.3, 0.09, gold, axe);
    }
    // The rescue room is the finish; reaching the axe removes the bridge.
    const npc = new THREE.Group();
    npc.position.set(goal.x, goal.y, goal.z - 1.8);
    add(npc, level.goalArea);
    ball(
      0,
      0.55,
      0,
      0.25,
      0.5,
      0.25,
      level.world === 7 ? mat('#f69ac6') : cream,
      npc,
    );
    ball(0, 1.05, 0, 0.25, 0.24, 0.25, cream, npc);
    ball(0, 1.3, 0, 0.45, 0.2, 0.4, level.world === 7 ? gold : red, npc);
  }
  function showPower(index: number, kind: Power) {
    const p = pickups[index];
    if (!p) return;
    if (p.kind !== kind) {
      p.mesh.visible = false;
      pickup(p.x, p.y, p.z, kind);
      const replacement = pickups.pop()!;
      p.mesh = replacement.mesh;
    }
    p.kind = kind;
    p.mesh.visible = true;
    p.active = true;
  }
  // Static terrain shares draw calls. Mutable bricks retain an instance handle.
  const handles = new Map<
    THREE.Object3D,
    { mesh: THREE.InstancedMesh; index: number }[]
  >();
  for (const [area, group] of areaGroups.entries()) {
    const batches = new Map<
      string,
      {
        geometry: THREE.BufferGeometry;
        material: THREE.Material;
        entries: { matrix: THREE.Matrix4; source: THREE.Object3D }[];
      }
    >();
    for (const item of staticGroups.filter((s) => s.area === area)) {
      item.mesh.updateWorldMatrix(true, true);
      const parts: THREE.Mesh[] = [];
      item.mesh.traverse((o) => {
        if (
          o instanceof THREE.Mesh &&
          !(o instanceof THREE.InstancedMesh) &&
          !Array.isArray(o.material)
        )
          parts.push(o);
      });
      for (const part of parts) {
        const material = part.material as THREE.Material,
          key = `${part.geometry.uuid}:${material.uuid}`;
        if (!batches.has(key))
          batches.set(key, { geometry: part.geometry, material, entries: [] });
        batches.get(key)!.entries.push({
          matrix: part.matrixWorld.clone(),
          source: item.mesh,
        });
        part.removeFromParent();
      }
    }
    for (const batch of batches.values()) {
      const mesh = new THREE.InstancedMesh(
        batch.geometry,
        batch.material,
        batch.entries.length,
      );
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      batch.entries.forEach((entry, index) => {
        mesh.setMatrixAt(index, entry.matrix);
        if (!handles.has(entry.source)) handles.set(entry.source, []);
        handles.get(entry.source)!.push({ mesh, index });
      });
      group.add(mesh);
    }
  }
  for (const item of [...bricks, ...bridges])
    item.hide = () => {
      item.mesh.visible = false;
      for (const handle of handles.get(item.mesh) ?? []) {
        handle.mesh.setMatrixAt(
          handle.index,
          new THREE.Matrix4().makeScale(0, 0, 0),
        );
        handle.mesh.instanceMatrix.needsUpdate = true;
      }
    };
  function setArea(id: number) {
    areaGroups.forEach((g, i) => (g.visible = i === id));
    decorations.visible = ['meadow', 'sky', 'night'].includes(
      level.areas[id].theme,
    );
  }
  setArea(level.startArea);
  for (const material of allMaterials) {
    if (material instanceof THREE.MeshStandardMaterial && material.emissiveIntensity <= 1 && material !== cloud)
      shadeSurface(material, material === grass || material === edge);
  }


  function dispose() {
    root.removeFromParent();
    const geometries = new Set<THREE.BufferGeometry>(),
      textures = new Set<THREE.Texture>();
    root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.dispose();
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
    dispose,
    setArea,
    bricks,
    bridges,
    springs,
    axe,
    vines,
    showPower,
  };
}
