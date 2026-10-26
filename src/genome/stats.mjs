// Stats: four integers from 10 to 100 that add up to a creature's total, shared out by weights.
import { STAT_RANGE, STATS } from "../rules.mjs";

/**
 * Shares `total` points between the four stats, each from STAT_RANGE: the points above the minimum go one at
 * a time by `weights` (one per stat, in STATS' order), to the stat with the most weight per point it already
 * holds (D'Hondt).
 */
export function share(total, weights) {
  const [min, max] = STAT_RANGE;
  const points = STATS.map(() => min);
  for (let left = total - STATS.length * min; left > 0; left--) {
    let best = -1;
    for (let i = 0; i < STATS.length; i++) {
      if (points[i] >= max) continue;
      if (best < 0 || weights[i] / (points[i] - min + 1) > weights[best] / (points[best] - min + 1)) best = i;
    }
    points[best]++;
  }
  return Object.fromEntries(STATS.map((k, i) => [k, points[i]]));
}
