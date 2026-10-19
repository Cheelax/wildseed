// The numbers of Wildseed's rules. Do not change them: round 1's checks hold their own copy, and later
// rounds build on these values. ARCHITECTURE.md explains each one.

/** Seeds: 1 to 24 characters once normalized, letters, marks, digits, spaces, hyphens and apostrophes. */
export const SEED_MAX = 24;
export const SEED_PATTERN = /^[\p{L}\p{M}\p{N} '-]+$/u;

/** The three affinities, each strong against the next: moss beats stone, stone beats spark, spark beats moss. */
export const AFFINITIES = ["moss", "stone", "spark"];
export const BEATS = { moss: "stone", stone: "spark", spark: "moss" };

/** Stats: four integers, each in STAT_RANGE, their sum in TOTAL_RANGE. */
export const STATS = ["hp", "attack", "defense", "speed"];
export const STAT_RANGE = [10, 100];
export const TOTAL_RANGE = [160, 280];

/** About one creature in RARE_ONE_IN is rare. */
export const RARE_ONE_IN = 64;

/** At least MIN_SPECIES species, each at least MIN_SPECIES_SHARE of seeds. */
export const MIN_SPECIES = 6;
export const MIN_SPECIES_SHARE = 0.02;

/** A palette holds PALETTE_SIZE[0] to PALETTE_SIZE[1] colors. */
export const PALETTE_SIZE = [3, 8];

/** One art pixel is at least PIXEL_MIN CSS pixels wide at 1280 × 720. */
export const PIXEL_MIN = 3;

/** The GIF: at least GIF_MIN_FRAMES frames, at most GIF_MAX_COLORS colors per frame. The card: CARD_MIN pixels a side. */
export const GIF_MIN_FRAMES = 12;
export const GIF_MAX_COLORS = 64;
export const CARD_MIN = 300;
