# Wildseed hatchery

## Run and verify

Node 24 or later: `npm ci --ignore-scripts`, then `npm run dev`. The production site is `npm run build`, `npm run preview`. Assets use relative paths, so `dist/` also works in a subdirectory. No remote assets, APIs, model files, fonts or audio downloads are used.

`node bin/hatch.mjs moss "  Daniel  " 東京` prints one genome per line. All seeds are validated before anything is printed; a bad seed exits 2 and names it on stderr. `node --test test/*.test.mjs` checks Unicode, batch failures, frozen v1 fixtures, independent-process determinism, 10000-seed distribution and GIF encoding. The official checks live unchanged under `.launchpad/checks/`; eligibility requires the pinned container gate.

## Use

Type a word or short phrase, press Enter or Hatch, and watch the egg open. Random chooses a different seed from a local list. Drag the diorama to orbit, move the pointer to attract the creature's gaze, and tap to greet it. Sound on/off controls a short genome-derived Web Audio voice; audio starts only through a user gesture. The field notes display the actual genome used by the CLI. Invalid input shows a reason and preserves the current creature.

Save GIF renders 36 actual scene frames at 12 frames/s: the hatch followed by the creature alive, quantized to a 64-color palette and encoded entirely in the browser. Save card creates a 720 × 900 PNG with the creature, name, species, affinity, stats and seed. Exports temporarily lock seed changes so a download cannot mix genomes. The small built-in GIF encoder uses frequent LZW resets, trading file size for a deterministic implementation without dependencies.

## Design and configuration

`src/genome.mjs` is pure and independent of rendering. Version 1 defines normalization, UTF-8 FNV-1a hashing, unsigned integer PRNG, species, names, palette, stats and anatomy. Its call order is a compatibility contract. Future rounds should append versioned fields without changing existing seeds. `test/genome.test.mjs` pins a complete known genome.

The six original species are bellfin, bramblebun, lanternmoth, pebblepup, sproutling and tumbletoad. Each has bounded proportions and a different anatomical silhouette; rare variants change palette and add a golden orbital halo. `src/creatures.js` builds and disposes their geometry. `src/scene.js` renders a low-resolution 3D scene with shadows, toon bands, pixel-shaped faces and a depth-based one-pixel outline. CSS uses nearest-neighbor scaling at an integer ratio, including on high-DPI screens. Orbiting changes the 3D view without temporal jitter.

Presentation configuration: `PIXEL` and `HATCH_SECONDS` in `src/scene.js`; `GIF_SIZE` and `GIF_FRAMES` in `src/sharing.js`; palette ramps and anatomy limits in `src/genome.mjs`; interface tokens in `src/style.css`. The protocol constants in `src/rules.mjs` remain unchanged. Reducing `GIF_SIZE` reduces export size and CPU; keep it at least 64 and `GIF_FRAMES` at least 12. Pixel scale must remain at least 3. Every image, cry and creature is generated in code; see CREDITS.md.

## Verification limits

Headless software WebGL2 proves the offline renderer, exported file formats and browser workflow. Hardware performance and audio character still need human assessment on the target laptop and phone. Passing checks is not a promise of judging rank.
