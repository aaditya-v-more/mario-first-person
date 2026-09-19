export type Box = {
  x: number;
  y: number;
  z: number;
  w: number;
  h: number;
  d: number;
  kind?: string;
  id?: number;
  active?: boolean;
};
export type Player = {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  grounded: boolean;
};
export const RADIUS = 0.34;
export const HEIGHT = 1.65;
export const GRAVITY = 25;
export const JUMP_SPEED = 14;
export function overlapXZ(p: Player, b: Box) {
  return (
    p.x + RADIUS > b.x - b.w / 2 &&
    p.x - RADIUS < b.x + b.w / 2 &&
    p.z + RADIUS > b.z - b.d / 2 &&
    p.z - RADIUS < b.z + b.d / 2
  );
}
function intersects(p: Player, b: Box) {
  return (
    b.active !== false &&
    overlapXZ(p, b) &&
    p.y + HEIGHT > b.y - b.h / 2 + 0.001 &&
    p.y < b.y + b.h / 2 - 0.001
  );
}
function integrate(
  p: Player,
  boxes: Box[],
  dt: number,
  onBump?: (b: Box) => void,
) {
  p.x += p.vx * dt;
  for (const b of boxes)
    if (intersects(p, b)) {
      if (p.vx > 0) p.x = b.x - b.w / 2 - RADIUS;
      else if (p.vx < 0) p.x = b.x + b.w / 2 + RADIUS;
    }
  p.z += p.vz * dt;
  for (const b of boxes)
    if (intersects(p, b)) {
      if (p.vz > 0) p.z = b.z - b.d / 2 - RADIUS;
      else if (p.vz < 0) p.z = b.z + b.d / 2 + RADIUS;
    }
  const oldY = p.y;
  const rising = p.vy > 0;
  p.vy -= GRAVITY * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  let landing = -Infinity,
    ceiling = Infinity,
    bumped: Box | undefined;
  for (const b of boxes) {
    if (b.active === false || !overlapXZ(p, b)) continue;
    const top = b.y + b.h / 2,
      bottom = b.y - b.h / 2;
    if (p.vy <= 0 && oldY >= top - 0.03 && p.y <= top)
      landing = Math.max(landing, top);
    else if (
      rising &&
      oldY + HEIGHT <= bottom + 0.03 &&
      p.y + HEIGHT >= bottom &&
      bottom < ceiling
    ) {
      ceiling = bottom;
      bumped = b;
    }
  }
  if (landing > -Infinity) {
    p.y = landing;
    p.vy = 0;
    p.grounded = true;
  } else if (bumped) {
    p.y = ceiling - HEIGHT;
    p.vy = 0;
    onBump?.(bumped);
  }
}
// Bound travel per integration, including fast shells/knockback and slow frames.
// Thin walls cannot be skipped just because the end position is beyond them.
export function stepPlayer(
  p: Player,
  boxes: Box[],
  dt: number,
  onBump?: (b: Box) => void,
) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 0.25);
  const steps = Math.max(
    1,
    Math.ceil(dt / (1 / 120)),
    Math.ceil(
      (Math.max(Math.abs(p.vx), Math.abs(p.vy) + GRAVITY * dt, Math.abs(p.vz)) *
        dt) /
        0.15,
    ),
  );
  for (let i = 0; i < steps; i++) integrate(p, boxes, dt / steps, onBump);
}
export function newPlayer(): Player {
  return { x: 0, y: 0, z: 13, vx: 0, vy: 0, vz: 0, grounded: true };
}
