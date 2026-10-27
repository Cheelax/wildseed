// Traits by their dotted paths (`ears`, `voice.pitch`): how a child's traits are inherited, mutated and listed.

/** Every value of an object by its dotted path, as [path, value] pairs; arrays are values, not paths. */
export function leaves(v, prefix = "", out = []) {
  for (const [k, x] of Object.entries(v)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (x && typeof x === "object" && !Array.isArray(x)) leaves(x, path, out);
    else out.push([path, x]);
  }
  return out;
}

/** The value at a dotted path, or undefined. */
export const valueAt = (v, path) => path.split(".").reduce((o, k) => o?.[k], v);

/** Sets the value at a dotted path, making the objects on the way. */
export function setAt(v, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  for (const k of keys) v = v[k] ??= {};
  v[last] = value;
}

/** Whether two trait values are the same. */
export const same = (v, w) => v !== undefined && JSON.stringify(v) === JSON.stringify(w);
