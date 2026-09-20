import type { Box } from './physics';
import type { Enemy } from './world';

// Walk in both horizontal axes, but never step through a wall or over a ledge.
export function moveGroundEnemy(
  e: Enemy,
  player: { x: number; y: number; z: number },
  boxes: Box[],
  dt: number,
  time: number,
  index: number,
) {
  const bounds = e.roam;
  if (!bounds || e.shell || e.stun > 0) return;
  const phase = index * 2.39996;
  const near =
    Math.hypot(player.x - e.x, player.z - e.z) < 9 &&
    Math.abs(player.y - e.y) < 1.8;
  const targetX = near
    ? player.x
    : (bounds.minX + bounds.maxX) / 2 +
      (Math.sin(time * 0.48 + phase) * (bounds.maxX - bounds.minX)) / 2;
  const targetZ = near
    ? player.z
    : e.homeZ + Math.cos(time * 0.37 + phase) * 2.5;
  let dx = Math.max(bounds.minX, Math.min(bounds.maxX, targetX)) - e.x;
  let dz = Math.max(bounds.minZ, Math.min(bounds.maxZ, targetZ)) - e.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.06) return;
  const speed = (near ? 1.8 : 1.05) * (e.kind === 'koopa' ? 1.1 : 1);
  const length = Math.min(distance, speed * dt);
  dx = (dx / distance) * length;
  dz = (dz / distance) * length;
  const safe = (x: number, z: number) => {
    if (
      x < bounds.minX ||
      x > bounds.maxX ||
      z < bounds.minZ ||
      z > bounds.maxZ
    )
      return false;
    const solid = boxes.filter(
      (b) =>
        b.active !== false &&
        !b.hidden &&
        Math.abs(x - b.x) < b.w / 2 + 0.4 &&
        Math.abs(z - b.z) < b.d / 2 + 0.4,
    );
    if (
      solid.some((b) => b.y + b.h / 2 > e.y + 0.2 && b.y - b.h / 2 < e.y + 0.9)
    )
      return false;
    return [-0.36, 0.36].every((ox) =>
      [-0.36, 0.36].every((oz) =>
        solid.some(
          (b) =>
            Math.abs(b.y + b.h / 2 - e.y) < 0.16 &&
            Math.abs(x + ox - b.x) <= b.w / 2 &&
            Math.abs(z + oz - b.z) <= b.d / 2,
        ),
      ),
    );
  };
  const oldX = e.x,
    oldZ = e.z;
  if (safe(e.x + dx, e.z + dz)) {
    e.x += dx;
    e.z += dz;
  } else {
    if (safe(e.x + dx, e.z)) e.x += dx;
    if (safe(e.x, e.z + dz)) e.z += dz;
  }
  if (Math.hypot(e.x - oldX, e.z - oldZ) > 0.0001)
    e.heading = Math.atan2(e.x - oldX, e.z - oldZ);
}
