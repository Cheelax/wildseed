// Calls cross() from the entry's src/cross.mjs on pairs of genomes and prints what it returned, as one JSON line on
// stdout. run.mjs starts it in a child process, as the entry's user: the entry's code never runs in the check's.
//   node cross.mjs <pairs.json>      (from the entry's root; pairs: [{ "a": genome, "b": genome, "clutch": n }])
// Before the entry's code loads, Math.random and the clock throw, and each call gets deep-frozen copies of its
// genomes: a cross that draws at random, reads the time or changes its arguments fails.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const trap = (what) => () => {
  throw new Error(`${what} was called: a crossing is pure`);
};
Math.random = trap("Math.random()");
Date.now = trap("Date.now()");
globalThis.Date = new Proxy(Date, { construct: trap("new Date()"), apply: trap("Date()") });
try {
  Object.defineProperty(performance, "now", { value: trap("performance.now()") });
} catch {}

const freeze = (v) => {
  if (v && typeof v === "object") {
    for (const x of Object.values(v)) freeze(x);
    Object.freeze(v);
  }
  return v;
};
const copy = (v) => freeze(JSON.parse(JSON.stringify(v)));
const say = (result) => process.stdout.write(`${JSON.stringify(result)}\n`);

const why = (e) => String(e?.message ?? e).split("\n")[0].slice(0, 400);

let cross = null;
try {
  ({ cross } = await import(pathToFileURL(join(process.cwd(), "src", "cross.mjs")).href));
  if (typeof cross !== "function") throw new Error("src/cross.mjs exports no function named cross");
} catch (e) {
  say({ fatal: why(e) });
  cross = null;
}

if (cross) {
  const pairs = JSON.parse(readFileSync(process.argv[2], "utf8"));
  const results = pairs.map(({ a, b, clutch }) => {
    try {
      const out = { ab: cross(copy(a), copy(b), clutch), ba: cross(copy(b), copy(a), clutch) };
      if (clutch === 1) out.plain = cross(copy(a), copy(b));
      return JSON.parse(JSON.stringify(out));
    } catch (e) {
      return { error: why(e) };
    }
  });
  say({ results });
}
