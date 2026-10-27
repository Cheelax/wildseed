# Wildseed: architecture

Type a word, hatch a creature. Every creature grows from a seed: the same word always hatches the same
creature, on every machine, forever. Coding agents build the game round by round on Hotpod; each round
starts from the previous winner's code.

This file is the specification. Round 1's checks (`.launchpad/checks/round-1/`) test the names, formats
and behaviours below; entries differ inside these lines, never on them.

## The rounds

| Round | Adds | Checked by |
| --- | --- | --- |
| 1. Hatch | Seeds, genomes, the `hatch` command, the hatchery page, GIF and card export | The command's output on thousands of seeds; the built page in headless Chromium |
| 2. Cross | Two seeds lay an egg; the child mixes both parents; its seed is its lineage | Written on round 1's winner |
| 3. Battle | Turn-based fights, with moves that come from each creature's body | Written on round 2's winner |
| 4. The island | A small 3D island, wild creatures to tame, a creature of the day, saves | Written on round 3's winner |

Rounds 2 to 4 get their exact interface when they are added, on the previous winner's code. Two rules hold
for every round:

- **A seed never changes its creature.** Later rounds add to a genome; they never change the fields that
  an earlier round produced for the same seed. Each round's checks record the winner's genomes for a
  sample of seeds and compare them.
- **The characters `*`, `(`, `)` and `#` are not part of words.** Round 2 uses them to write lineages:
  `thomas*auri`, `(thomas*auri)*noe`, `thomas*auri#2`.

## Seeds

A seed is a word or a short phrase. The command and the page read it the same way:

1. Normalize: Unicode NFC, then `toLowerCase()` (no locale), then trim, then collapse every run of
   whitespace into one space.
2. Validate the result: 1 to 24 characters (code points), each one a letter (`\p{L}`), a combining mark
   (`\p{M}`), a digit (`\p{N}`), a space, a hyphen-minus (`-`) or an apostrophe (`'`). Anything else is
   refused, including an empty seed.

So `Thomas`, `  thomas ` and `thomas` are one seed; `noé` typed with a composed or a decomposed `é` is one
seed; `東京`, `o'brien` and `x-1` are valid; `a*b`, `🐸` and a 25-character seed are refused.

## The genome

`genomeOf(seed)` in `src/genome.mjs` returns the creature's genome: a plain JSON object. It is pure and
deterministic: no `Math.random`, no clock, no locale, no environment. The same seed gives the same
bytes from `JSON.stringify` in every process and on every machine.

Required fields (an entry may add others):

| Field | Value |
| --- | --- |
| `seed` | The normalized seed. |
| `name` | The creature's generated name: 3 to 12 letters, the first uppercase and the rest lowercase (`/^\p{Lu}\p{Ll}{2,11}$/u`). |
| `species` | The id of its species, `/^[a-z][a-z0-9-]{1,23}$/`. |
| `affinity` | `"moss"`, `"stone"` or `"spark"`. |
| `rare` | `true` or `false`. |
| `stats` | `{ "hp", "attack", "defense", "speed" }`, integers from 10 to 100 each, adding up to 160 to 280. |
| `palette` | 3 to 8 colors, each `"#rrggbb"`. |
| `traits` | An object of your own design: the knobs that shape the body. |

The spread, measured over many seeds (`src/rules.mjs` holds these numbers):

- at least 6 species, each at least 2 % of seeds;
- all three affinities;
- about one creature in 64 rare (the checks accept 1 in 100 to 1 in 40);
- different seeds give different creatures.

Species are designed, not random: each one is a character recognizable from its silhouette, and the
seed turns its knobs only inside ranges that keep it appealing.

## The command

```sh
node bin/hatch.mjs <seed>…
```

- Prints one line per seed, in order: the genome as compact JSON (`JSON.stringify(genome)`), then a
  newline. Exits 0.
- With no seed, or with any seed that fails validation, prints nothing on stdout, a reason on stderr that
  names the bad seed, and exits 2.
- Hatching 1,000 seeds in one run takes a few seconds at most.

## The page

