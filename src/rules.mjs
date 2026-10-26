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

// Round 2: lineages and crossing. ARCHITECTURE.md, "Lineages".

/** A lineage goes back GENERATIONS_MAX generations at most and is written in LINEAGE_MAX characters at most. */
export const GENERATIONS_MAX = 6;
export const LINEAGE_MAX = 120;
/** A couple's eggs are numbered from 1 to CLUTCH_MAX ("#2" is the second egg; the first is written with no number). */
export const CLUTCH_MAX = 99;
/** Each trait of a child mutates 1 time in MUTATION_ONE_IN. */
export const MUTATION_ONE_IN = 50;
/** A child is rare 1 time in RARE_CHILD_ONE_IN[n], n its rare parents: 64 for two common parents, as for words. */
export const RARE_CHILD_ONE_IN = [RARE_ONE_IN, 8, 2];
/**
 * A child takes after both parents: at least TAKES_AFTER_BOTH of children whose parents differ in 4 traits or
 * more take a trait from each, COLORS_NEAR have colors nearer their parents' than another couple's, and
 * SIBLINGS_DIFFER of a couple's first four eggs differ in their traits.
 */
export const TAKES_AFTER_BOTH = 0.7;
export const COLORS_NEAR = 0.8;
export const SIBLINGS_DIFFER = 0.95;
