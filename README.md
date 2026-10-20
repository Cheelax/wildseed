# Wildseed

Type a word, hatch a creature. Wildseed is a creature-collecting game in the browser where every creature
grows from a seed: the same word always hatches the same creature, and every word hatches its own. There
is no creature art anywhere, only code, drawn in low-res pixel 3D.

Coding agents build it round by round on [Hotpod](https://agent-launchpad-six.vercel.app): each round
starts from the previous winner's code.

1. **Hatch**: seeds, genomes, the hatchery page, a GIF and a card to share.
2. **Cross**: two words lay an egg, and the child mixes both parents.
3. **Battle**: any creature against any other, with moves that come from its body.
4. **The island**: wild creatures to find and tame, a creature of the day.

[ARCHITECTURE.md](ARCHITECTURE.md) is the specification.

## Run it

```sh
npm ci
npm run dev                  # the hatchery, at the address Vite prints
node bin/hatch.mjs thomas    # a seed's genome, as JSON
npm test                     # the genome's and the command's tests
```

`npm run build` writes the static site to `dist/`. Every push to `main` deploys it to GitHub Pages.

On the page: type a word and press Enter (or Hatch), or press Random. Drag the scene to turn the camera,
scroll or pinch to zoom, click or tap the creature to poke it. Save GIF and Save card download what you
see, made in the browser.

## How it works

```
src/seed.mjs            seeds: normalize, validate, the reason a seed is refused
src/genome.mjs          genomeOf(seed): species, affinity, rarity, name, stats, palette, traits
src/genome/             genes (one stream per gene), names, palettes, the ten species' knobs
bin/hatch.mjs           the command
src/render/             the scene: pixel renderer, toon materials, stage, egg, creature, species, effects
src/share/              the GIF encoder, the card, the pixel font
src/audio/cry.js        each creature's cry, through Web Audio
src/main.js             the page: input, address, card, window.__wild
```

**The genome** is data only; the renderer reads it and never writes it. Every field draws its numbers
from a gene of its own, a stream seeded by the hash of the gene's name and the seed
([src/genome/genes.mjs](src/genome/genes.mjs)), so no field depends on the order the others are drawn in.
A later round can add genes (moves, levels) without changing a creature that already exists, and a child
can take each gene from one parent or the other. Only integer and plain floating-point arithmetic is used
(no `Math.sin`, no locale), so every machine prints the same bytes. `test/hatched.json` keeps round 1's
genomes for a few seeds, and `npm test` checks that they never change.

**The scene** is drawn at about 160 art pixels high into a render target, then one pass paints the sky in
bands and inks a one-pixel outline wherever a part stands in front of what is behind it (depth, and the
part's class kept in the alpha channel). The canvas holds exactly the art pixels and CSS scales it up
without smoothing; its corner is snapped to a whole screen pixel. Every material is a toon material: three.js
lights it (sun, shadows, ambient), then the light level picks one of four flat bands of the part's own color,
shadows leaning cool and highlights warm. Markings (spots, stripes, a patch, a mask, socks) are drawn in each
part's own space, so they stick to it and come out as pixel shapes. Eyes, mouths and cheeks are small flat
shapes on the head's surface.

**A body** is built by its species ([src/render/species/](src/render/species/)) from ellipsoids, cones,
tapered tubes and lathes, inside the ranges the species' knobs allow, then
[src/render/creature.js](src/render/creature.js) keeps it alive: it breathes, blinks, looks at the pointer or
around, wiggles its ears, tails and tentacles, and acts out its mood. Its `pose(t)` is a function of time,
so the GIF shows the same creature as the page.

## Choices where the brief is silent

- **Names** keep the first syllable of the word, Latin letters as they are, accents dropped, Cyrillic
  transliterated (`thomas` → Thom…, `кот` → Kot…), and take an ending from the creature's affinity
  (moss: -bun, -kin, -let…; stone: -bo, -nub, -rock…; spark: -zap, -pix, -volt…). A word with no such
  letter (`東京`) gets a syllable of its own.
- **Ten species**, each about one creature in ten: pipkin (a round bird with a crest and a beak),
  hopple (a hopper with long ears up, flopped or out to the sides), trundle (a four-legged trotter with a
  long nose), drift (a floating jelly with curling tentacles), prickle (a hedgehog with a soft face),
  wyrmlet (a small dragon with horns, wings and a tipped tail), inchling (a caterpillar that rears up),
  domeback (a walker under a dome of a shell), toadle (a squat frog with its eyes on two domes and a throat
  that swells when it sings) and flutterling (a fluffy moth hovering on two pairs of wings).
- **Affinity** sets the palette's family, the egg, the island's ground, the sky and a charm the creature
  may wear (moss: a sprout, a leaf, a flower, a mushroom; stone: a pebble, a crystal, a stack of stones;
  spark: a bolt, an orb, a star).
- **Rare** creatures (about one in 64) are starlit: a night-blue body speckled with twinkling stars, gold
  eyes and accents, stars circling them, a dark egg, a gold frame on their card, a chime in their cry.
- **Stats**: a total from 175 to 250 (25 more when rare), shared one point at a time by the species'
  weights, each nudged by its own gene; the affinity leans one stat (moss hp, stone defense, spark speed).
- **Mood** (bouncy, sleepy, curious, shy, proud) sets how it idles and its habit, shown a second after it
  hatches and then every few seconds: it hops, naps under floating z's, tilts its head, looks away, or puffs
  up. A poke makes it laugh: it hops, spins or wiggles, by turns, under hearts.
- **The cry** is sung from the genome: the voice gene's pitch (bigger bodies sing lower), one to three notes,
  a contour (rise, fall, hop, trill), a vowel through two formant filters, and a timbre by affinity (soft
  moss, gruff stone, buzzy spark). Browsers play sound only after a gesture: the first click or key wakes it.
- **The page** with no `?seed=` hatches a word from the built-in list and puts it in the address. Each hatch
  pushes a history entry, so Back returns to the previous creature. A refused seed shows its reason under
  the input and keeps the creature.
- **The GIF** is 480 × 480, four screen pixels per art pixel, 64 colors at most: the egg drops, wobbles,
  cracks and hatches, then the creature shows its habit and gets poked; its name runs along the bottom.
  It is encoded in the browser by [src/share/gif.js](src/share/gif.js) (median cut, LZW).
- **The card** is 640 × 896, four pixels per art pixel: name, the creature on its island, species and
  affinity, the four stats as bars and numbers, a line about its mood, and the seed, in a 5 × 7 pixel font
  drawn in [src/share/font.js](src/share/font.js). Seeds in other scripts are drawn in the system font,
  snapped to whole pixels.

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
