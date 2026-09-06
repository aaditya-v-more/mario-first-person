export type Box = { x: number; y: number; z: number; w: number; h: number; d: number; kind?: string; id?: number };
export type Player = { x: number; y: number; z: number; vx: number; vy: number; vz: number; grounded: boolean };
export const RADIUS = .34;
export const HEIGHT = 1.65;
export const GRAVITY = 25;
export const JUMP_SPEED = 14;
export function overlapXZ(p: Player, b: Box) {
  return p.x + RADIUS > b.x - b.w / 2 && p.x - RADIUS < b.x + b.w / 2 && p.z + RADIUS > b.z - b.d / 2 && p.z - RADIUS < b.z + b.d / 2;
}
function intersects(p: Player, b: Box) { return overlapXZ(p, b) && p.y + HEIGHT > b.y - b.h / 2 + .001 && p.y < b.y + b.h / 2 - .001; }
export function stepPlayer(p: Player, boxes: Box[], dt: number, onBump?: (b: Box) => void) {
  p.x += p.vx * dt;
  for (const b of boxes) if (intersects(p, b)) {
    if (p.vx > 0) p.x = b.x - b.w / 2 - RADIUS;
    else if (p.vx < 0) p.x = b.x + b.w / 2 + RADIUS;
  }
  p.z += p.vz * dt;
  for (const b of boxes) if (intersects(p, b)) {
    if (p.vz > 0) p.z = b.z - b.d / 2 - RADIUS;
    else if (p.vz < 0) p.z = b.z + b.d / 2 + RADIUS;
  }
  const oldY = p.y;
  p.vy -= GRAVITY * dt;
  p.y += p.vy * dt;
  p.grounded = false;
  for (const b of boxes) {
    if (!overlapXZ(p, b)) continue;
    const top = b.y + b.h / 2, bottom = b.y - b.h / 2;
    if (p.vy <= 0 && oldY >= top - .03 && p.y <= top) {
      p.y = top; p.vy = 0; p.grounded = true;
    } else if (p.vy > 0 && oldY + HEIGHT <= bottom + .03 && p.y + HEIGHT >= bottom) {
      p.y = bottom - HEIGHT; p.vy = 0; onBump?.(b);
    }
  }
}
export function newPlayer(): Player { return {x:0,y:0,z:13,vx:0,vy:0,vz:0,grounded:true}; }
