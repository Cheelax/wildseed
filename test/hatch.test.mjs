// The command: ARCHITECTURE.md, "The command". Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const bin = fileURLToPath(new URL("../bin/hatch.mjs", import.meta.url));
const hatch = (...seeds) => spawnSync(process.execPath, [bin, ...seeds], { encoding: "utf8" });

test("prints one line of JSON per seed, in order", () => {
  const r = hatch("moss", "Pebble", "東京");
  assert.equal(r.status, 0);
  const lines = r.stdout.trimEnd().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((g) => g.seed), ["moss", "pebble", "東京"]);
});

test("one bad seed: nothing on stdout, the reason on stderr, exit 2", () => {
  for (const args of [[], ["moss", "a**b"], ["🐸"]]) {
    const r = hatch(...args);
    assert.equal(r.status, 2);
    assert.equal(r.stdout, "");
    assert.ok(r.stderr.trim().length > 0);
  }
});

test("a cross hatches a child with parents and clutch", () => {
  const r = hatch("thomas*auri", "Thomas × Auri #2");
  assert.equal(r.status, 0, r.stderr);
  const [a, b] = r.stdout.trimEnd().split("\n").map((l) => JSON.parse(l));
  assert.equal(a.seed, "auri*thomas");
  assert.deepEqual(a.parents, ["auri", "thomas"]);
  assert.equal(a.clutch, 1);
  assert.equal(b.seed, "auri*thomas#2");
  assert.equal(b.clutch, 2);
});

test("hatches 1,000 seeds in a few seconds at most", () => {
  const start = performance.now();
  const r = hatch(...Array.from({ length: 1000 }, (_, i) => `seed${i}`));
  assert.equal(r.status, 0);
  assert.equal(r.stdout.trimEnd().split("\n").length, 1000);
  assert.ok(performance.now() - start < 3000);
});
