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
npm run dev                          # the hatchery, at the address Vite prints
node bin/hatch.mjs thomas            # a seed's genome, as JSON
node bin/hatch.mjs 'thomas*auri#2'   # their second egg's child
npm test                             # tests: genomes, lineages, crossing, the command, the GIF encoder
```

`npm run build` writes the static site to `dist/`. Every push to `main` deploys it to GitHub Pages.

On the page: type a word and press Enter (or Hatch), or press Random. Type a friend's name in the field
after ×, and the two lay an egg: their parents meet on the island, the egg is laid between them, and their
child hatches while they watch. Next egg lays the couple's next one; typing a third word after × crosses the
child with it. The chips under "Hatched here" hatch a creature again, and their × (or dragging a chip onto
the scene) lays an egg with the creature on screen. Drag the scene to turn the camera, scroll or pinch to
zoom, click or tap a creature to poke it. Save GIF, Save card and, for a child, Save tree download what you
see, made in the browser; Copy link copies the child's address, which carries its whole family.

## How it works

```
src/seed.mjs            seeds: normalize, validate, the reason a seed is refused
src/lineage.mjs         lineages: read one into a tree, write it in its one written form
src/genome.mjs          genomeOf(lineage): a word's creature, or its parents' child
src/cross.mjs           cross(a, b, clutch): the child of two genomes, part by part
src/family.mjs          a child's parents and grandparents, and where each of its parts came from
src/genome/             genes (one stream per gene), the kinds of trait, every creature's traits, names,
                        palettes and their blends, stats, the ten species' knobs and parts
bin/hatch.mjs           the command
src/render/             the scene: pixel renderer, toon materials, stage, egg, creature, species, effects
src/share/              the GIF encoder, the card, the family tree's picture, faces, the pixel font
src/audio/cry.js        each creature's cry, through Web Audio
src/page/               the card and the family tree on the page
src/main.js             the page: inputs, address, eggs, window.__wild
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
- **The page** with no `?seed=` hatches a word from the built-in list and puts it in the address. Each hatch
  pushes a history entry, so Back returns to the previous creature. A refused seed shows its reason under
  the input and keeps the creature. Random deals the 160 built-in words, sixteen per species, from a
  shuffled deck, so twenty presses hatch twenty different words. Under the card, "Hatched here" keeps the
  last twelve creatures hatched on this device (in `localStorage`); a chip hatches its creature again.
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

**Crossing** happens in [src/cross.mjs](src/cross.mjs), apart from the rendering: two genomes in, a child
out, every choice drawn from genes of the child's own lineage, so the child is the same whichever order its
parents come in and nothing is stored. Each trait is declared once with its kind and its range
([src/genome/kinds.mjs](src/genome/kinds.mjs), [src/genome/traits.mjs](src/genome/traits.mjs)): round 1
draws a word's traits from that declaration, and crossing reads it to keep a child's traits, and its
mutations, inside its species' ranges. The lineage reader is a small recursive descent over the grammar in
ARCHITECTURE.md ([src/lineage.mjs](src/lineage.mjs)).

## Choices for crossing, where the brief is silent

- **Parts, not genes one by one.** A child inherits each part whole from one parent: its eyes (style, size
  and spacing together), its ears, its tail, its crest, its voice. One part in five blends its numbers
  between both parents instead. So you can point at one parent's ears and the other's tail. Every creature
  has eight parts (body, eyes, mouth, cheeks, markings, charm, mood, voice), and each species adds its own
  (a hopple's ears, feet and tail; a drift's bell, tentacles and antenna…).
- **Heirlooms.** A child of two species takes its body from one, and half the time wears a part of the
  other on its head: a wyrmlet's horns, a hopple's ears, a pipkin's crest, an inchling's antennae or a
  drift's antenna, when its own species has no such part. The part keeps its parent's values and is built
  the way its species builds it, sized to the new head; the child's own children of its species keep it.
  So a hopple can have its wyrmlet mother's horns.
- **Species and affinity** each come from one parent, by a coin of the child's own. A part of the other
  parent that the child's species cannot have (a trundle's ears on a hopple) is not passed on; a number from
  another species is brought inside the child's range (a pipkin's short wings on a flutterling). A charm
  passes on whatever the child's affinity: a moss child can wear its spark parent's bolt.
- **Colors**: the child wears one parent's coat (body, belly, outline ink) tinted a fifth to almost half of
  the way toward the other's, the hue turning the short way round; its accent, its detail and its eyes each
  come from one parent.
- **Names** sound like both parents: the front of one parent's name with the ending of the other's, or
  the fronts of both (Thomnub × Aurizap gives a Thomzap, an Aurinub, a Thomauri or an Aurithom). Brothers
  and sisters get different names: an egg skips the names of the eggs laid before it, and once the four are
  worn it takes a parent's front with a new ending of its affinity. No child carries a parent's very name.
- **Stats**: the parents' totals averaged and nudged by up to 10, shared in the proportions of both
  parents' stats; 25 more for a rare child.
- **Mutations**: one part in 50 is drawn afresh inside its species' ranges, every trait of the part listed
  in `mutations`; the family tree marks it ✦ new.
- **Rare children** are starlit like rare words, and keep the accent and detail their parents gave them.
  One child in 64 of two common parents is rare, one in 8 with a rare parent, one in 2 with two.
- **The meeting** lasts about a second before the hatch: the parents hop in from either side of the island,
  meet nose to nose under hearts and sing, the egg pops up between them in a puff of sparkles, and they step
  back to watch. They jump for joy when their child comes out, then stay behind it, alive, where you can poke
  them too and compare them with their child.
- **The family tree** shows the child, its parents and its grandparents with their faces (drawn by the same
  renderer, each once), and one chip per part saying whose it is: a parent's name, both, a blend, or ✦ new.
  Clicking a member hatches it. Save tree downloads it as a picture.
- **The GIF** of a child starts with its parents meeting, its parents' names along the top; its card shows
  its parents' faces and names and its whole lineage, cut between parents when it is long, in a pixel font
  that now has small letters, so seeds print as they are written.

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
