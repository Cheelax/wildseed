# Wildseed hatchery

## Run and verify

Node 24 or later: `npm ci --ignore-scripts`, then `npm run dev`. The production site is `npm run build`, `npm run preview`. Assets use relative paths, so `dist/` also works in a subdirectory. No remote assets, APIs, model files, fonts or audio downloads are used.

`node bin/hatch.mjs moss "  Daniel  " 東京` prints one genome per line. All seeds are validated before anything is printed; a bad seed exits 2 and names it on stderr. `node --test test/*.test.mjs` checks Unicode, batch failures, frozen v1 fixtures, independent-process determinism, 10000-seed distribution and GIF encoding. The official checks live unchanged under `.launchpad/checks/`; eligibility requires the pinned container gate.

## Use

Type a word or short phrase, press Enter or Hatch, and watch the egg open. Random chooses a different seed from a local list. Drag the diorama to orbit, move the pointer to attract the creature's gaze, and tap to greet it. Sound on/off controls a short genome-derived Web Audio voice; audio starts only through a user gesture. The field notes display the actual genome used by the CLI. Invalid input shows a reason and preserves the current creature.

Save GIF renders 36 actual scene frames in a square 192 × 192 composition: the hatch followed by the creature alive. An adaptive 64-color palette preserves the artwork's colors; bounded-dictionary LZW compresses it without dependencies. Alternating 8/9-centisecond delays give exactly 3 seconds at an average 12 frames/s. Save card creates a 720 × 900 PNG with the creature, name, species, affinity, stats and seed, with a fixed, eyes-open pose and a crisp 4× image scale. Both exports use dedicated render targets and neutral camera/gaze, so phone size, orbit and pointer position do not affect composition. Controls lock until export completes, and the live scene is restored even after an error.

Unavailable audio reports a visible reason and leaves hatching usable. Reduced motion disables breathing, body sway, bounce, wing flutter and halo motion while retaining blinking and gaze. Loss of the actual WebGL context disables hatching/export, explains reload recovery, and reloads automatically if the browser restores the context. A browser without WebGL 2 gets an explicit startup error with disabled controls.

## Design and configuration

`src/genome.mjs` is pure and independent of rendering. Version 1 defines normalization, UTF-8 FNV-1a hashing, unsigned integer PRNG, species, names, palette, stats and anatomy. Its call order is a compatibility contract. Future rounds should append versioned fields without changing existing seeds. `test/genome.test.mjs` pins a complete known genome.

The six original species are bellfin, bramblebun, lanternmoth, pebblepup, sproutling and tumbletoad. Each has bounded proportions and a different anatomical silhouette; rare variants change palette and add a golden orbital halo. `src/creatures.js` builds and disposes their geometry. `src/scene.js` renders a low-resolution 3D scene with shadows, toon bands, pixel-shaped faces and a depth-based one-pixel outline. CSS uses nearest-neighbor scaling at an integer ratio, including on high-DPI screens. Orbiting changes the 3D view without temporal jitter.

Presentation configuration: `PIXEL` and `HATCH_SECONDS` in `src/scene.js`; `GIF_SIZE`, `GIF_FRAMES` and `GIF_FPS` in `src/sharing.js`; palette ramps and anatomy limits in `src/genome.mjs`; interface tokens in `src/style.css`. The protocol constants in `src/rules.mjs` remain unchanged. Reducing `GIF_SIZE` reduces export size and CPU; keep it between 64 and 1024 and `GIF_FRAMES` at least 12. Keep `GIF_FPS` between 1 and 50 for useful GIF centisecond timing. Pixel scale must remain at least 3. Every image, cry and creature is generated in code; see CREDITS.md.

## Browser regression

After `npm run build`, run `node test/browser-hatchery.mjs` with Playwright's Chromium installed. For the official software-rendering environment, use the runner image digest from `launchpad round wildseed/1`, mount this checkout read-only at `/app`, set `-w /app`, and run the same command with network disabled. `WILD_QA_DIR` optionally points to a writable evidence directory; export artifacts use exclusive creation, so choose a fresh directory for each run. The suite verifies every decoded pixel in flat/noisy GIF fixtures, decodes all 36 actual exported frames and their total timing, hatches all species with audio unavailable, exercises invalid and Unicode inputs, locks controls during export, compares identical phone/desktop PNG bytes, and triggers real WebGL context loss. It fails on any uncaught page exception. The unit suite also pins a SHA-256 over 10,000 pre-refinement genomes and checks all species' reduced-motion transforms.

## Verification limits

Headless software WebGL2 proves the offline renderer, exported file formats and browser workflow. Hardware performance and audio character still need human assessment on the target laptop and phone. Passing checks is not a promise of judging rank.
