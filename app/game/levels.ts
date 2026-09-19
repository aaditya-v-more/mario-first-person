import type { Box } from './physics';

export type Point = { x: number; y: number; z: number };
export type Theme = 'meadow' | 'cave' | 'sky' | 'lava' | 'night' | 'castle';
export type Power = 'mushroom' | 'flower' | 'star';
export type Surface = Box & {
  style?: 'ground' | 'brick' | 'stone' | 'cloud' | 'wood';
  moving?: {
    axis: 'x' | 'y' | 'z';
    distance: number;
    speed: number;
    phase?: number;
  };
};
export type Level = {
  id: string;
  name: string;
  theme: Theme;
  subtitle: string;
  hint: string;
  time: number;
  spawn: Point;
  goal: Point;
  checkpoint: Point;
  surfaces: Surface[];
  walls: Box[];
  pipes: (Point & { height: number })[];
  blocks: (Point & { reward: 'coin' | Power })[];
  enemies: (Point & { range: number; kind: 'goomba' | 'koopa' })[];
  coins: Point[];
  stars: Point[];
  firebars: (Point & { length: number; speed: number })[];
  boss?: Point;
  checkpoints?: Point[];
  world?: number;
  par?: number;
};
const p = (x: number, y: number, z: number): Point => ({ x, y, z });
// A surface's y is its top. The actual collision box and visible mesh share these bounds.
const floor = (
  x: number,
  y: number,
  z: number,
  w: number,
  d: number,
  style: Surface['style'] = 'ground',
  moving?: Surface['moving'],
): Surface => ({ x, y: y - 0.7, z, w, h: 1.4, d, style, moving });
const wall = (x: number, z: number, w: number, d: number): Box => ({
  x,
  y: 2,
  z,
  w,
  h: 20,
  d,
  kind: 'wall',
});
const line = (
  x: number,
  y: number,
  start: number,
  end: number,
  spacing = 3,
): Point[] =>
  Array.from({ length: Math.floor((start - end) / spacing) + 1 }, (_, i) =>
    p(x, y, start - i * spacing),
  );
const enemy = (
  x: number,
  y: number,
  z: number,
  range = 2,
  kind: 'goomba' | 'koopa' = 'goomba',
) => ({ ...p(x, y, z), range, kind });
const block = (
  x: number,
  y: number,
  z: number,
  reward: 'coin' | Power = 'coin',
) => ({ ...p(x, y, z), reward });
const pipe = (x: number, y: number, z: number, height = 2.2) => ({
  ...p(x, y, z),
  height,
});

