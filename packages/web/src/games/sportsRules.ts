export type Level = 'Practice' | 'Club' | 'Champion';
export const levels: Record<Level, { keeper: number; ball: number; paddle: number }> = {
  Practice: { keeper: 100, ball: 205, paddle: 108 },
  Club: { keeper: 145, ball: 265, paddle: 86 },
  Champion: { keeper: 190, ball: 320, paddle: 68 },
};
export function shotResult(aim: number, keeper: number, charge: number, width: number) {
  if (charge < .2 || charge > .94) return 'Miss';
  return Math.abs(aim - keeper) < width ? 'Saved' : 'Goal';
}
export function bounceDirection(hit: number) { return Math.max(-.85, Math.min(.85, hit)) * 1.15; }
