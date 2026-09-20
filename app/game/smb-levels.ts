import reference from './reference/smb-nes.json';
import { expandTo3D } from './spatial-layout';
import type {
  Level,
  Theme,
  Point,
  Surface,
  Reward,
  EnemyKind,
  Portal,
  Motion,
} from './level-types';

export const TILE = 0.9;
export const MAP_UNIT = TILE / 8;
export const COURSE_WIDTH = 12;
export const AREA_SPACING = 40;
export const START_Z = 13;
interface RawObject {
  macro?: string;
  thing?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number | 'Infinity';
  xnum?: number;
  ynum?: number;
  xwidth?: number;
  yheight?: number;
  contents?: string | [string, { transport?: number; entrance?: number }];
  hidden?: boolean;
  transport?: number | boolean | { map: string };
  entrance?: number;
  piranha?: boolean;
  floating?: boolean;
  sliding?: boolean;
  falling?: boolean;
  jumping?: boolean;
  smart?: boolean;
  begin?: number | boolean;
  end?: number | boolean;
  speed?: number;
  movement?: string;
  direction?: number;
  fireballs?: number;
  counterclockwise?: boolean;
  widthLeft?: number;
  widthRight?: number;
  between?: number;
  dropLeft?: number;
  dropRight?: number;
  section?: number;
  pass?: number;
  fail?: number;
  warps?: number[];
  solidTrunk?: boolean;
  throwing?: boolean;
  sourceSection?: number;
}
interface RawArea {
  setting: string;
  exit?: number;
  underwater?: boolean;
  creation: RawObject[];
  sections?: {
    before?: { width: number; creation: RawObject[] };
    stretch?: { width: number; creation: RawObject[] };
    after?: { width: number; creation: RawObject[] };
  }[];
}
interface RawMap {
  name: string;
  time?: number;
  locations: { area?: number; entry?: string; xloc?: number }[];
  areas: RawArea[];
}
const maps = reference as unknown as RawMap[];
const timeCorrections: Record<string, number> = {
  '3-1': 400,
  '4-4': 400,
  '5-1': 300,
};
const names = [
  [
    'The First Adventure',
    'Into the Underground',
    'Treetop Trail',
    'The First Castle',
  ],
  [
    'Vines and Hidden Rooms',
    'Under the Sea',
    'Cheep Cheep Bridges',
    'The Firebar Castle',
  ],
  [
    'Nightfall in the Kingdom',
    'The Midnight March',
    'Balancing Act',
    'The Second Castle',
  ],
  [
    'Lakitu’s Sky',
    'The Secret Warp Route',
    'Mushroom Heights',
    'The Looping Castle',
  ],
  [
    'The Bullet Bill Road',
    'Springboards and Secrets',
    'Return to the Treetops',
    'The Firebar Gauntlet',
  ],
  [
    'Lakitu After Dark',
    'A World of Secret Pipes',
    'The White Treetops',
    'The Night Castle',
  ],
  [
    'The Cannon Barrage',
    'The Deep Sea',
    'The Flying Fish Run',
    'The Three-Path Castle',
  ],
  ['The Long Road', 'The Last Lakitu', 'Hammer Brothers', 'Bowser’s Castle'],
];
function theme(setting: string): Theme {
  return setting.includes('Underwater')
    ? 'water'
    : setting.includes('Castle')
      ? 'castle'
      : setting.includes('Underworld')
        ? 'cave'
        : setting.includes('Night')
          ? 'night'
          : setting.includes('Sky') || setting.includes('Shroom')
            ? 'sky'
            : 'meadow';
}
const point = (area: number, x: number, y = 0, width = 0): Point => ({
  x: area * AREA_SPACING,
  y: y * MAP_UNIT,
  z: START_Z - (x + width / 2) * MAP_UNIT,
});

