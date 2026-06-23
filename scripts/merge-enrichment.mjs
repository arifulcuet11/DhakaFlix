/**
 * Merges TMDB enrichment fields from an existing JSON file into freshly scraped data.
 * Call this right before writeFileSync in any scraper, or use mergeAndWrite() instead.
 *
 * Preserved fields per entry (matched by id):
 *   synopsis, rating, voteCount, tmdbId, tmdbPoster, tmdbBanner, genre
 */

import { readFileSync, writeFileSync, existsSync } from "fs";

const ENRICHMENT_FIELDS = ["synopsis", "rating", "voteCount", "tmdbId", "tmdbPoster", "tmdbBanner", "genre"];

export function mergeAndWrite(outPath, freshItems) {
  let existing = [];
  if (existsSync(outPath)) {
    try { existing = JSON.parse(readFileSync(outPath, "utf8")); } catch {}
  }

  // Build a lookup map of existing enrichment by id
  // Only carry over fields that have real values (skip [], null, empty string)
  const enrichMap = new Map();
  for (const item of existing) {
    if (!item.id) continue;
    const fields = {};
    for (const f of ENRICHMENT_FIELDS) {
      if (!(f in item)) continue;
      const v = item[f];
      if (v === null || v === "" || (Array.isArray(v) && v.length === 0)) continue;
      fields[f] = v;
    }
    if (Object.keys(fields).length) enrichMap.set(item.id, fields);
  }

  // Merge enrichment into fresh items
  const merged = freshItems.map(item => {
    const saved = enrichMap.get(item.id);
    if (!saved) return item;
    return { ...item, ...saved };
  });

  writeFileSync(outPath, JSON.stringify(merged, null, 2), "utf8");
  return merged;
}
