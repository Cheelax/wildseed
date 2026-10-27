// Stats: four numbers from 10 to 100 that add up to a creature's total, shared by weights.
import { STAT_RANGE, STATS } from "../rules.mjs";

/** A creature's stats add up to TOTAL[0] to TOTAL[1], RARE_BONUS more when it is rare. */
export const TOTAL = [175, 250];
export const RARE_BONUS = 25;

/**
 * Shares `total` among the four stats: each starts at 10, then every point above goes to the stat with the
 * most weight per point it already holds (D'Hondt), none past 100.
 */
export function share(total, weight) {
  const [min, max] = STAT_RANGE;
  const points = STATS.map(() => min);
  for (let left = total - STATS.length * min; left > 0; left--) {
    let best = -1;
    for (let i = 0; i < STATS.length; i++) {
      if (points[i] >= max) continue;
      if (best < 0 || weight[i] / (points[i] - min + 1) > weight[best] / (points[best] - min + 1)) best = i;
    }
    points[best]++;
  }
  return Object.fromEntries(STATS.map((k, i) => [k, points[i]]));
}

/** The sum of a creature's stats. */
export const totalOf = (stats) => STATS.reduce((sum, k) => sum + stats[k], 0);
