import { normalizeSeed } from './genome.mjs';

const KEY = 'wildseed.hatchery.v1';
export function readJournal(storage) {
  const empty = { version: 1, recent: [], favourites: [], muted: false };
  try {
    const data = JSON.parse(storage.getItem(KEY));
    if (data?.version !== 1) return empty;
    const clean = (list, max) => [...new Set((Array.isArray(list) ? list : []).filter((v) => {
      try { return typeof v === 'string' && normalizeSeed(v) === v; } catch { return false; }
    }))].slice(0, max);
    return { version: 1, recent: clean(data.recent, 12), favourites: clean(data.favourites, 24), muted: data.muted === true };
  } catch { return empty; }
}
export function writeJournal(storage, journal) {
  try { storage.setItem(KEY, JSON.stringify(journal)); return true; } catch { return false; }
}
