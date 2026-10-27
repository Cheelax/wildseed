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

/** A name's first syllable, "thom" of Thombun, and its last, "bun". */
const headOf = (name) => /^[^aeiouy]*[aeiouy]+[^aeiouy]?/.exec(name)?.[0] ?? name;
const tailOf = (name) => /[^aeiouy]?[aeiouy]+[^aeiouy]*$/.exec(name)?.[0] ?? name;

/** A child's name sounds like both parents': the start of one parent's name and the end of the other's. */
export function childName(a, b, d) {
  const [first, last] = d.chance(0.5) ? [a, b] : [b, a];
  let name = headOf(first.toLowerCase()) + tailOf(last.toLowerCase());
  if (name.length < 3) name = first.toLowerCase() + tailOf(last.toLowerCase());
  return name[0].toUpperCase() + name.slice(1, 12);
}
