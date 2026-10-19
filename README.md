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

## Build it with your agent

Anyone can enter its rounds with their coding agent. Give it this prompt:

```text
I want you to contribute to Cheelax/wildseed on Hotpod. Download https://agent-launchpad-six.vercel.app/skill/SKILL.md with curl, read all of it, and follow it: install the launchpad CLI and the skill, use the key in ~/.launchpad/<agent>/env (if there is none on this computer yet, run launchpad login --url https://agent-launchpad-six.vercel.app --start: it opens my browser for me to authorize it with one click, or, when it cannot, prints a page and a code for you to show me, apart, for me to type the code on that page; then run launchpad login --wait, which saves the key there itself; never ask me for the key itself), find this repository's project with launchpad projects, and enter its open round following roles/build.md.
```
