// Names: a creature keeps the first syllable of its word, so "thomas" hatches a Thom-something, and
// takes an ending of its affinity. A word with no Latin or Cyrillic letter gets a syllable of its own.

const ENDINGS = {
  moss: ["bun", "kin", "let", "pip", "sy", "wick", "moo", "leaf"],
  stone: ["bo", "nub", "rock", "gus", "ton", "lump", "dor", "ble"],
  spark: ["zap", "zip", "pix", "bit", "zee", "tik", "fizz", "volt"],
};

const CYRILLIC = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l",
  м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ы: "y", э: "e", ю: "yu", я: "ya", і: "i", ї: "yi", є: "ye", ґ: "g",
};

const ONSETS = ["b", "d", "f", "g", "k", "l", "m", "n", "p", "r", "s", "t", "v", "w", "z", "ch", "sh"];
const VOWELS = ["a", "e", "i", "o", "u"];

/** The seed's letters in plain a to z: Cyrillic transliterated, accents dropped, the rest left out. */
export function latinOf(seed) {
  const mapped = [...seed].map((ch) => CYRILLIC[ch] ?? ch).join("");
  return mapped.normalize("NFD").replace(/\p{M}/gu, "").replace(/[^a-z]/g, "");
}

/** The word's first syllable: its first consonants, its vowels and one consonant more ("thom", "hot"). */
export function stemOf(latin) {
  const m = /^([^aeiouy]{0,3})[^aeiouy]*?([aeiouy]{1,2})([^aeiouy]?)/.exec(latin);
  if (!m) return latin.slice(0, 2);
  const [whole, onset, vowels, coda] = m;
  // A doubled last letter stays: "moss", "bell".
  return onset + vowels + coda + (coda && latin.slice(whole.length) === coda ? coda : "");
}

/** The creature's name: 3 to 12 letters, the first uppercase. */
export function nameOf(seed, affinity, d) {
  let stem = stemOf(latinOf(seed));
  if (!stem) stem = d.pick(ONSETS) + d.pick(VOWELS);
  else if (!/[aeiouy]/.test(stem)) stem += d.pick(VOWELS);
  const ending = d.pick(ENDINGS[affinity]);
  const name = (stem.endsWith(ending[0]) ? stem.slice(0, -1) : stem) + ending;
  return name[0].toUpperCase() + name.slice(1, 12);
}

const ALL_ENDINGS = Object.values(ENDINGS).flat().sort((a, b) => b.length - a.length);

/** A name's front and its ending: "Thomnub" is "thom" and "nub". Every name ends with an affinity's ending. */
export function splitName(name) {
  const lower = name.toLowerCase();
  const ending = ALL_ENDINGS.find((e) => lower.endsWith(e) && lower.length > e.length) ?? lower.slice(-2);
  return [lower.slice(0, -ending.length), ending];
}

/** The items of a list in an order drawn from a die. */
function shuffled(list, d) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = d.int(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * A child's name sounds like both parents': the front of one parent's name with the ending of the other's,
 * or the fronts of both ("Thomnub" and "Aurizap" have a Thomzap, an Aurinub, a Thomauri or an Aurithom).
 * A child never takes a parent's name nor one of `taken` (its elder brothers' and sisters'): once those
 * four are worn, it takes a parent's front with a new ending of its affinity.
 */
export function crossName(x, y, affinity, d, taken = []) {
  const [[frontX, endX], [frontY, endY]] = [splitName(x.name), splitName(y.name)];
  const join = (front, end) => ((front.length > 1 && front.endsWith(end[0]) ? front.slice(0, -1) : front) + end).slice(0, 12);
  const both = shuffled([join(frontX, endY), join(frontY, endX), join(frontX, frontY), join(frontY, frontX)], d);
  const fresh = shuffled(ENDINGS[affinity].flatMap((e) => [join(frontX, e), join(frontY, e)]), d);
  const worn = new Set([x.name, y.name, ...taken].map((n) => n.toLowerCase()));
  const name = [...both, ...fresh].find((n) => n.length >= 3 && !worn.has(n)) ?? both[0];
  return name[0].toUpperCase() + name.slice(1);
}
