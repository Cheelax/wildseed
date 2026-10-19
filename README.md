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
```

`npm run build` writes the static site to `dist/`. Every push to `main` deploys it to GitHub Pages.

## The hatchery

Enter a name or short phrase and press Enter or Hatch. Surprise me chooses another word from an embedded
list. The address contains the normalized seed, so a copied link recreates the same creature. Invalid
input keeps the current creature and explains the error. With no URL seed, the most recent word is
restored when storage is available; a fresh visit starts with `clover`.

Drag the scene to orbit. Tap the creature or use Say hello to animate it and hear its synthesized voice.
With the scene focused, the arrow keys rotate the camera, Enter/Space greet the creature, and Home resets
the view. Sound starts after a user gesture and can be muted. Reduced-motion preference shortens the hatch
and reduces idle movement. The controls work without hovering.

The heart keeps up to 24 creatures. The last 12 words, kept words and sound preference are stored in
`wildseed.hatchery.v1` on this browser. Only seeds and preferences are saved; genomes are regenerated.
Corrupt, unsupported or unavailable storage does not prevent hatching or exporting. There is no account,
server storage or remote request.

Save GIF records the hatch and idle animation into a 160×160, 48-frame GIF using a shared 64-color palette.
Save card makes a 720×960 PNG with the creature, name, species, affinity, stats and seed. Both exports
render their own timeline in the browser. Camera changes and a greeting do not change the exported genome.

## Implementation

- `src/genome.mjs`: Unicode normalization and validation, integer hashing, separate seeded streams for
  identity, names, rarity, palette, stats and body traits. Version-one mappings are frozen by a reference
  digest test; future rounds can add fields without changing these streams.
- `src/creature.js`: six geometry builders (Spriglet, Craggle, Flutterseed, Mushling, Bloomkin, Embercurl)
  with bounded shape parameters, facial geometry and species animations. Golden variants have a crown
  and a distinct palette. All creature assets are generated at runtime.
- `src/scene.js`: Three.js WebGL 2, orthographic orbit camera, toon gradient, shadows, low-resolution
  color/depth render target and a one-texel depth-edge outline. Canvas dimensions are integer multiples
  of the CSS art pixel; the drawing buffer does not multiply with device pixel ratio.
- `src/audio.js`: short envelopes and pitch sequences derived from the genome, activated by user gestures.
- `src/export.js`, `src/gif.mjs`: PNG composition and indexed GIF encoding. GIF uses median-cut palette
  reduction, no dithering and frequent LZW dictionary resets to bound memory. The tradeoff is a larger
  file than a full adaptive dictionary compressor.
- `src/storage.mjs`: validated, bounded local history and favourites with graceful storage failure.
- `src/main.js`: UI, hatch lifecycle, URL, accessibility and export state. `window.__wild` always exposes
  the same complete genome as the CLI, and becomes ready only after the hatch is rendered.

## Verification

```sh
node --test tests/core.test.mjs
node .launchpad/checks/round-1/run.mjs
```

The second command needs the Chromium supplied by the pinned runner. The official checks and
`src/rules.mjs` are unchanged. Local checks are not a substitute for a pinned-container gate transcript.

`tests/browser.mjs` performs additional functional and visual review of all six species, a rare variant,
camera/keyboard controls, greeting, storage/reload, rapid hatches, downloads, responsive layouts, Random,
and reduced motion. It writes images and a JSON report to ignored `.work/browser/`.

On the configured Debian host, after creating a clean local candidate commit, `bash tools/test-host.sh`
runs installation, unit tests, build, browser review and the official gate sequentially. It uses the
previously configured rootless Podman environment and publishes no ports. Evidence stays in ignored
`.work/`, outside the committed tree. The script makes no commit, push, seal, deposit or submission.

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
