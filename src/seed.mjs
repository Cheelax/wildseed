// Seeds: how a typed word becomes the seed of a creature. ARCHITECTURE.md, "Seeds".
import { SEED_MAX, SEED_PATTERN } from "./rules.mjs";

/** NFC, lowercase (no locale), trimmed, every run of whitespace one space. */
export function normalizeSeed(text) {
  return String(text).normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Why a normalized seed is refused, in a sentence, or null when it is a good seed. */
export function seedProblem(seed) {
  if (seed === "") return "a seed needs at least one letter or digit";
  const length = [...seed].length;
  if (length > SEED_MAX) return `a seed has ${SEED_MAX} characters at most, this one has ${length}`;
  if (!SEED_PATTERN.test(seed)) {
    const bad = [...seed].find((ch) => !SEED_PATTERN.test(ch));
    return `“${bad}” cannot be part of a seed: letters, digits, spaces, hyphens and apostrophes only`;
  }
  return null;
}

export class SeedError extends Error {}

/** The normalized seed, or a SeedError that says what is wrong with it. */
export function parseSeed(text) {
  const seed = normalizeSeed(text);
  const problem = seedProblem(seed);
  if (problem) throw new SeedError(problem);
  return seed;
}
