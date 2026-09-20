import type { Box } from './physics';
export type Point = { x: number; y: number; z: number };
export type Theme =
  | 'meadow'
  | 'cave'
  | 'sky'
  | 'lava'
  | 'night'
  | 'castle'
  | 'water';
export type Power = 'mushroom' | 'flower' | 'star' | 'life';
export type Reward = 'coin' | Power | 'upgrade' | 'vine';
export type Motion = {
  axis: 'x' | 'y' | 'z';
  distance: number;
  speed: number;
  phase?: number;
  mode?: 'oscillate' | 'elevator' | 'falling' | 'scale' | 'ride';
  pair?: string;
  direction?: number;
};
export type Surface = Box & {
  style?:
    | 'ground'
    | 'brick'
    | 'stone'
    | 'cloud'
    | 'wood'
    | 'tree'
    | 'shroom'
    | 'coral'
    | 'bridge';
  moving?: Motion;
  area?: number;
  breakable?: boolean;
  spring?: boolean;
  castleBridge?: boolean;
  choke?: boolean;
  sourceX?: number;
  sourceY?: number;
};
export type EnemyKind =
  | 'goomba'
  | 'koopa'
  | 'beetle'
  | 'hammer'
  | 'blooper'
  | 'cheep'
  | 'lakitu'
  | 'spiny'
  | 'piranha'
  | 'podoboo';
export type EnemySpec = Point & {
  range: number;
  roam?: { minX: number; maxX: number; minZ: number; maxZ: number };
  kind: EnemyKind;
  area?: number;
  axis?: 'x' | 'z';
  flying?: boolean;
  leaping?: boolean;
  smart?: boolean;
  sourceX?: number;
  sourceY?: number;
};
export type Pipe = Point & {
  height: number;
  w?: number;
  d?: number;
  horizontal?: boolean;
  area?: number;
  sourceX?: number;
};
export type QuestionSpec = Point & {
  reward: Reward;
  w?: number;
  h?: number;
  d?: number;
  hidden?: boolean;
  brick?: boolean;
  coins?: number;
  portal?: string;
  area?: number;
  sourceX?: number;
  sourceY?: number;
};
export type Portal = Point & {
  id: string;
  area: number;
  targetArea: number;
  target: Point;
  mode: 'pipe' | 'walk' | 'vine';
  label: string;
  warpLevel?: number;
  requiresBlock?: string;
  radius: number;
};
export type AreaSpec = {
  id: number;
  name: string;
  setting: string;
  theme: Theme;
  center: number;
  length: number;
  spawn: Point;
  underwater: boolean;
  ceiling: number;
  width?: number;
  exit?: { area: number; point: Point };
};
export type MazeRoute = {
  id: string;
  area: number;
  startZ: number;
  endZ: number;
  minY: number;
  maxY: number;
  group: number;
};
export type MazeExit = {
  id: string;
  area: number;
  z: number;
  requires: string[];
  target: Point;
};
export type Level = {
  id: string;
  name: string;
  world: number;
  theme: Theme;
  kind: string;
  subtitle: string;
  hint: string;
  time: number;
  par: number;
  spawn: Point;
  goal: Point;
  checkpoint: Point;
  checkpoints: Point[];
  surfaces: Surface[];
  walls: Box[];
  pipes: Pipe[];
  blocks: QuestionSpec[];
  enemies: EnemySpec[];
  coins: Point[];
  stars: Point[];
  firebars: (Point & {
    length: number;
    speed: number;
    area?: number;
    plane?: 'vertical' | 'horizontal';
  })[];
  boss?: Point;
  axe?: Point;
  areas: AreaSpec[];
  startArea: number;
  mainArea: number;
  goalArea: number;
  portals: Portal[];
  mazeRoutes: MazeRoute[];
  mazeExits: MazeExit[];
  cannons: (Point & { area: number; height: number })[];
  lava: (Box & { area: number })[];
  referenceId: string;
  mapWidth: number;
};