const COURSE_SECTIONS: Level[] = [
  {
    id: '1–1',
    name: 'Mushroom Meadows',
    theme: 'meadow',
    subtitle: 'A familiar world. A whole new adventure.',
    hint: 'Follow the coins. Gaps span the entire island — jump near the edge!',
    time: 210,
    spawn: p(0, 0, 13),
    goal: p(0, 0, -99),
    checkpoint: p(0, 1, -65),
    surfaces: [
      floor(0, 0, 5, 12, 26),
      floor(0, 0, -24, 10, 22),
      floor(3, 1, -47, 8, 16),
      floor(0, 1, -68, 12, 18),
      floor(0, 0, -93, 10, 24),
      floor(0, 1.2, -3, 12, 2, 'brick'),
      floor(8.5, 2.8, -48, 3, 5, 'brick'),
      floor(0, 1.2, -88, 10, 2, 'brick'),
    ],
    walls: [],
    pipes: [pipe(-2, 0, -21), pipe(2, 0, -29), pipe(-3, 1, -70)],
    blocks: [
      block(0, 3.1, 2),
      block(2, 3.1, 2, 'mushroom'),
      block(2, 4.1, -64),
      block(-1, 3.1, -93),
    ],
    enemies: [
      enemy(1, 0, -18, 2),
      enemy(3, 1, -50, 2),
      enemy(0, 1, -72, 3),
      enemy(0, 0, -94, 2),
    ],
    coins: [
      ...line(0, 1.1, 10, 4),
      ...line(0, 2.4, -2, -5),
      ...line(0, 1.1, -15, -18),
      ...line(0, 1.1, -24, -33),
      ...line(3, 2.1, -41, -53),
      ...line(0, 2.1, -60, -63),
      ...line(1, 2.1, -69, -75),
      ...line(0, 1.1, -83, -85),
      ...line(0, 1.1, -91, -96),
    ],
    stars: [p(-2, 3.2, -21), p(8.5, 3.9, -48), p(-1, 4.8, -93)],
    firebars: [],
  },
  {
    id: '1–2',
    name: 'The Pipeworks',
    theme: 'cave',
    subtitle: 'Down the pipe. Into the unknown.',
    hint: 'The cavern walls are solid. Ride the striped ferry across the deep shaft.',
    time: 240,
    spawn: p(0, 0, 13),
    goal: p(0, 0, -101),
    checkpoint: p(0, 0, -63),
    surfaces: [
      floor(0, 0, 3, 12, 26, 'stone'),
      floor(0, 0, -26, 12, 22, 'stone'),
      floor(0, 0, -47, 5, 5, 'wood', { axis: 'z', distance: 5, speed: 0.75 }),
      floor(0, 0, -66, 12, 18, 'stone'),
      floor(0, 0, -93, 12, 26, 'stone'),
      floor(0, 1.8, -4, 12, 2, 'brick'),
      floor(4, 2.2, -23, 3, 5, 'stone'),
      floor(-4, 2, -87, 3, 5, 'stone'),
      floor(4, 3, -93, 3, 5, 'stone'),
    ],
    walls: [wall(-6.6, -45, 1.2, 124), wall(6.6, -45, 1.2, 124)],
    pipes: [pipe(-3, 0, -19), pipe(2, 0, -31, 2.5), pipe(0, 0, -87)],
    blocks: [
      block(0, 3.1, 5, 'flower'),
      block(-2, 3.1, -28),
      block(1, 3.1, -66, 'mushroom'),
    ],
    enemies: [
      enemy(0, 0, -22, 1),
      enemy(-1, 0, -33, 2, 'koopa'),
      enemy(0, 0, -70, 3),
      enemy(2, 0, -96, 2, 'koopa'),
    ],
    coins: [
      ...line(0, 1.1, 10, 7),
      ...line(0, 3, -3, -6),
      ...line(0, 1.1, -17, -34),
      ...line(0, 1.1, -59, -72),
      ...line(-2, 1.1, -81, -97),
    ],
    stars: [p(4, 3.3, -23), p(-4, 3.1, -87), p(4, 4.1, -93)],
    firebars: [],
  },
  {
    id: '2–1',
    name: 'Cloudstep Heights',
    theme: 'sky',
    subtitle: 'A little courage. A lot of sky.',
    hint: 'Aim for the landing shadow. Moving platforms carry you — wait for your moment.',
    time: 270,
    spawn: p(0, 0, 13),
    goal: p(0, 2, -105),
    checkpoint: p(0, 2, -66),
    surfaces: [
      floor(0, 0, 6, 10, 22, 'cloud'),
      floor(-2, 1, -15, 7, 12, 'cloud'),
      floor(2, 2, -31, 7, 12, 'cloud'),
      floor(0, 2, -46, 6, 7, 'wood', { axis: 'x', distance: 3, speed: 0.65 }),
      floor(0, 2, -66, 12, 20, 'cloud'),
      floor(-3, 3, -85, 7, 10, 'cloud'),
      floor(0, 2, -103, 12, 18, 'cloud'),
      floor(6, 4, -66, 3, 5, 'cloud'),
    ],
    walls: [],
    pipes: [pipe(-3, 2, -67, 2)],
    blocks: [
      block(0, 3.1, 7, 'mushroom'),
      block(2, 5.1, -30),
      block(-3, 6.1, -85),
    ],
    enemies: [
      enemy(-2, 1, -16, 1.3),
      enemy(1, 2, -64, 2, 'koopa'),
      enemy(0, 2, -103, 3),
    ],
    coins: [
      ...line(0, 1.1, 11, 0),
      ...line(-2, 2.1, -11, -18),
      ...line(2, 3.1, -27, -33),
      ...line(0, 3.1, -58, -72),
      ...line(-3, 4.1, -82, -88),
      ...line(0, 3.1, -98, -105),
    ],
    stars: [p(2, 6.2, -30), p(6, 5.1, -66), p(-3, 7.2, -85)],
    firebars: [],
  },
  {
    id: '2–2',
    name: 'Ember Crossing',
    theme: 'lava',
    subtitle: 'Hot feet. Cool head.',
    hint: 'Lava fills every gap. Watch the firebars, then jump over their sweep.',
    time: 270,
    spawn: p(0, 0, 13),
    goal: p(0, 1, -103),
    checkpoint: p(0, 1, -62),
    surfaces: [
      floor(0, 0, 5, 10, 24, 'stone'),
      floor(0, 1, -21, 10, 20, 'stone'),
      floor(0, 1, -44, 5, 6, 'wood', { axis: 'z', distance: 4, speed: 0.7 }),
      floor(0, 1, -64, 12, 20, 'stone'),
      floor(-3, 2, -86, 7, 14, 'stone'),
      floor(0, 1, -106, 12, 16, 'stone'),
      floor(4, 3.2, -22, 3, 5, 'brick'),
    ],
    walls: [wall(-7, -47, 2, 132), wall(7, -47, 2, 132)],
    pipes: [pipe(3, 1, -62, 2)],
    blocks: [
      block(0, 3.1, 6, 'flower'),
      block(-2, 4.1, -60, 'star'),
      block(0, 4.1, -103),
    ],
    enemies: [
      enemy(0, 1, -18, 2, 'koopa'),
      enemy(-2, 1, -68, 2),
      enemy(-3, 2, -86, 1.5, 'koopa'),
    ],
    coins: [
      ...line(0, 1.1, 10, 1),
      ...line(-1, 2.1, -13, -27),
      ...line(0, 2.1, -57, -71),
      ...line(-3, 3.1, -81, -89),
      ...line(0, 2.1, -101, -108),
    ],
    stars: [p(4, 4.3, -22), p(3, 4.1, -62), p(0, 5.2, -103)],
    firebars: [
      { ...p(0, 1.6, -22), length: 4.8, speed: 1.25 },
      { ...p(0, 1.6, -66), length: 5.3, speed: -1.1 },
    ],
  },
  {
    id: '3–1',
    name: 'Moonlit Battlements',
    theme: 'night',
    subtitle: 'The kingdom is counting on you.',
    hint: 'Climb the battlements. Koopas take two stomps; a fire flower can help.',
    time: 270,
    spawn: p(0, 0, 13),
    goal: p(0, 2, -112),
    checkpoint: p(0, 3, -66),
    surfaces: [
      floor(0, 0, 6, 12, 24, 'stone'),
      floor(0, 1.4, -3, 12, 3, 'brick'),
      floor(-2, 2, -20, 8, 18, 'stone'),
      floor(2, 3, -41, 8, 16, 'stone'),
      floor(0, 3, -65, 12, 22, 'stone'),
      floor(0, 3, -89, 5, 5, 'wood', { axis: 'z', distance: 4, speed: 0.7 }),
      floor(0, 2, -111, 12, 18, 'stone'),
      floor(5, 5, -63, 3, 5, 'brick'),
    ],
    walls: [wall(-7, -53, 2, 140), wall(7, -53, 2, 140)],
    pipes: [pipe(-3, 3, -70, 2)],
    blocks: [
      block(0, 3.1, 6, 'flower'),
      block(-2, 5.1, -20),
      block(0, 6.1, -65, 'mushroom'),
    ],
    enemies: [
      enemy(-2, 2, -22, 1.5, 'koopa'),
      enemy(2, 3, -40, 1.5, 'koopa'),
      enemy(0, 3, -64, 2),
      enemy(0, 2, -110, 3, 'koopa'),
    ],
    coins: [
      ...line(0, 1.1, 11, 2),
      ...line(-2, 3.1, -14, -26),
      ...line(2, 4.1, -36, -46),
      ...line(0, 4.1, -57, -72),
      ...line(0, 3.1, -105, -114),
    ],
    stars: [p(-2, 6.2, -20), p(5, 6.1, -63), p(-3, 6.1, -70)],
    firebars: [{ ...p(1, 3.6, -68), length: 4.7, speed: 1.3 }],
  },
  {
    id: '3–2',
    name: 'Bowser’s Last Stand',
    theme: 'castle',
    subtitle: 'One final jump for the kingdom.',
    hint: 'Cross the lava, then defeat Bowser with three stomps or fireballs. Dodge his fire!',
    time: 300,
    spawn: p(0, 0, 13),
    goal: p(0, 1, -116),
    checkpoint: p(0, 1, -70),
    surfaces: [
      floor(0, 0, 5, 12, 24, 'stone'),
      floor(0, 1, -23, 10, 22, 'stone'),
      floor(0, 1, -47, 5, 6, 'wood', { axis: 'z', distance: 4, speed: 0.75 }),
      floor(0, 1, -69, 12, 18, 'stone'),
      floor(0, 1, -104, 12, 44, 'stone'),
      floor(-4, 2.8, -93, 3, 5, 'brick'),
      floor(4, 2.8, -100, 3, 5, 'brick'),
    ],
    walls: [wall(-7, -54, 2, 146), wall(7, -54, 2, 146)],
    pipes: [],
    blocks: [
      block(0, 3.1, 6, 'flower'),
      block(-2, 4.1, -69, 'flower'),
      block(2, 4.1, -72, 'mushroom'),
    ],
    enemies: [
      enemy(0, 1, -18, 2, 'koopa'),
      enemy(0, 1, -28, 2),
      enemy(0, 1, -73, 2, 'koopa'),
    ],
    coins: [
      ...line(0, 1.1, 10, 1),
      ...line(-1, 2.1, -15, -30),
      ...line(0, 2.1, -63, -75),
      ...line(0, 2.1, -85, -90),
    ],
    stars: [p(4, 2.2, -29), p(-4, 3.9, -93), p(4, 3.9, -100)],
    firebars: [{ ...p(0, 1.6, -24), length: 4.6, speed: 1.35 }],
    boss: p(0, 1, -103),
  },
];
export const PALETTES: Record<
  Theme,
  {
    sky: string;
    fog: string;
    ground: string;
    edge: string;
    ambient: string;
    sun: string;
  }
