import type { Theme } from './level-types';
export type {
  Point,
  Theme,
  Power,
  Reward,
  Surface,
  Level,
  Portal,
  EnemyKind,
  EnemySpec,
} from './level-types';
export {
  NES_LEVELS as LEVELS,
  COURSE_WIDTH,
  MAP_UNIT,
  TILE,
  AREA_SPACING,
  START_Z,
} from './smb-levels';
export const WORLDS = Array.from({ length: 8 }, (_, i) => ({
  name: `World ${i + 1}`,
  theme: (
    [
      'meadow',
      'water',
      'night',
      'sky',
      'meadow',
      'night',
      'water',
      'castle',
    ] as Theme[]
  )[i],
  description:
    i === 7
      ? 'The final road to Bowser’s castle.'
      : `Four original courses, from ${i + 1}–1 to ${i + 1}–4.`,
}));
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
  water: {
    sky: '#126ba0',
    fog: '#187eae',
    ground: '#e4bd78',
    edge: '#f1d5a1',
    ambient: '#9de7f5',
    sun: '#dcfaff',
  },
};
