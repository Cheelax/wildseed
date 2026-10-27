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
npm run dev                                 # the hatchery, at the address Vite prints
node bin/hatch.mjs thomas                   # a seed's genome, as JSON
node bin/hatch.mjs 'thomas*auri' '(thomas*auri)*noe#2'   # a child, a grandchild from its second egg
npm test                                    # tests: the genome, lineages and crossing, the command, the GIF encoder
```

`npm run build` writes the static site to `dist/`. Every push to `main` deploys it to GitHub Pages.

On the page: type a word and press Enter (or Hatch), or press Random. Type two, `Thomas × Auri` (or
`thomas*auri`), and they lay an egg: their child hatches. Or type the parents under "Lay an egg", press the ♥ of
a creature you hatched before, or drag it onto the scene. "Lay egg #2" lays the couple's next egg. Drag the scene
to turn the camera, scroll or pinch to zoom, click or tap a creature to poke it. Save GIF and Save card download
what you see, made in the browser; a child's link opens it with its whole family.

## How it works

```
src/seed.mjs            seeds: normalize, validate, the reason a seed is refused
src/lineage.mjs         lineages: reading `(thomas*auri#2)*noe`, its one written form, the reason one is refused
src/genome.mjs          genomeOf(lineage): species, affinity, rarity, name, stats, palette, traits
src/cross.mjs           cross(a, b, clutch): two genomes lay an egg, out comes their child
src/family.mjs          a child's ancestors, and where each of its traits came from
src/genome/             genes (one stream per gene), names, palettes, the ten species' knobs and traits,
                        stats, the parts a species hands down to a child of another (heirlooms)
bin/hatch.mjs           the command
src/render/             the scene: pixel renderer, toon materials, stage, egg, creature, species, effects
src/share/              the GIF encoder, the card, the pixel font
src/audio/cry.js        each creature's cry, through Web Audio
src/render/meeting.js   a child's parents meet, lay its egg, watch it hatch
src/render/heirlooms.js a heirloom on a child's body: a crest, a shell, moth wings…
src/ui/                 the crossing controls and the family tree
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
  last twelve creatures hatched on this device (in `localStorage`); a chip hatches its creature again, its ♥
  crosses it with the one on screen, and dragging it onto the scene or onto another chip does too.
- **The hatch** takes about two and a half seconds (a page opened from a link plays it faster). The egg drops and wobbles; a jagged crack, its teeth
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
  affinity, the four stats as bars and numbers, a line about its mood, and the seed as it is written, in a 5 × 7 pixel font
  drawn in [src/share/font.js](src/share/font.js). Seeds in other scripts are drawn in the system font,
  snapped to whole pixels.

## Crossing

[ARCHITECTURE.md, "Lineages"](ARCHITECTURE.md#lineages) has the rules; here is what they look like.

- **A child's seed is its lineage**: `auri*thomas` is the first egg of Auri and Thomas, `auri*thomas#3` their
  third, `(auri*thomas)*noe` the child of that first egg and Noe. The link carries the whole family tree:
  nothing is stored anywhere. However it is typed (`Thomas × Auri`, `thomas*auri#1`), it has one written form.
- **[src/cross.mjs](src/cross.mjs)** draws every choice from the genes of that written form, with the parents
  in its order, so a couple's egg is the same child whoever is named first, and their next egg is a sibling,
  not a twin. The species comes from one parent, the affinity from one (a moss child of a spark parent can keep
  its bolt). Each trait comes from one parent, or, one time in five for a number, halfway between; each
  mutates one time in fifty, drawn afresh inside its species' ranges and never to the same value. A child of
  two common parents is rare one time in 64, one time in 8 with a rare parent, one in 3 with two.
- **Heirlooms**: a child takes its body from one parent, and when the other is of another species, one of
  that parent's parts too (sometimes two), wherever its own body leaves room: a hopple with a pipkin's crest, a
  toadle with a wyrmlet's horns, a trundle with a domeback's shell on its back, a pipkin with a drift's frills.
  The part keeps the traits that shape it, under the same names, and goes down the family line: a child keeps
  every heirloom of its parent of its own species. So you can point at one parent's ears and the other's tail.
- **Colors**: the body is a blend of the parents' bodies (in hue, saturation and lightness, the hue turning the
  short way round); belly, accent, detail, eyes and outline each come from one parent or halfway between.
- **Names** sound like both parents: the first syllable of one, then the end of the other (Thombit and Noetik
  make Thomik).
- **Stats**: a total between the parents', shared by weights between theirs.
- **The meeting**: on the page, a child's parents walk onto the island from either side, meet nose to nose,
  each hopping and calling to the other under hearts, and step back as the egg swells up between them. Then
  the usual hatch, while they watch; they cheer when their child climbs out, turning to show its side. A child
  with a mutation comes out in a shower of sparkles. Every creature on the island answers a tap: a click
  anywhere inside a creature's outline box counts, between a drift's tentacles too.
- **The family tree** under the card shows the child, its parents and its grandparents, each with its portrait
  and its name (a click hatches it), and where the child's looks came from: from each parent, between the two,
  like both, or mutated.
- **The GIF** of a child films the whole event, wider, with the parents' names under the child's; **the card**
  shows the two parents' portraits and the lineage as it is written, on as many lines as it needs.

## Round 1's judging, fixed

- The page opened from a link hatches its creature at 1.6 times the speed, and the page's first paint got
  cheaper (no `color-mix()`, no gradient: on a software renderer they cost the first paint about half a
  second), so in headless Chromium on SwiftShader it is ready more than a second sooner (about 2.5 s
  instead of 3.6 s on a laptop, where the hatch alone took 2.45 s).
- A tap anywhere inside a creature's box pokes it: a drift answers between its tentacles.
- The spheres creatures are made of have half the triangles, which at 160 art pixels high nobody can see.
- The card prints the seed as it is written, in a pixel font that now has lowercase letters, `*`, `#`, `(`
  and `)`.

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