> = {
  meadow: {
    sky: '#8fd9f1',
    fog: '#b7e3df',
    ground: '#64ba37',
    edge: '#95d94e',
    ambient: '#d5efff',
    sun: '#fff0c7',
  },
  cave: {
    sky: '#142c3b',
    fog: '#264b60',
    ground: '#477b93',
    edge: '#71a9bb',
    ambient: '#9bd1f4',
    sun: '#bce9ff',
  },
  sky: {
    sky: '#86c8f3',
    fog: '#d2e8ff',
    ground: '#fff4e3',
    edge: '#d4eafa',
    ambient: '#e7eaff',
    sun: '#fff1d5',
  },
  lava: {
    sky: '#402337',
    fog: '#703444',
    ground: '#62566c',
    edge: '#998498',
    ambient: '#e3b8da',
    sun: '#ffb982',
  },
  night: {
    sky: '#172946',
    fog: '#334966',
    ground: '#657b9b',
    edge: '#a0b4cd',
    ambient: '#b8c8ff',
    sun: '#d4e7ff',
  },
  castle: {
    sky: '#261d31',
    fog: '#4e3141',
    ground: '#68617b',
    edge: '#aaa0ac',
    ambient: '#cab8dc',
    sun: '#ffce9c',
  },
};

// Authored route sections are composed into long courses. Every section changes
// the actual walkable footprint; an empty lane never runs beside an obstacle.
const routeSection = (
  name: string,
  surfaces: Surface[],
  extra: Partial<Level> = {},
): Level => ({
  id: '',
  name,
  theme: 'meadow',
  subtitle: '',
  hint: '',
  time: 240,
  spawn: p(0, 0, 13),
  goal: p(0, 0, -112),
  checkpoint: p(0, 0, -65),
  surfaces,
  walls: [],
  pipes: [],
  blocks: [],
  enemies: [],
  coins: [],
  stars: [],
  firebars: [],
  ...extra,
});
const SECTIONS: Record<string, Level> = {
  meadow: COURSE_SECTIONS[0],
  pipes: COURSE_SECTIONS[1],
  clouds: COURSE_SECTIONS[2],
  embers: COURSE_SECTIONS[3],
  ramparts: COURSE_SECTIONS[4],
  boss: COURSE_SECTIONS[5],
  switchbacks: routeSection(
    'Switchback Islands',
    [
      floor(0, 0, 5, 10, 26),
      floor(-4, 1, -17, 6, 10),
      floor(3, 2, -32, 6, 12),
      floor(-3, 2, -48, 6, 12),
      floor(0, 0, -66, 12, 16),
      floor(4, 1, -83, 6, 10),
      floor(-2, 2, -98, 7, 12),
      floor(0, 0, -115, 12, 16),
    ],
    {
      coins: [
        ...line(0, 1.1, 10, -4),
        ...line(-4, 2.1, -14, -19),
        ...line(3, 3.1, -28, -35),
        ...line(-3, 3.1, -44, -51),
        ...line(0, 1.1, -61, -70),
        ...line(4, 2.1, -80, -85),
        ...line(-2, 3.1, -95, -101),
        ...line(0, 1.1, -111, -117),
      ],
      blocks: [block(0, 3.1, 6, 'mushroom'), block(-3, 5.1, -48)],
      stars: [p(-3, 6.2, -48)],
      enemies: [enemy(0, 0, -66, 3), enemy(4, 1, -83, 1, 'koopa')],
    },
  ),
  staircase: routeSection(
    'The Great Climb',
    [
      floor(0, 0, 5, 10, 26),
      floor(0, 1.5, -14, 10, 5, 'brick'),
      floor(0, 3, -23, 8, 6, 'brick'),
      floor(-3, 4.5, -33, 7, 6, 'brick'),
      floor(2, 6, -44, 7, 8, 'brick'),
      floor(0, 4, -61, 12, 18),
      floor(0, 2, -80, 10, 12),
      floor(0, 0, -98, 10, 14),
      floor(0, 0, -114, 12, 12),
    ],
    {
      checkpoint: p(0, 4, -62),
      coins: [
        ...line(0, 1.1, 10, -4),
        p(0, 2.6, -14),
        p(0, 4.1, -23),
        p(-3, 5.6, -33),
        p(2, 7.1, -44),
        ...line(0, 5.1, -55, -67),
        ...line(0, 3.1, -77, -83),
        ...line(0, 1.1, -93, -117),
      ],
      blocks: [block(0, 3.1, 6, 'flower'), block(2, 9.1, -44)],
      stars: [p(2, 10.2, -44)],
      enemies: [enemy(0, 4, -61, 3, 'koopa'), enemy(0, 2, -80, 3)],
    },
  ),
  ferries: routeSection(
    'Ferry Hopping',
    [
      floor(0, 0, 5, 10, 26),
      floor(0, 0, -21, 5, 6, 'wood', { axis: 'z', distance: 5, speed: 0.7 }),
      floor(0, 0, -40, 12, 12),
      floor(0, 1, -57, 6, 7, 'wood', { axis: 'x', distance: 3, speed: 0.7 }),
      floor(0, 1, -74, 12, 14),
      floor(0, 1, -92, 5, 6, 'wood', { axis: 'z', distance: 4, speed: 0.8 }),
      floor(0, 0, -112, 12, 18),
      floor(5, 2.5, -40, 3, 5, 'brick'),
    ],
    {
      checkpoint: p(0, 1, -73),
      coins: [
        ...line(0, 1.1, 10, -4),
        ...line(0, 1.1, -36, -42),
        ...line(0, 2.1, -70, -78),
        ...line(0, 1.1, -106, -117),
      ],
      blocks: [block(0, 3.1, 5, 'mushroom'), block(-2, 4.1, -72)],
      stars: [p(5, 3.6, -40)],
      enemies: [enemy(0, 0, -40, 3), enemy(0, 1, -75, 3, 'koopa')],
    },
  ),
  crossroads: routeSection(
    'The Split Road',
    [
      floor(0, 0, 5, 12, 26),
      floor(-4, 1, -21, 5, 18),
      floor(4, 0, -21, 5, 18),
      floor(0, 1, -40, 12, 12),
      floor(0, 1, -61, 5, 20),
      floor(-4, 2, -80, 5, 12),
      floor(4, 1, -80, 5, 12),
      floor(0, 0, -99, 12, 16),
      floor(0, 0, -115, 12, 12),
      floor(0, 3.5, -41, 3, 4, 'brick'),
    ],
    {
      checkpoint: p(0, 1, -61),
      coins: [
        ...line(0, 1.1, 10, -4),
        ...line(-4, 2.1, -14, -27),
        ...line(4, 1.1, -14, -27),
        ...line(0, 2.1, -36, -44),
        ...line(0, 2.1, -54, -68),
        ...line(-4, 3.1, -77, -83),
        ...line(4, 2.1, -77, -83),
        ...line(0, 1.1, -94, -117),
      ],
      blocks: [block(0, 3.1, 6, 'flower'), block(4, 4.1, -79, 'star')],
      stars: [p(0, 4.6, -41)],
      enemies: [
        enemy(-4, 1, -20, 0.7),
        enemy(4, 0, -20, 0.7, 'koopa'),
        enemy(0, 1, -61, 1),
        enemy(0, 0, -98, 3),
      ],
    },
  ),
  hurdles: routeSection(
    'Brickworks',
    [
      floor(0, 0, 4, 12, 28),
      floor(0, 1.5, -4, 12, 2, 'brick'),
      floor(0, 0, -28, 12, 26),
      floor(0, 2, -22, 12, 2, 'brick'),
      floor(0, 1, -34, 12, 2, 'brick'),
      floor(0, 0, -63, 12, 34),
      floor(0, 1.8, -51, 12, 2, 'brick'),
      floor(0, 2.5, -73, 12, 2, 'brick'),
      floor(0, 0, -103, 12, 36),
      floor(0, 2, -91, 12, 2, 'brick'),
      floor(0, 1.2, -106, 12, 2, 'brick'),
    ],
    {
      walls: [wall(-6.6, -52, 1.2, 145), wall(6.6, -52, 1.2, 145)],
      coins: [
        ...line(0, 1.1, 11, 2),
        p(0, 2.6, -4),
        ...line(0, 1.1, -16, -19),
        p(0, 3.1, -22),
        p(0, 2.1, -34),
        ...line(0, 1.1, -57, -68),
        p(0, 3.6, -73),
        p(0, 3.1, -91),
        ...line(0, 1.1, -96, -102),
        p(0, 2.3, -106),
      ],
      blocks: [
        block(0, 3.1, 5, 'mushroom'),
        block(3, 3.1, -62),
        block(-3, 3.1, -98, 'flower'),
      ],
      stars: [p(3, 4.2, -62)],
      enemies: [
        enemy(0, 0, -29, 3),
        enemy(0, 0, -61, 3, 'koopa'),
        enemy(0, 0, -100, 3),
      ],
    },
  ),
  slalom: routeSection(
    'Pipe Slalom',
    [
      floor(0, 0, 5, 12, 26),
      floor(0, 0, -26, 12, 26),
      floor(0, 0, -64, 12, 40),
      floor(0, 0, -105, 12, 32),
      floor(-4, 2.5, -64, 3, 6, 'brick'),
    ],
    {
      walls: [
        wall(-6.6, -52, 1.2, 145),
        wall(6.6, -52, 1.2, 145),
        { x: -2, y: 2, z: -18, w: 8, h: 8, d: 1, kind: 'wall' },
        { x: 2, y: 2, z: -30, w: 8, h: 8, d: 1, kind: 'wall' },
        { x: -2, y: 2, z: -50, w: 8, h: 8, d: 1, kind: 'wall' },
        { x: 2, y: 2, z: -75, w: 8, h: 8, d: 1, kind: 'wall' },
      ],
      coins: [
        ...line(0, 1.1, 11, -4),
        p(4, 1.1, -16),
        p(4, 1.1, -21),
        p(0, 1.1, -24),
        p(-4, 1.1, -28),
        p(-4, 1.1, -34),
        p(4, 1.1, -48),
        p(4, 1.1, -53),
        ...line(0, 1.1, -58, -68),
        p(-4, 1.1, -74),
        p(-4, 1.1, -78),
        ...line(0, 1.1, -93, -114),
      ],
      blocks: [block(0, 3.1, 5, 'flower'), block(0, 3.1, -63, 'mushroom')],
      stars: [p(-4, 3.6, -64)],
      pipes: [pipe(0, 0, -103, 2.5)],
      enemies: [
        enemy(4, 0, -22, 0.7),
        enemy(-4, 0, -35, 0.7),
        enemy(0, 0, -64, 2, 'koopa'),
        enemy(0, 0, -111, 3),
      ],
    },
  ),
  lift: routeSection(
    'Upward Bound',
    [
      floor(0, 0, 5, 10, 26),
      floor(0, 1, -18, 7, 8, 'wood', { axis: 'y', distance: 1, speed: 0.8 }),
      floor(0, 3, -32, 10, 12),
      floor(-3, 4, -49, 7, 12),
      floor(0, 4, -66, 12, 16),
      floor(2, 3, -84, 7, 12),
      floor(0, 1, -101, 10, 12),
      floor(0, 0, -116, 12, 12),
      floor(5, 6, -66, 3, 6, 'brick'),
    ],
    {
      checkpoint: p(0, 4, -65),
      coins: [
        ...line(0, 1.1, 11, -4),
        ...line(0, 4.1, -28, -35),
        ...line(-3, 5.1, -45, -51),
        ...line(0, 5.1, -61, -70),
        ...line(2, 4.1, -80, -87),
        ...line(0, 2.1, -98, -104),
        p(0, 1.1, -115),
      ],
      blocks: [block(0, 3.1, 5, 'mushroom'), block(-3, 7.1, -49)],
      stars: [p(5, 7.1, -66)],
      enemies: [
        enemy(0, 3, -32, 2),
        enemy(0, 4, -66, 3, 'koopa'),
        enemy(2, 3, -84, 1),
      ],
    },
  ),
  crossfire: routeSection(
    'Firebar Alley',
    [
      floor(0, 0, 5, 12, 26),
      floor(0, 0, -24, 12, 22),
      floor(0, 1, -46, 10, 14),
      floor(0, 1, -65, 12, 16),
      floor(0, 0, -87, 12, 18),
      floor(0, 0, -110, 12, 18),
      floor(5, 2.5, -64, 3, 5, 'brick'),
    ],
    {
      checkpoint: p(0, 1, -65),
      walls: [wall(-7, -51, 2, 144), wall(7, -51, 2, 144)],
      coins: [
        ...line(0, 1.1, 11, -4),
        ...line(0, 1.1, -17, -31),
        ...line(0, 2.1, -42, -49),
        ...line(0, 2.1, -61, -70),
        ...line(0, 1.1, -82, -93),
        ...line(0, 1.1, -105, -114),
      ],
      blocks: [block(0, 3.1, 5, 'star'), block(0, 4.1, -60, 'flower')],
      stars: [p(5, 3.6, -64)],
      firebars: [
        { ...p(0, 0.6, -23), length: 5.5, speed: 1.2 },
        { ...p(0, 1.6, -45), length: 4.4, speed: -1.35 },
        { ...p(0, 0.6, -86), length: 5.4, speed: 1.45 },
      ],
      enemies: [enemy(0, 1, -67, 3, 'koopa')],
    },
  ),
};
export const WORLDS = [
  {
    name: 'Mushroom Kingdom',
    theme: 'meadow' as Theme,
    description: 'Find your feet, then take the high road.',
  },
  {
    name: 'Crystal Underground',
    theme: 'cave' as Theme,
    description: 'Winding passages and ferries over the abyss.',
  },
  {
    name: 'Cloudtop Islands',
    theme: 'sky' as Theme,
    description: 'Every landing is a leap of faith.',
  },
  {
    name: 'Ember Archipelago',
    theme: 'lava' as Theme,
    description: 'A kingdom of fire. Keep moving.',
  },
  {
    name: 'Moonlit Citadel',
    theme: 'night' as Theme,
    description: 'Climb the walls and break the siege.',
  },
  {
    name: 'Bowser’s Domain',
    theme: 'castle' as Theme,
    description: 'The final road to the throne.',
  },
];
type CoursePlan = {
  name: string;
  sections: string[];
  hint: string;
  par: number;
};
// Each row is a deliberate four-act / eight-stage course, not a randomly generated layout.
const CAMPAIGN: CoursePlan[][] = [
  [
    {
      name: 'Mushroom Meadows',
      sections: [
        'meadow',
        'hurdles',
        'crossroads',
        'meadow',
        'switchbacks',
        'hurdles',
        'crossroads',
        'meadow',
      ],
      hint: 'Follow the coins. Hold Jump for height, and use Sprint for longer gaps.',
      par: 280,
    },
    {
      name: 'The Long Way Up',
      sections: [
        'meadow',
        'staircase',
        'crossroads',
        'lift',
        'switchbacks',
        'staircase',
        'meadow',
        'lift',
      ],
      hint: 'Use the landing shadow to judge your feet. The high route hides star coins.',
      par: 310,
    },
    {
      name: 'River of Islands',
      sections: [
        'crossroads',
        'ferries',
        'switchbacks',
        'meadow',
        'lift',
        'ferries',
        'crossroads',
        'switchbacks',
      ],
      hint: 'Pick your route at each fork. Wait for ferries before committing to a jump.',
      par: 330,
    },
    {
      name: 'The Garden Gate',
      sections: [
        'hurdles',
        'slalom',
        'meadow',
        'crossroads',
        'staircase',
        'hurdles',
        'slalom',
        'boss',
      ],
      hint: 'Collect a fire flower on the way. Bowser guards the gate to the next world.',
      par: 340,
    },
  ],
  [
    {
      name: 'Into the Pipeworks',
      sections: [
        'pipes',
        'hurdles',
        'slalom',
        'pipes',
        'crossroads',
        'lift',
        'slalom',
        'pipes',
      ],
      hint: 'Read the bends in the passage. There is no path around the cavern walls.',
      par: 330,
    },
    {
      name: 'Crystal Ascent',
      sections: [
        'slalom',
        'lift',
        'pipes',
        'staircase',
        'crossroads',
        'hurdles',
        'lift',
        'crossroads',
      ],
      hint: 'The lift moves vertically. Ride it up, then jump to the next ledge.',
      par: 350,
    },
    {
      name: 'The Lost Aqueduct',
      sections: [
        'ferries',
        'pipes',
        'crossroads',
        'ferries',
        'lift',
        'slalom',
        'pipes',
        'switchbacks',
      ],
      hint: 'Stay aboard each striped platform until it brings the next bank within reach.',
      par: 360,
    },
    {
      name: 'Furnace Below',
      sections: [
        'slalom',
        'crossfire',
        'pipes',
        'hurdles',
        'lift',
        'ferries',
        'crossfire',
        'boss',
      ],
      hint: 'Jump over the firebars. Save a fire flower for the guardian at the exit.',
      par: 360,
    },
  ],
  [
    {
      name: 'Above the Clouds',
      sections: [
        'clouds',
        'switchbacks',
        'crossroads',
        'clouds',
        'lift',
        'staircase',
        'ferries',
        'clouds',
      ],
      hint: 'Look down to line up a landing. Sprint gives you the reach to cross the sky.',
      par: 340,
    },
    {
      name: 'Stairway to the Sun',
      sections: [
        'staircase',
        'lift',
        'clouds',
        'switchbacks',
        'staircase',
        'ferries',
        'lift',
        'staircase',
      ],
      hint: 'The staircase gets taller. Jump near each edge to preserve your distance.',
      par: 360,
    },
    {
      name: 'Skybound Express',
      sections: [
        'ferries',
        'clouds',
        'lift',
        'ferries',
        'switchbacks',
        'clouds',
        'staircase',
        'ferries',
      ],
      hint: 'Moving platforms are safe to stand on. Watch a full cycle before jumping.',
      par: 380,
    },
    {
      name: 'Thunderhead Fortress',
      sections: [
        'ramparts',
        'switchbacks',
        'clouds',
        'lift',
        'crossfire',
        'staircase',
        'clouds',
        'boss',
      ],
      hint: 'Land on Koopas twice. Bowser has claimed the highest island.',
      par: 370,
    },
  ],
  [
    {
      name: 'Ember Crossing',
      sections: [
        'embers',
        'crossroads',
        'crossfire',
        'embers',
        'ferries',
        'hurdles',
        'lift',
        'embers',
      ],
      hint: 'Lava fills the empty space. Jump over firebars after they pass your path.',
      par: 380,
    },
    {
      name: 'Molten Switchbacks',
      sections: [
        'switchbacks',
        'embers',
        'slalom',
        'crossfire',
        'crossroads',
        'ramparts',
        'embers',
        'crossfire',
      ],
      hint: 'Set up your angle before each jump. Star power blocks fire damage, not falls.',
      par: 380,
    },
    {
      name: 'Foundry on Fire',
      sections: [
        'lift',
        'crossfire',
        'ferries',
        'embers',
        'staircase',
        'slalom',
        'ferries',
        'embers',
      ],
      hint: 'Use the lifts and ferries to cross the foundry. Touch the checkpoint rings.',
      par: 400,
    },
    {
      name: 'The Inferno Gate',
      sections: [
        'crossfire',
        'embers',
        'ramparts',
        'slalom',
        'ferries',
        'lift',
        'crossfire',
        'boss',
      ],
      hint: 'Bowser waits beyond the gauntlet. The side ledges give you a safe launch.',
      par: 400,
    },
  ],
  [
    {
      name: 'Moonlit Battlements',
      sections: [
        'ramparts',
        'staircase',
        'hurdles',
        'ramparts',
        'lift',
        'crossroads',
        'clouds',
        'ramparts',
      ],
      hint: 'The battlements rise above the void. Expect enemies on elevated ground.',
      par: 370,
    },
    {
      name: 'The Winding Keep',
      sections: [
        'slalom',
        'crossroads',
        'ramparts',
        'lift',
        'hurdles',
        'staircase',
        'slalom',
        'lift',
      ],
      hint: 'Explore both sides of the keep for coins. The main route is marked in gold.',
      par: 380,
    },
    {
      name: 'Siege of the Stars',
      sections: [
        'clouds',
        'crossfire',
        'staircase',
        'ramparts',
        'ferries',
        'switchbacks',
        'lift',
        'ramparts',
      ],
      hint: 'Carry a power-up through the siege. Fifty coins award an extra life.',
      par: 390,
    },
    {
      name: 'The Midnight Guard',
      sections: [
        'ramparts',
        'slalom',
        'crossfire',
        'lift',
        'staircase',
        'ferries',
        'ramparts',
        'boss',
      ],
      hint: 'Bowser has sealed the gate. Three hits will open it.',
      par: 400,
    },
  ],
  [
    {
      name: 'Road to the Throne',
      sections: [
        'embers',
        'ramparts',
        'slalom',
        'crossfire',
        'lift',
        'staircase',
        'ferries',
        'crossfire',
      ],
      hint: 'Use everything you have learned. Each checkpoint is a fresh foothold.',
      par: 390,
    },
    {
      name: 'The Last Ascent',
      sections: [
        'staircase',
        'lift',
        'crossfire',
        'clouds',
        'ramparts',
        'ferries',
        'switchbacks',
        'clouds',
      ],
      hint: 'A final climb above the lava. Keep your fire flower as long as you can.',
      par: 400,
    },
    {
      name: 'Castle of No Return',
      sections: [
        'slalom',
        'ferries',
        'embers',
        'ramparts',
        'lift',
        'crossfire',
        'staircase',
        'ramparts',
      ],
      hint: 'Keep calm at the ferries. Clear the castle and the throne room is next.',
      par: 410,
    },
    {
      name: 'Bowser’s Last Stand',
      sections: [
        'crossfire',
        'ramparts',
        'embers',
        'slalom',
        'lift',
        'ferries',
        'crossfire',
        'boss',
      ],
      hint: 'Reach the throne room and defeat Bowser. The kingdom is counting on you.',
      par: 420,
    },
  ],
];
export const LEVELS: Level[] = CAMPAIGN.flatMap((courses, world) =>
  courses.map((plan, course) => {
    const theme = WORLDS[world].theme;
    const result: Level = {
      id: `${world + 1}–${course + 1}`,
      name: plan.name,
      world,
      theme,
      subtitle: WORLDS[world].description,
      hint: plan.hint,
      time: Math.max(900, plan.par + 600),
      par: plan.par,
      spawn: p(0, 0, 13),
      goal: p(0, 0, -530),
      checkpoint: p(0, 0, -65),
      checkpoints: [],
      surfaces: [],
      walls: [],
      pipes: [],
      blocks: [],
      enemies: [],
      coins: [],
      stars: [],
      firebars: [],
    };
    for (const [act, key] of plan.sections.entries()) {
      const section = SECTIONS[key],
        offset = act * 140,
        mirror = (world + course + act) % 2 ? -1 : 1;
      const point = <T extends Point>(o: T): T => ({
        ...o,
        x: o.x * mirror,
        z: o.z - offset,
      });
      const surface = (s: Surface): Surface => ({
        ...point(s),
        style: s.moving
          ? 'wood'
          : s.style === 'brick'
            ? 'brick'
            : theme === 'meadow'
              ? 'ground'
              : theme === 'sky'
                ? 'cloud'
                : 'stone',
        moving: s.moving ? { ...s.moving } : undefined,
      });
      result.surfaces.push(...section.surfaces.map(surface));
      result.walls.push(...section.walls.map(point));
      result.pipes.push(...section.pipes.map(point));
      result.blocks.push(...section.blocks.map(point));
      result.enemies.push(...section.enemies.map(point));
      result.coins.push(...section.coins.map(point));
      result.firebars.push(...section.firebars.map(point));
      // Three exploration rewards per course, each with a different approach.
      if ([1, 3, 7].includes(act) && section.stars.length)
        result.stars.push(
          point(section.stars[(world + course + act) % section.stars.length]),
        );
      if (act % 2 === 1) result.checkpoints!.push(point(section.checkpoint));
      if (act < plan.sections.length - 1) {
        const end = point(section.goal),
          nextStart = 18 - (act + 1) * 140;
        // A rest terrace joins acts; no underlying ground bridges the challenges.
        const far = Math.min(end.z - 3, nextStart - 1),
          near = Math.max(end.z + 3, nextStart + 1);
        result.surfaces.push(
          floor(
            0,
            Math.min(end.y, 1),
            (far + near) / 2,
            10,
            near - far + 2,
            theme === 'meadow' ? 'ground' : theme === 'sky' ? 'cloud' : 'stone',
          ),
        );
        result.coins.push(
          ...line(0, Math.min(end.y, 1) + 1.1, near - 1, far + 1),
        );
      } else {
        result.goal = point(section.goal);
        if (section.boss) result.boss = point(section.boss);
      }
    }
    result.checkpoint = result.checkpoints![0];
    // Interior perimeter walls continue across act joins, with no reachable tops.
    if (theme === 'cave' || theme === 'castle' || theme === 'night')
      result.walls.push(
        wall(-8, result.goal.z / 2, 2, Math.abs(result.goal.z) + 45),
        wall(8, result.goal.z / 2, 2, Math.abs(result.goal.z) + 45),
      );
    return result;
  }),
);
