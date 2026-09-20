import type { Level, Point, Surface, QuestionSpec } from './level-types';

// NES maps provide progression and elevation. This pass gives those encounters
// actual footprints, lateral approaches and open terrain at the ffea6f3 scale.
export const FORWARD_SCALE = 1.5;
export const BLOCK_SIZE = 1.35;
const START = 13;
const areaOf = (p: Point) => Math.round(p.x / 40);
const top = (s: Surface) => s.y + s.h / 2;
const open = (level: Level, area: number) =>
  !['cave', 'castle'].includes(level.areas[area].theme);
const containsZ = (s: Surface, z: number, margin = 0) =>
  Math.abs(s.z - z) < s.d / 2 + margin;

export function expandTo3D(level: Level): Level {
  const scaled = new Set<Point>();
  const scale = (p: Point) => {
    if (!scaled.has(p)) {
      p.z = START + (p.z - START) * FORWARD_SCALE;
      scaled.add(p);
    }
    return p;
  };
  for (const list of [
    level.surfaces,
    level.pipes,
    level.blocks,
    level.enemies,
    level.coins,
    level.stars,
    level.firebars,
    level.cannons,
    level.lava,
  ])
    for (const p of list) scale(p);
  for (const s of level.surfaces) {
    s.d *= FORWARD_SCALE;
    if (s.moving?.axis === 'z') {
      s.moving.distance *= FORWARD_SCALE;
      s.moving.speed *= 1.1;
    }
  }
  for (const p of level.pipes) p.d = 2.4;
  for (const b of level.lava) b.d *= FORWARD_SCALE;
  for (const p of [
    level.spawn,
    level.goal,
    level.checkpoint,
    ...level.checkpoints,
  ])
    scale(p);
  if (level.boss) scale(level.boss);
  if (level.axe) scale(level.axe);
  for (const p of level.portals) {
    scale(p);
    scale(p.target);
  }
  for (const a of level.areas) {
    a.length *= FORWARD_SCALE;
    a.width = a.underwater
      ? 16
      : a.theme === 'castle' || a.theme === 'cave'
        ? 14
        : 12;
    scale(a.spawn);
    if (a.exit) scale(a.exit.point);
  }
  for (const m of level.mazeRoutes) {
    m.startZ = START + (m.startZ - START) * FORWARD_SCALE;
    m.endZ = START + (m.endZ - START) * FORWARD_SCALE;
  }
  for (const m of level.mazeExits) {
    m.z = START + (m.z - START) * FORWARD_SCALE;
    scale(m.target);
  }
  level.mapWidth *= FORWARD_SCALE;

  const bases = level.surfaces.filter(
    (s) => !s.moving && !s.breakable && s.y - s.h / 2 < -0.5,
  );
  const terrainCenter = (area: number, z: number) => {
    const choices = bases.filter((s) => s.area === area);
    const support =
      choices.find((s) => containsZ(s, z)) ??
      choices.reduce<Surface | undefined>(
        (best, s) =>
          !best || Math.abs(s.z - z) < Math.abs(best.z - z) ? s : best,
        undefined,
      );
    return support?.x ?? level.areas[area].center;
  };
  for (const a of level.areas) {
    const floors = bases
      .filter((s) => s.area === a.id)
      .sort((x, y) => y.z - x.z);
    floors.forEach((s, i) => {
      s.x =
        a.center + (open(level, a.id) ? [0, 2.4, -2.2, 1.4, -1.4][i % 5] : 0);
      s.w =
        (a.width ?? 12) + (open(level, a.id) ? [0, -1, 1, -2, 0][i % 5] : 0);
      const height = top(s);
      s.h = 4;
      s.y = height - 2;
    });
  }
  // Keep each cluster of blocks cubic, and put upper tiers above their lower tier.
  const blockObjects: (Surface | QuestionSpec)[] = [
    ...level.surfaces.filter((s) => s.breakable),
    ...level.blocks,
  ];
  const groups: {
    area: number;
    min: number;
    max: number;
    y: number;
    x: number;
  }[] = [];
  for (const a of level.areas) {
    const heights = [
      ...new Set(
        blockObjects.filter((b) => b.area === a.id).map((b) => b.sourceY ?? 0),
      ),
    ].sort((x, y) => x - y);
    for (const height of heights) {
      const row = blockObjects
        .filter((b) => b.area === a.id && b.sourceY === height)
        .sort((x, y) => (x.sourceX ?? 0) - (y.sourceX ?? 0));
      let cluster: typeof row = [];
      const place = () => {
        if (!cluster.length) return;
        const min = cluster[0].sourceX ?? 0,
          max = cluster.at(-1)!.sourceX ?? 0;
        const parent = groups
          .filter(
            (g) =>
              g.area === a.id &&
              g.y < height &&
              g.min <= min + 8 &&
              g.max >= max - 8,
          )
          .at(-1);
        const lane =
          parent?.x ??
          terrainCenter(a.id, cluster[0].z) +
            [-2.4, 2.4, 0, 1.3][
              groups.filter((g) => g.area === a.id).length % 4
            ];
        for (const b of cluster) {
          const t = b.y + (b.h ?? 0.9) / 2;
          const stacked = blockObjects.some(
            (other) =>
              other !== b &&
              other.area === b.area &&
              other.sourceX === b.sourceX &&
              Math.abs((other.sourceY ?? 0) - (b.sourceY ?? 0)) === 8,
          );
          const size = stacked ? 0.9 : BLOCK_SIZE;
          b.x = lane;
          b.w = size;
          b.d = size;
          b.h = size;
          b.y = t - size / 2;
        }
        groups.push({ area: a.id, min, max, y: height, x: lane });
        cluster = [];
      };
      for (const b of row) {
        if (
          cluster.length &&
          (b.sourceX ?? 0) - (cluster.at(-1)!.sourceX ?? 0) > 24
        )
          place();
        cluster.push(b);
      }
      place();
    }
  }
  const baseSet = new Set(bases);
  for (const a of level.areas) {
    let platform = 0;
    for (const s of level.surfaces.filter((s) => s.area === a.id)) {
      if (baseSet.has(s) || s.breakable) continue;
      const t = top(s),
        bottom = s.y - s.h / 2;
      if (s.castleBridge) {
        s.x = a.center;
        s.w = 8;
        continue;
      }
      if (s.spring) {
        s.x = terrainCenter(a.id, s.z);
        s.w = 2;
        s.d = Math.max(1.35, s.d);
        continue;
      }
      if (s.style === 'tree' || s.style === 'shroom' || s.moving) {
        const center = terrainCenter(a.id, s.z);
        s.x = center + [0, -3, 2.6, -1.8, 3.2, -2.5][platform++ % 6];
        s.w = s.moving ? 4.5 : [6, 7, 5.5, 8][platform % 4];
        continue;
      }
      if (!open(level, a.id)) {
        // Broad masonry forms real rooms and preserves the castle's upper/lower routes.
        s.x = a.center;
        s.w = a.width ?? 14;
      } else if (bottom <= 0.1 && t > 0.1) {
        s.x = terrainCenter(a.id, s.z);
        s.w = (a.width ?? 12) + 1;
      } else {
        s.x = terrainCenter(a.id, s.z) + [0, -2.5, 2.5][platform++ % 3];
        s.w = s.d <= 2.1 ? BLOCK_SIZE : 6;
      }
    }
  }
  // Tall pipes stand on narrow rock crossings, with broad landings on both sides.
  // There is no floor beside the pipe to walk around; the rest of the island stays wide.
  for (const a of level.areas) {
    const pipes = level.pipes
      .filter((p) => p.area === a.id)
      .sort((x, y) => y.z - x.z);
    for (const [i, p] of pipes.entries()) {
      p.w = p.d = 2.4;
      const surface = level.surfaces
        .filter(
          (s) => s.area === a.id && containsZ(s, p.z) && top(s) <= p.y + 0.2,
        )
        .sort((x, y) => Math.abs(top(x) - p.y) - Math.abs(top(y) - p.y))[0];
      p.x = surface?.x ?? a.center;
      if (surface && baseSet.has(surface) && !p.horizontal && open(level, a.id))
        p.x += [-2.5, 2.6, 0, 1.8, -2][i % 5];
    }
  }
  const pieces: Surface[] = [];
  for (const base of bases) {
    const a = level.areas[base.area ?? 0];
    const pipes = level.pipes.filter(
      (p) =>
        p.area === a.id &&
        !p.horizontal &&
        Math.abs(p.y - top(base)) < 0.15 &&
        containsZ(base, p.z, 0),
    );
    if (!pipes.length) continue;
    const near = base.z + base.d / 2,
      far = base.z - base.d / 2;
    const cuts = [
      near,
      far,
      ...pipes.flatMap((p) => [
        Math.min(near, p.z + 2),
        Math.max(far, p.z - 2),
      ]),
    ].sort((x, y) => y - x);
    for (let i = 0; i < cuts.length - 1; i++) {
      const start = cuts[i],
        end = cuts[i + 1];
      if (start - end < 0.02) continue;
      const z = (start + end) / 2,
        pipe = pipes
          .filter((p) => Math.abs(p.z - z) < 2.01)
          .sort((x, y) => Math.abs(x.z - z) - Math.abs(y.z - z))[0];
      pieces.push({
        ...base,
        z,
        d: start - end,
        x: pipe?.x ?? base.x,
        w: pipe ? 2.4 : base.w,
        choke: !!pipe,
      });
    }
    level.surfaces.splice(level.surfaces.indexOf(base), 1);
  }
  level.surfaces.push(...pieces);
  const supportAt = (area: number, p: Point) =>
    level.surfaces
      .filter(
        (s) =>
          s.area === area && containsZ(s, p.z, 0.25) && top(s) <= p.y + 0.25,
      )
      .sort((a, b) => Math.abs(top(a) - p.y) - Math.abs(top(b) - p.y))[0];
  const placePoint = (p: Point, area = areaOf(p)) => {
    p.x = supportAt(area, p)?.x ?? terrainCenter(area, p.z);
  };
  for (const [index, e] of level.enemies.entries()) {
    const a = e.area ?? areaOf(e),
      piranha =
        e.kind === 'piranha'
          ? level.pipes.find((p) => p.area === a && p.sourceX === e.sourceX)
          : undefined;
    if (piranha) {
      e.x = piranha.x;
      continue;
    }
    placePoint(e, a);
    e.axis = 'x';
    e.range =
      e.kind === 'hammer'
        ? 0
        : Math.min(2.4, (supportAt(a, e)?.w ?? 6) / 2 - 0.8);
    if (e.range < 0) e.range = 0;
    const support = supportAt(a, e);
    if (support && support.w >= 3 && !e.flying && !e.leaping && ['goomba', 'koopa', 'spiny', 'beetle'].includes(e.kind)) {
      const half = support.w / 2 - 0.65;
      e.roam = {
        minX: support.x - half, maxX: support.x + half,
        minZ: Math.max(support.z - support.d / 2 + 0.65, e.z - 3.5),
        maxZ: Math.min(support.z + support.d / 2 - 0.65, e.z + 3.5),
      };
      // Different lanes and phases keep groups from forming a single file.
      const offset = Math.sin(index * 2.39996 + 0.8) * half * 0.82;
      const candidates = [offset, -offset, 0];
      e.x = support.x + (candidates.find(x => !level.pipes.some(p => p.area === a && Math.abs(p.z - e.z) < (p.d ?? 2.4) / 2 + 0.5 && Math.abs(p.x - support.x - x) < (p.w ?? 2.4) / 2 + 0.5)) ?? 0);
    }

  }
  for (const coin of level.coins) {
    const a = areaOf(coin),
      block = blockObjects
        .filter(
          (b) =>
            b.area === a &&
            Math.abs(b.z - coin.z) < (b.d ?? 1.35) / 2 + 0.4 &&
            b.y + (b.h ?? 1.35) / 2 <= coin.y + 0.1,
        )
        .sort((x, y) => Math.abs(coin.y - x.y) - Math.abs(coin.y - y.y))[0];
    coin.x = block?.x ?? supportAt(a, coin)?.x ?? terrainCenter(a, coin.z);
  }
  const placed = new Set<Point>();
  const destination = (p: Point, a = areaOf(p)) => {
    if (placed.has(p)) return;
    placed.add(p);
    const pipe = level.pipes.find(
      (pi) =>
        pi.area === a &&
        Math.abs(pi.z - p.z) < 0.3 &&
        Math.abs(pi.y + pi.height - p.y) < 0.35,
    );
    p.x = pipe?.x ?? supportAt(a, p)?.x ?? terrainCenter(a, p.z);
  };
  for (const p of level.portals) {
    if (p.mode === 'vine') {
      const q = level.blocks.find((b) => b.portal === p.id);
      p.x = q?.x ?? terrainCenter(p.area, p.z);
    } else {
      const pipe = level.pipes
        .filter((pi) => pi.area === p.area)
        .sort((a, b) => Math.abs(a.z - p.z) - Math.abs(b.z - p.z))[0];
      p.x = pipe?.x ?? terrainCenter(p.area, p.z);
    }
    destination(p.target, p.targetArea);
  }
  for (const a of level.areas) {
    destination(a.spawn, a.id);
    if (a.exit) destination(a.exit.point, a.exit.area);
  }
  destination(level.spawn, level.startArea);
  destination(level.goal, level.goalArea);
  for (const cp of level.checkpoints) destination(cp);
  destination(level.checkpoint);
  for (const exit of level.mazeExits) destination(exit.target, exit.area);
  if (level.boss) {
    level.boss.x = level.areas[level.goalArea].center;
  }
  if (level.axe) destination(level.axe, level.goalArea);
  for (const [i, b] of level.firebars.entries()) {
    const a = b.area ?? areaOf(b);
    b.x = terrainCenter(a, b.z) + (i % 2 ? 2 : -2);
    b.length = Math.min(5.2, Math.max(2.5, b.length * 1.5));
    b.plane = i % 2 ? 'vertical' : 'horizontal';
  }
  for (const c of level.cannons) placePoint(c, c.area);
  for (const lava of level.lava) {
    lava.x = level.areas[lava.area].center;
    lava.w = (level.areas[lava.area].width ?? 12) + 10;
  }
  level.walls = [];
  for (const a of level.areas) {
    if (open(level, a.id)) continue;
    const width = a.width ?? 14;
    for (const side of [-1, 1])
      level.walls.push({
        x: a.center + side * (width / 2 + 0.8),
        y: 3,
        z: START - a.length / 2,
        w: 1.6,
        h: 18,
        d: a.length + 10,
        kind: 'cavern-wall',
      });
    level.walls.push({
      x: a.center,
      y: 3,
      z: START + 1,
      w: width,
      h: 18,
      d: 1.6,
      kind: 'cavern-wall',
    });
    if (a.theme === 'cave')
      level.walls.push({
        x: a.center,
        y: 13.8,
        z: START - a.length / 2,
        w: width + 3,
        h: 1,
        d: a.length + 10,
        kind: 'cavern-roof',
      });
  }
  // A few approach coins mark the lateral jumps introduced by the 3D layout.
  for (const piece of pieces.filter((s) => s.choke && s.d > 1.6)) {
    const p = {
      x: piece.x,
      y: top(piece) + 1.15,
      z: piece.z + piece.d / 2 + 0.8,
    };
    if (!level.coins.some((c) => Math.hypot(c.x - p.x, c.z - p.z) < 0.8))
      level.coins.push(p);
  }
  return level;
}