function compile(map: RawMap, index: number): Level {
  const world = Math.floor(index / 4),
    course = index % 4;
  const result: Level = {
    id: map.name.replace('-', '–'),
    name: names[world][course],
    world,
    theme: 'meadow',
    kind: 'Overworld',
    subtitle: '',
    hint: '',
    time: timeCorrections[map.name] ?? map.time ?? 400,
    par: map.time ?? 400,
    spawn: point(0, 16),
    goal: point(0, 1600),
    checkpoint: point(0, 16),
    checkpoints: [],
    surfaces: [],
    walls: [],
    pipes: [],
    blocks: [],
    enemies: [],
    coins: [],
    stars: [],
    firebars: [],
    areas: [],
    startArea: map.locations[0]?.area ?? 0,
    mainArea: 0,
    goalArea: 0,
    portals: [],
    mazeRoutes: [],
    mazeExits: [],
    cannons: [],
    lava: [],
    referenceId: map.name,
    mapWidth: 0,
  };
  const flattened: RawObject[][] = [];
  const sectionStarts = new Map<string, number>();
  const unlinked: {
    object: RawObject;
    area: number;
    point: Point;
    mode: Portal['mode'];
    block?: string;
  }[] = [];
  const entrances = new Map<number, { area: number; point: Point }>();
  let longest = 0;
  const bounds = (
    area: number,
    x: number,
    y: number,
    width: number,
    height: number,
    style: Surface['style'],
    extra: Partial<Surface> = {},
  ): Surface => ({
    ...point(area, x, y - height / 2, width),
    w: COURSE_WIDTH,
    h: height * MAP_UNIT,
    d: width * MAP_UNIT,
    style,
    area,
    sourceX: x,
    sourceY: y,
    ...extra,
  });
  const addSurface = (
    area: number,
    x: number,
    y: number,
    width: number,
    height: number,
    style: Surface['style'],
    extra: Partial<Surface> = {},
  ) => {
    const s = bounds(area, x, y, width, height, style, extra);
    result.surfaces.push(s);
    return s;
  };
  for (const [areaId, area] of map.areas.entries()) {
    const objects: RawObject[] = [];
    const expandedSections = new Set<number>();
    let mazeGroup = 0;
    const routesInGroup: string[] = [];
    function expand(list: RawObject[], offset = 0, section = -1) {
      for (const original of list) {
        const o = {
          ...original,
          x: (original.x ?? 0) + offset,
          sourceSection: section,
        };
        if (o.sliding) {
          if (typeof o.begin === 'number') o.begin += offset;
          if (typeof o.end === 'number') o.end += offset;
        }
        if (o.macro === 'Fill') {
          const nx = o.xnum ?? 1,
            ny = o.ynum ?? 1;
          for (let iy = 0; iy < ny; iy++)
            for (let ix = 0; ix < nx; ix++)
              objects.push({
                ...o,
                macro: undefined,
                x: o.x + ix * (o.xwidth ?? 8),
                y: (o.y ?? 0) + iy * (o.yheight ?? 8),
              });
        } else if (o.macro === 'Ceiling') {
          for (let i = 0; i < Math.floor((o.width ?? 8) / 8); i++)
            objects.push({
              thing: 'Brick',
              x: o.x + i * 8,
              y: 88,
              sourceSection: section,
            });
        } else if (o.macro === 'Section') {
          const next = o.section ?? 0;
          if (expandedSections.has(next)) {
            // 8-4 repeats this room until its correct pipe is found.
            const targetX = sectionStarts.get(`${areaId}:${next}`) ?? 0;
            result.mazeExits.push({
              id: `loop-${areaId}-${next}`,
              area: areaId,
              z: point(areaId, o.x).z,
              requires: [],
              target: point(areaId, targetX + 12, 0),
            });
            continue;
          }
          expandedSections.add(next);
          sectionStarts.set(`${areaId}:${next}`, o.x);
          const chunk = area.sections?.[next];
          if (!chunk) throw new Error(`${map.name}: missing section ${next}`);
          expand(chunk.before?.creation ?? [], o.x, next);
          const stretchX = o.x + (chunk.before?.width ?? 0);
          if (chunk.stretch)
            expand(
              chunk.stretch.creation.map((c) => ({ ...c, x: 0, width: 128 })),
              stretchX,
              next,
            );
          expand(
            chunk.after?.creation ?? [],
            stretchX + (chunk.stretch ? 128 : 0),
            next,
          );
        } else if (o.macro === 'SectionPass') {
          const id = `route-${areaId}-${section}-${result.mazeRoutes.length}`;
          result.mazeRoutes.push({
            id,
            area: areaId,
            startZ: point(areaId, o.x).z,
            endZ: point(areaId, o.x + (o.width ?? 8)).z,
            minY:
              ((o.y ?? 0) - (typeof o.height === 'number' ? o.height : 8)) *
              MAP_UNIT,
            maxY: (o.y ?? 0) * MAP_UNIT,
            group: mazeGroup,
          });
          routesInGroup.push(id);
        } else if (o.macro === 'SectionDecider') {
          const start = sectionStarts.get(`${areaId}:${o.fail ?? 0}`) ?? 0;
          result.mazeExits.push({
            id: `maze-${areaId}-${mazeGroup}`,
            area: areaId,
            z: point(areaId, o.x).z,
            requires: [...routesInGroup],
            target: point(areaId, start + 4),
          });
          routesInGroup.length = 0;
          mazeGroup++;
          expand(
            [{ macro: 'Section', x: o.x, section: o.pass ?? 0 }],
            0,
            section,
          );
        } else if (o.macro !== 'SectionFail') objects.push(o);
      }
    }
    expand(area.creation);
    // The structured reference omitted the final underwater exit destination.
    // The annotated World 8-4 map explicitly links it to the final castle room.
    if (map.name === '8-4' && areaId === 3) {
      const exit = objects.find((o) => o.thing === 'PipeHorizontal');
      if (exit) exit.transport = 5;
    }
    if (map.name === '3-1' && areaId === 1) {
      const exit = objects.find((o) => o.thing === 'PipeHorizontal');
      if (exit) {
        exit.transport = 1;
        delete exit.entrance;
      }
    }
    if (map.name === '7-1' && areaId === 1) {
      const exit = objects.find((o) => o.thing === 'PipeHorizontal');
      if (exit) exit.transport = 1;
    }
    if (map.name === '7-2' && areaId === 1) {
      const exit = objects.find((o) => o.thing === 'PipeHorizontal');
      if (exit) exit.transport = 2;
    }
    if (map.name === '2-1' && areaId === 0) {
      const pipe = objects.find((o) => o.macro === 'Pipe' && o.x === 368);
      if (pipe) pipe.piranha = true;
    }
    flattened.push(objects);
    const length = Math.max(
      128,
      ...objects.map(
        (o) =>
          (o.x ?? 0) +
          (o.width ??
            (o.macro === 'EndOutsideCastle'
              ? 176
              : o.macro === 'EndInsideCastle'
                ? 256
                : 16)),
      ),
    );
    if (length > longest) {
      longest = length;
      result.mainArea = areaId;
    }
    result.areas.push({
      id: areaId,
      name: area.setting,
      setting: area.setting,
      theme: theme(area.setting),
      center: areaId * AREA_SPACING,
      length: length * MAP_UNIT,
      spawn: point(areaId, 16),
      underwater: !!area.underwater || area.setting.includes('Underwater'),
      ceiling: 10.2,
    });
    let cheepStart: number | undefined, billStart: number | undefined;
    for (const [n, o] of objects.entries()) {
      const x = o.x ?? 0,
        y = o.y ?? 0,
        w = o.width ?? 8,
        h = typeof o.height === 'number' ? o.height : 8;
      const kind = o.macro ?? o.thing ?? '';
      const style =
        area.setting.includes('Underworld') || area.setting.includes('Castle')
          ? 'stone'
          : area.setting.includes('Underwater')
            ? 'stone'
            : 'ground';
      switch (kind) {
        case 'Floor':
          addSurface(areaId, x, y, w, 64, style);
          break;
        case 'Stone':
          addSurface(
            areaId,
            x,
            y,
            w,
            o.height === 'Infinity' ? y + 64 : h,
            'stone',
          );
          break;
        case 'Brick':
        case 'Block': {
          const contents = Array.isArray(o.contents)
            ? o.contents[0]
            : o.contents;
          if (kind === 'Brick' && !contents) {
            addSurface(areaId, x, y, 8, 8, 'brick', {
              breakable: true,
              kind: 'brick',
            });
            break;
          }
          const rewards: Record<string, Reward> = {
            Mushroom: 'upgrade',
            Mushroom1Up: 'life',
            Star: 'star',
            Coin: 'coin',
            Vine: 'vine',
          };
          const reward = rewards[contents ?? 'Coin'] ?? 'coin';
          const id = `block-${areaId}-${n}`;
          const q = {
            ...point(areaId, x, y - 4, 8),
            reward,
            w: COURSE_WIDTH,
            h: TILE,
            d: TILE,
            hidden: !!o.hidden,
            brick: kind === 'Brick',
            coins: kind === 'Brick' && reward === 'coin' ? 10 : 1,
            portal: reward === 'vine' ? id : undefined,
            area: areaId,
            sourceX: x,
            sourceY: y,
          };
          result.blocks.push(q);
          if (reward === 'vine' && Array.isArray(o.contents))
            unlinked.push({
              object: {
                ...o,
                transport: o.contents[1].transport ?? o.contents[1].entrance,
              },
              area: areaId,
              point: point(areaId, x, y, 8),
              mode: 'vine',
              block: id,
            });
          break;
        }
        case 'Pipe':
        case 'PipeVertical':
        case 'PipeHorizontal': {
          const horizontal = kind === 'PipeHorizontal',
            macro = !!o.macro;
          const height =
            o.height === 'Infinity'
              ? y + 64
              : macro
                ? (o.height ?? 16)
                : (o.height ?? (horizontal ? 16 : 32));
          const top = macro ? (o.height === 'Infinity' ? y : y + height) : y;
          const depth = horizontal ? (o.width ?? 16) : 16;
          result.pipes.push({
            ...point(areaId, x, top - height, depth),
            height: height * MAP_UNIT,
            w: COURSE_WIDTH,
            d: depth * MAP_UNIT,
            horizontal,
            area: areaId,
            sourceX: x,
          });
          const entry = point(areaId, x, top, depth);
          if (o.entrance !== undefined)
            entrances.set(o.entrance, { area: areaId, point: entry });
          if (o.transport !== undefined)
            unlinked.push({
              object: o,
              area: areaId,
              point: horizontal
                ? point(areaId, x - 2, Math.max(0, top - 16))
                : entry,
              mode: horizontal ? 'walk' : 'pipe',
            });
          if (o.piranha)
            result.enemies.push({
              ...entry,
              kind: 'piranha',
              range: 0,
              area: areaId,
              sourceX: x,
              sourceY: top,
            });
          break;
        }
        case 'Tree':
        case 'Shroom':
          addSurface(
            areaId,
            x,
            y,
            o.width ?? 24,
            8,
            kind === 'Tree' ? 'tree' : 'shroom',
          );
          break;
        case 'Coral':
          addSurface(areaId, x, y, w, h, 'coral');
          break;
        case 'Bridge': {
          const width = Math.max(16, o.width ?? 16);
          addSurface(areaId, x, y, width, 4, 'bridge');
          if (o.begin) addSurface(areaId, x, y, 8, y + 32, 'stone');
          if (o.end) addSurface(areaId, x + width - 8, y, 8, y + 32, 'stone');
          break;
        }
        case 'Platform': {
          let motion: Motion | undefined;
          if (
            o.floating &&
            typeof o.begin === 'number' &&
            typeof o.end === 'number'
          )
            motion = {
              axis: 'y',
              distance: ((o.end - o.begin) * MAP_UNIT) / 2,
              speed: 0.9,
              phase: Math.asin(
                Math.max(
                  -1,
                  Math.min(
                    1,
                    (y - (o.begin + o.end) / 2) / ((o.end - o.begin) / 2),
                  ),
                ),
              ),
            };
          if (
            o.sliding &&
            typeof o.begin === 'number' &&
            typeof o.end === 'number'
          )
            motion = {
              axis: 'z',
              distance: ((o.end - o.begin) * MAP_UNIT) / 2,
              speed: 0.8,
              phase: Math.asin(
                Math.max(
                  -1,
                  Math.min(
                    1,
                    ((o.begin + o.end) / 2 - x) / ((o.end - o.begin) / 2),
                  ),
                ),
              ),
            };
          if (o.falling)
            motion = { axis: 'y', distance: 8, speed: 1.7, mode: 'falling' };
          if (o.movement === 'movePlatformTransport' || o.transport === true)
            motion = {
              axis: 'z',
              distance: 90,
              speed: 2,
              mode: 'ride',
              direction: -1,
            };
          const posX =
            o.sliding &&
            typeof o.begin === 'number' &&
            typeof o.end === 'number'
              ? (o.begin + o.end) / 2
              : x;
          const posY =
            o.floating &&
            typeof o.begin === 'number' &&
            typeof o.end === 'number'
              ? (o.begin + o.end) / 2
              : y;
          addSurface(areaId, posX, posY, o.width ?? 24, 4, 'wood', {
            moving: motion,
            sourceX: x,
            sourceY: y,
          });
          break;
        }
        case 'PlatformGenerator':
          for (let i = 0; i < 2; i++)
            addSurface(
              areaId,
              x,
              i * 48 + ((o.direction ?? 1) > 0 ? 0 : 8),
              o.width ?? 16,
              4,
              'wood',
              {
                moving: {
                  axis: 'y',
                  distance: 10.8,
                  speed: 1.8,
                  mode: 'elevator',
                  direction: o.direction ?? 1,
                  phase: i * 0.5 + ((o.direction ?? 1) > 0 ? 0 : 8 / 96),
                },
              },
            );
          break;
        case 'Scale': {
          const wl = o.widthLeft ?? 24,
            wr = o.widthRight ?? 24,
            between = o.between ?? 40,
            pair = `${areaId}-${n}`;
          addSurface(
            areaId,
            x - wl / 2,
            y - (o.dropLeft ?? 24),
            wl,
            4,
            'wood',
            {
              moving: {
                axis: 'y',
                distance: 8,
                speed: 1.4,
                mode: 'scale',
                pair,
                direction: 1,
              },
            },
          );
          addSurface(
            areaId,
            x + between - wr / 2,
            y - (o.dropRight ?? 24),
            wr,
            4,
            'wood',
            {
              moving: {
                axis: 'y',
                distance: 8,
                speed: 1.4,
                mode: 'scale',
                pair,
                direction: -1,
              },
            },
          );
          break;
        }
        case 'Springboard':
          addSurface(areaId, x, y || 14.5, 8, 14.5, 'wood', { spring: true });
          break;
        case 'Coin':
          result.coins.push(point(areaId, x, y - 3, 5));
          break;
        case 'CastleBlock': {
          if (!o.hidden) addSurface(areaId, x, y, 8, 8, 'stone');
          if (o.fireballs)
            result.firebars.push({
              ...point(areaId, x, y - 4, 8),
              length: Math.max(0.5, o.fireballs * 0.45),
              speed: (o.counterclockwise ? -1 : 1) * 1.3,
              area: areaId,
              plane: 'vertical',
            });
          break;
        }
        case 'Water':
          result.lava.push({
            ...point(areaId, x, y - 12, w),
            w: COURSE_WIDTH,
            h: 24 * MAP_UNIT,
            d: w * MAP_UNIT,
            area: areaId,
          });
          break;
        case 'Cannon':
          addSurface(areaId, x, y, w, h, 'stone');
          result.cannons.push({
            ...point(areaId, x, y, w),
            height: h * MAP_UNIT,
            area: areaId,
          });
          break;
        case 'Goomba':
        case 'Koopa':
        case 'Beetle':
        case 'HammerBro':
        case 'Blooper':
        case 'CheepCheep':
        case 'Lakitu':
        case 'Podoboo': {
          const kinds: Record<string, EnemyKind> = {
            Goomba: 'goomba',
            Koopa: 'koopa',
            Beetle: 'beetle',
            HammerBro: 'hammer',
            Blooper: 'blooper',
            CheepCheep: 'cheep',
            Lakitu: 'lakitu',
            Podoboo: 'podoboo',
          };
          const height = ['Koopa', 'HammerBro', 'Blooper'].includes(kind)
            ? 12
            : 8;
          result.enemies.push({
            ...point(areaId, x, y - height, 8),
            kind: kinds[kind],
            range: kind === 'Lakitu' ? 7 : 3,
            area: areaId,
            axis: 'z',
            flying: !!o.jumping || !!o.floating,
            leaping: kind === 'Podoboo',
            smart: !!o.smart,
            sourceX: x,
            sourceY: y,
          });
          break;
        }
        case 'CheepsStart':
          cheepStart = x;
          break;
        case 'CheepsStop':
          if (cheepStart !== undefined) {
            for (let cx = cheepStart + 32; cx < x; cx += 80)
              result.enemies.push({
                ...point(areaId, cx, -12),
                kind: 'cheep',
                range: 1,
                area: areaId,
                leaping: true,
              });
            cheepStart = undefined;
          }
          break;
        case 'BulletBillsStart':
          billStart = x;
          break;
        case 'BulletBillsStop':
          if (billStart !== undefined) {
            for (let cx = billStart + 72; cx < x; cx += 144)
              result.cannons.push({
                ...point(areaId, cx, 20),
                height: 0,
                area: areaId,
              });
            billStart = undefined;
          }
          break;
        case 'StartInsideCastle': {
          addSurface(areaId, x, y + 48, 24, 112, 'stone');
          addSurface(areaId, x + 24, y + 40, 8, 104, 'stone');
          addSurface(areaId, x + 32, y + 32, 8, 96, 'stone');
          if (w > 40) addSurface(areaId, x + 40, y + 24, w - 40, 88, 'stone');
          break;
        }
        case 'EndOutsideCastle':
          result.goal = point(areaId, x, 0);
          result.goalArea = areaId;
          break;
        case 'EndInsideCastle': {
          addSurface(areaId, x, y + 88, 256, 8, 'stone');
          addSurface(areaId, x, y + 24, 104, 4, 'bridge', {
            castleBridge: true,
          });
          result.lava.push({
            ...point(areaId, x, y - 8, 104),
            w: COURSE_WIDTH,
            h: 2,
            d: 104 * MAP_UNIT,
            area: areaId,
          });
          addSurface(areaId, x + 104, y, 152, 64, 'stone');
          addSurface(areaId, x + 104, y + 32, 24, 32, 'stone');
          addSurface(areaId, x + 112, y + 80, 16, 24, 'stone');
          result.boss = point(areaId, x + 69, y + 24, 12);
          result.axe = point(areaId, x + 108, y + 36);
          result.goal = point(areaId, x + 180, y);
          result.goalArea = areaId;
          break;
        }
        case 'WarpWorld':
          for (const [i, warp] of (o.warps ?? []).entries()) {
            const px = x + 8 + i * 32;
            result.pipes.push({
              ...point(areaId, px, 0, 16),
              height: 24 * MAP_UNIT,
              w: COURSE_WIDTH,
              d: 16 * MAP_UNIT,
              area: areaId,
              sourceX: px,
            });
            unlinked.push({
              object: { transport: { map: `${warp}-1` } },
              area: areaId,
              point: point(areaId, px, 24, 16),
              mode: 'pipe',
            });
          }
          break;
        default:
          break; // Decorative patterns, text and scroll triggers are not terrain.
      }
    }
  }
  const support = (p: Point, allowPipe = true) => {
    const tops = result.surfaces
      .filter(
        (s) =>
          Math.abs(s.x - p.x) < 0.1 &&
          Math.abs(s.z - p.z) < s.d / 2 - 0.1 &&
          !s.moving &&
          s.y + s.h / 2 <= p.y + 0.2,
      )
      .map((s) => s.y + s.h / 2);
    if (allowPipe)
      for (const pi of result.pipes)
        if (
          Math.abs(pi.x - p.x) < 0.1 &&
          Math.abs(pi.z - p.z) < (pi.d ?? 1.8) / 2
        )
          tops.push(pi.y + pi.height);
    return { ...p, y: Math.max(0, ...tops) };
  };
  for (const [i, loc] of map.locations.entries())
    if (!entrances.has(i)) {
      const a = loc.area ?? 0,
        castle = loc.entry === 'Castle';
      let spawn = point(a, loc.xloc ?? (castle ? 16 : 16), castle ? 48 : 0);
      // A plain bonus-room entrance drops in beside the left boundary wall.
      if (
        result.surfaces.some(
          (s) =>
            s.area === a &&
            Math.abs(s.z - spawn.z) < s.d / 2 + 0.35 &&
            s.y + s.h / 2 > spawn.y + 0.2 &&
            s.y - s.h / 2 < spawn.y + 1.65,
        )
      )
        spawn = point(a, 24, 0);
      entrances.set(i, { area: a, point: support(spawn) });
    }
  for (const [i, link] of unlinked.entries()) {
    const transport = link.object.transport;
    if (transport === undefined || typeof transport === 'boolean') continue;
    const warp =
      typeof transport === 'object'
        ? maps.findIndex((m) => m.name === transport.map)
        : undefined;
    const dest =
      typeof transport === 'number' ? entrances.get(transport) : undefined;
    if (typeof transport === 'number' && !dest)
      throw new Error(`${map.name}: broken pipe location ${transport}`);
    result.portals.push({
      ...link.point,
      id: link.block ?? `pipe-${i}`,
      area: link.area,
      targetArea: dest?.area ?? link.area,
      target: dest?.point ?? link.point,
      mode: link.mode,
      label:
        warp !== undefined
          ? `Warp to World ${transport && typeof transport === 'object' ? transport.map : ''}`
          : link.mode === 'vine'
            ? 'Climb the vine'
            : 'Enter pipe',
      warpLevel: warp,
      requiresBlock: link.block,
      radius: link.mode === 'walk' ? 1.7 : 1.25,
    });
  }
  for (const [i, a] of map.areas.entries())
    if (a.exit !== undefined) {
      const exit = entrances.get(a.exit);
      if (exit) result.areas[i].exit = exit;
    }
  result.spawn = entrances.get(0)!.point;
  result.startArea = entrances.get(0)!.area;
  for (const a of result.areas) {
    const firstLocation = map.locations.findIndex(
      (loc) => (loc.area ?? 0) === a.id,
    );
    a.spawn = entrances.get(firstLocation)?.point ?? a.spawn;
    // Collision boundaries also apply in the air: tall pipes cannot be skirted with a sideways hop.
    for (const side of [-1, 1])
      result.walls.push({
        x: a.center + side * (COURSE_WIDTH / 2 + 0.15),
        y: 3,
        z: START_Z - a.length / 2,
        w: 0.3,
        h: 30,
        d: a.length + 12,
        kind: 'boundary',
      });
    result.walls.push({
      x: a.center,
      y: 3,
      z: START_Z + 0.6,
      w: COURSE_WIDTH,
      h: 30,
      d: 1,
      kind: 'boundary',
    });
  }
  for (const exit of result.mazeExits) {
    const candidates = result.surfaces
      .filter(
        (b) =>
          b.area === exit.area &&
          !b.moving &&
          Math.abs(b.z - exit.target.z) < b.d / 2 - 0.1,
      )
      .map((b) => b.y + b.h / 2)
      .sort((a, b) => a - b);
    const y = candidates.find(
      (top) =>
        !result.surfaces.some(
          (b) =>
            b.area === exit.area &&
            Math.abs(b.z - exit.target.z) < b.d / 2 + 0.33 &&
            top + 0.82 > b.y - b.h / 2 + 0.01 &&
            top < b.y + b.h / 2 - 0.01,
        ),
    );
    exit.target = { ...exit.target, y: y ?? 0 };
  }
  const main = result.areas[result.mainArea];
  result.theme = main.theme;
  result.mapWidth = main.length;
  const bridge = map.areas[result.mainArea].creation.some(
    (o) => o.macro === 'CheepsStart',
  );
  result.kind =
    course === 3
      ? 'Castle'
      : main.underwater
        ? 'Underwater'
        : main.theme === 'cave'
          ? 'Underground'
          : bridge
            ? 'Bridge'
            : course === 2 &&
                map.areas[result.mainArea].creation.some(
                  (o) => o.macro === 'Tree' || o.macro === 'Shroom',
                )
              ? 'Athletic'
              : 'Overworld';
  result.subtitle = `World ${result.id} · ${result.kind}`;
  result.hint =
    course === 3
      ? result.mazeRoutes.length
        ? 'The castle repeats if you take the wrong passage. Find the correct route, then reach the axe.'
        : 'Dodge Bowser and reach the axe to drop his bridge.'
      : main.underwater
        ? 'Hold Jump to swim up. Use the exit pipe to return to the surface.'
        : 'Follow the original route. Hold Jump for height; press E on a pipe to explore.';
  // One safe midpoint on the main route; castles retain their intended single-run challenge.
  if (course !== 3) {
    const middle = START_Z - main.length * 0.45;
    const floor = result.surfaces
      .filter(
        (s) =>
          s.area === main.id &&
          !s.moving &&
          s.style === 'ground' &&
          s.d > 3 &&
          Math.abs(s.y + s.h / 2) < 0.01,
      )
      .sort((a, b) => Math.abs(a.z - middle) - Math.abs(b.z - middle))[0];
    if (floor)
      result.checkpoints.push({
        x: floor.x,
        y: 0,
        z: Math.max(
          floor.z - floor.d / 2 + 1,
          Math.min(floor.z + floor.d / 2 - 1, middle),
        ),
      });
  }
  result.checkpoint = result.checkpoints[0] ?? result.spawn;
  return result;
}
export const NES_LEVELS = maps.map((map, index) =>
  expandTo3D(compile(map, index)),
);
