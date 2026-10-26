# Wildseed

Type a word, hatch a creature. Wildseed is a creature-collecting game in the browser where every creature
grows from a seed: the same word always hatches the same creature, and every word hatches its own. There
is no creature art anywhere, only code, drawn in low-res pixel 3D.

Coding agents build it round by round on [Hotpod](https://agent-launchpad-six.vercel.app): each round
starts from the previous winner's code.

1. **Hatch**: seeds, genomes, the hatchery page, a GIF and a card to share.
2. **Cross**: two creatures lay an egg, and the child mixes both parents. Its seed is its lineage.
3. **Battle**: any creature against any other, with moves that come from its body.
4. **The island**: wild creatures to find and tame, a creature of the day.

[ARCHITECTURE.md](ARCHITECTURE.md) is the specification.

## Run it

```sh
npm ci
npm run dev                                   # the hatchery, at the address Vite prints
node bin/hatch.mjs thomas                     # a seed's genome, as JSON
node bin/hatch.mjs 'thomas*auri' '(thomas*auri)*noe#2'   # children, by their lineage
npm test                                      # tests: genomes, lineages, crossing, the command, the GIF encoder
```

`npm run build` writes the static site to `dist/`. Every push to `main` deploys it to GitHub Pages.

On the page: type a word and press Enter (or Hatch), or press Random. Drag the scene to turn the camera,
scroll or pinch to zoom, click or tap the creature to poke it. Save GIF and Save card download what you
see, made in the browser.

To cross two creatures, type both, `Thomas × Auri` (or `thomas*auri`), or type a friend's name next to the
creature on screen under "Lay an egg", or press × on a creature you hatched, or drag it onto the scene. The
two parents hop in, meet, lay an egg between them and watch it hatch. "Their egg #2" lays the couple's next
egg; the child can cross again, with anyone: `(thomas*auri)*noe`.

## How it works

```
src/seed.mjs            seeds: normalize, validate, the reason a seed is refused
src/lineage.mjs         lineages: read one written any way, write its one form, the reason one is refused
src/genome.mjs          genomeOf(lineage): a word's creature, or the child of its parents
src/cross.mjs           cross(a, b, clutch): the child of two genomes
src/genome/             genes (one stream per gene), a word's genome, heredity, names, palettes, species
bin/hatch.mjs           the command
src/render/             the scene: pixel renderer, toon materials, stage, egg, creature, species, parts
                        from another species (grafts.js), the parents' meeting, shadows, effects
src/share/              the GIF encoder, the card, the pixel font
src/audio/cry.js        each creature's cry, through Web Audio
src/family.js           the family tree on the page
src/main.js             the page: input, address, crossing, card, window.__wild
```

**A lineage** is read by a small recursive reader ([src/lineage.mjs](src/lineage.mjs)) that follows the
grammar line by line and says in a sentence what is wrong with a lineage it refuses. A child is never
stored: `genomeOf` reads its lineage and crosses the genomes of its two parents, each hatched the same way,
down to the words. **Crossing** ([src/cross.mjs](src/cross.mjs)) first puts the two parents in the order the
child's seed writes them, then draws every choice from the child's own genes, so it is symmetric and the
same everywhere; how traits pass from parent to child is in
[src/genome/heredity.mjs](src/genome/heredity.mjs). The crossing knows nothing of the rendering: the
renderer only reads the child's genome, as it reads any other.

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
without smoothing; its corner is snapped to a whole screen pixel. Every lit part has a toon material:
three.js lights it (sun, shadows, ambient), then the light level picks one of four flat bands of the part's
own color, shadows leaning cool and highlights warm. Markings (spots, stripes, a patch, a mask, socks) are
drawn in each part's own space, so they stick to it and come out as pixel shapes. Eyes, mouths and cheeks
are small flat shapes on the head's surface.

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
  wyrmlet (a dragon pup that sits like a dog, with a fluffy mane, horns, plates down its chest, small wings
  and a tail curled at its side), inchling (a caterpillar that rears up),
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
- **The page** with no `?seed=` hatches a word from the built-in list and puts it in the address. When the
  page opens, its creature is already out of its egg, so it smiles at once; a seed typed, picked or drawn at
  Random hatches from its egg. Each hatch pushes a history entry, so Back returns to the previous creature. A
  refused seed shows its reason under the input and keeps the creature. Random deals the 160 built-in words,
  sixteen per species, from a shuffled deck, so twenty presses hatch twenty different words. Under the card,
  "Hatched here" keeps the last sixteen creatures hatched on this device (in `localStorage`); a chip hatches
  its creature again, its × crosses it with the creature on screen.
- **The hatch** takes about two and a half seconds. The egg drops and wobbles; a jagged crack, its teeth
  drawn from the seed, starts on the side facing you and runs around in three knocks, branching, chips of
  shell flying off. The cap pops off and only the head comes out first, looking around (the rest of the
  body is not drawn while it is still in the shell). Then the bottom falls open in three pieces, the body
  shows from the top down, and the creature grows to its full size and hops out.
- **Sounds**: the egg cracks three times, pops when the cap comes off and crumbles when it falls open,
  then the creature cries. The Sound button turns them off, and the page remembers it.
- **The GIF** is 480 × 480, four screen pixels per art pixel, 64 colors at most: the whole hatch, then the
  creature shows its habit and gets poked; its name runs along the bottom.
  It is encoded in the browser by [src/share/gif.js](src/share/gif.js) (median cut, LZW).
- **The card** is 640 × 896, four pixels per art pixel: name, the creature on its island, species and
  affinity, the four stats as bars and numbers, a line about its mood, and the seed, in a 5 × 7 pixel font
  drawn in [src/share/font.js](src/share/font.js). Seeds in other scripts are drawn in the system font,
  snapped to whole pixels.

## Crossing: choices where the brief is silent

- **Heredity.** A child has the body of one parent, its species, and every trait of that parent. Where both
  parents have the same kind of trait, it takes it from either, a group at a time: its eyes (shape, size and
  gap together), its song (notes, contour and vowel), its mouth, cheeks, markings, charm, mood, and each part
  of the body (ears with their length, horns, a crest, a tail with its tip). Sizes, build, voice pitch and
  the other numbers are one parent's or a blend of both. `heritageOf()` in heredity.mjs says where each of a
  child's traits came from, and the family tree shows it.
- **Hybrids.** A parent of another species passes on, half the time each, the parts the child's body has no
  place of its own for: horns, a crest or antennae on its head, ears, wings or a ridge on its back, a tail.
  A pipkin with a hopple's long ears, a frog with a dragon's wings and tail, a jelly with horns. Each species
  says where those places are on its body ([src/render/grafts.js](src/render/grafts.js)). A part the
  child keeps from a parent of its own species stays with it, so hybrids breed true.
- **Mutations** redraw a trait with the genes of the child alone, inside the ranges of the species the trait
  comes from, and unlike both parents' values (a number outside theirs where it can be), so a mutation is
  always something new. The family tree marks them.
- **Rarity.** A child of two common parents is rare 1 time in 64; each rare parent makes it four times
  likelier (1 in 16, 1 in 4). A rare child is starlit, as in round 1.
- **Colors.** A child's body and belly are its body's parent's colors blended a quarter to a half of the way
  toward the other parent's; it mostly wears the other parent's accent (markings, ears, crest), and either's
  horns and eyes.
- **Names** sound like both parents': the first syllable of one parent's name and the last of the other's
  (Thombun × Aurizap gives Thomzap or Aurbun). Two eggs of a couple may share a name: the lineage tells them
  apart.
- **Stats** start from the parents' average total (175 to 250 before the rare bonus, nudged by up to 10) and
  are shared like the average of their stats.
- **The meeting.** A typed cross, a × or a dropped chip plays the event: the parents hop in from either side
  of the island, call out to each other, meet nose to nose under hearts, an egg pops out between them, they
  step back to watch it crack, and they cheer when their child is out, and stay with it, a family. Both
  parents can be poked too.
- **A link to a child** opens it at once, out of its egg (a page that opens should smile right away); "Watch
  them meet" plays its parents' meeting and its hatch. "Their egg #n" lays the couple's next egg.
- **The family tree** sits under the card: the grandparents, the parents and the child, each by name and
  joined by brackets, each a button that opens it, then what the child took from whom, in sentences.
- **The card** of a child shows its parents' pictures with their names, and its lineage as it is written,
  on as many lines as it takes, in the pixel font, which now has small letters (round 1 printed `OLEG`).
- **The GIF** of a child starts with its parents meeting, their names along the bottom, then the hatch and
  the child, its name along the bottom.

## Speed

The checks, and some players, draw the page in software (SwiftShader), where vertices and the first draw of
anything are what cost. Small parts have fewer faces than big ones; shadows are each part drawn once more,
flattened onto the island along the sun's rays, instead of a shadow map's extra pass; the stage behind the
canvas is two plain fills, not a gradient; frames are paced by a query on the GPU's progress, which never
waits for it, and a machine that takes more than a tenth of a second a frame rests between frames; once a
creature is out, what the stage may draw later (the egg, a sprite) is drawn once out of sight. In the
checks' Chromium, at two CPUs, a page shows its creature in about two seconds, and runs at 20 to 30 frames
a second for one creature, about 20 with a family of three.

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