`npm run build` writes a static site to `dist/`. It works from any path (`/`, or `/some/sub/path/`), so
asset paths are relative (Vite's `base: "./"`). It loads nothing from outside its own server: no CDN, no
web font, no API.

- **The address.** `?seed=<seed>` (URL-encoded) opens that seed's creature. With no `seed` parameter, the
  page hatches a word of its choice.
- **Hatching.** Typing a seed in the input with test id `seed-input` and pressing Enter hatches it: an egg
  cracks and the creature appears, alive. The address then carries the new seed (`?seed=…`, with
  `history.replaceState` or `pushState`). A seed that fails validation shows a reason in the element with
  test id `seed-error` and keeps the current creature. The button with test id `random` hatches a seed
  from a built-in word list.
- **The card**, test id `creature-card`, shows the creature's name, species, affinity and its four stats as
  numbers.
- **Sharing.** The button with test id `save-gif` downloads an animated GIF of the creature (the hatch,
  then a loop of it alive): at least 12 frames, 64 colors at most per frame. The button with test id
  `save-card` downloads a PNG card of at least 300 × 300 pixels with the creature, its name, species,
  affinity, stats and seed. Both are made in the browser.
- **The scene**, test id `scene`: the element (usually the `<canvas>`) where the creature is drawn.
- **`window.__wild`**, kept up to date:

  ```js
  window.__wild = {
    ready: true,           // the current seed's creature is on screen and alive; false while it hatches
    renderer: "webgl2",    // or "webgpu"
    pixel: 4,              // the size of one art pixel, in CSS pixels: an integer, 3 or more at 1280 × 720
    creature: { … },       // exactly the genome the command prints for the current seed
  };
  ```

## The look: low-res pixel 3D

The creatures are real 3D models, lit, with shadows and a camera that can turn around them. The scene is
drawn at a low resolution and scaled up without smoothing: every art pixel is a square of
`window.__wild.pixel` CSS pixels, aligned on the top-left corner of the `scene` element. Shading comes in
flat bands from the creature's own palette, a dark outline one art pixel wide draws the silhouette, and
eyes, mouth and markings are drawn as pixel shapes. The creature, the egg and the ground share one pixel
size. Interface elements drawn over the scene stay small.

## Assets

Creatures are made in code: no creature model, sprite or texture file. Other assets are made in code too,
or are CC0 files (or OFL fonts) committed with their source in `CREDITS.md`. Nothing comes from another
game.

## Where the checks run

The checks run every entry in a container: Linux, Node 24, Playwright 1.63's Chromium, no GPU and no
network. Dependencies install with `npm ci` from `package-lock.json` (registry packages only, install
scripts off) and `node_modules/` is read-only while the checks run: `npm run build` must not write in it
(hence `vite build --configLoader native`). The page runs on SwiftShader, at a few frames per second for a
heavy scene, so `ready` must eventually become true there through WebGL 2.

## Files

```
bin/hatch.mjs        the command
src/genome.mjs       genomeOf(seed): seeds, genomes, names, stats (pure, shared by the command and the page)
src/rules.mjs        the numbers of the rules: do not change them
src/main.js          the page's entry point
index.html           the page
.launchpad/          the Hotpod project file and each round's checks: entries never touch it
```

## Lineages

Round 2 extends seeds with binary crosses. Words still use the original seed reader and keep every
original genome field unchanged. The grammar is:

```
lineage = word | cross
cross   = parent "*" parent [ "#" clutch ]
parent  = word | "(" cross ")"
```

`×` reads as `*`; whitespace around signs is ignored. Egg numbers are 1–99 without leading zeros;
`#1` is omitted in writing. Only crossed parents get parentheses: `(a)`, `(a)*b`, `(a*b)`,
`((a*b))*c` and `a*b*c` are refused. Words may cross with themselves.

The written form sorts both parents with JavaScript's default string order, including a crossed
parent's parentheses, recursively inside first. Thus `Thomas × Auri` becomes `auri*thomas` and
`noe*(thomas*auri)` becomes `(auri*thomas)*noe`. Limits apply after writing: six generations
(words have depth zero) and 120 characters.

`genomeOf(lineage)` recursively crosses the parents. `cross(a, b, clutch = 1)` is pure and symmetric;
all choices draw from genes keyed by the child's written seed. Children add `parents` (written forms
without outer parentheses, in seed order), `clutch`, `mutations` (distinct dotted trait paths) and
`inherited` (trait path to `a`, `b` or `mutation`). Species and affinity come from a parent. The child
keeps its species' trait keys; each trait is picked from a compatible parent value, except a 1-in-50
mutation drawn with the original species' trait generator. Species domains come from the same knob
declarations: only parent values inside the child's species domain are candidates, and when neither
parent's value fits, the fresh draw is used and listed as a mutation. Stats blend, palettes blend HSL on the short
hue arc, and names combine a gene-selected opening and ending of the parents' names. Two common parents
have a 1-in-64 rare child; a rare parent raises this to 1-in-8.

The command validates all lineages before printing. The page carries written lineages in its query,
encoding `#` as `%23`. Its crossing form brings two parents together before the egg hatches; the next
egg button advances the clutch, and Use this creature puts the child in the first parent field.
The family tree shows the child, parents, grandparents, palette swatches and every trait's source.
