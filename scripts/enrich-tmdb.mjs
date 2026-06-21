/**
 * Enriches public/korean-series.json with TMDB metadata.
 *
 * Usage:
 *   node scripts/enrich-tmdb.mjs --key YOUR_TMDB_API_KEY
 *
 * What it adds to each series:
 *   synopsis   — plot overview
 *   genre      — real genre list (replaces hardcoded ["Drama"])
 *   rating     — TMDB vote average (0–10)
 *   voteCount  — number of TMDB votes
 *   tmdbId     — for future deep-links / poster fallback
 *   tmdbPoster — TMDB poster URL (fallback if FTP image broken)
 *
 * Safe to re-run: already-enriched entries (tmdbId present) are skipped
 * unless --force is passed.
 *
 * TMDB rate limit: 40 requests/second. We use 25 concurrent to stay safe.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname }            from "path";
import { fileURLToPath }               from "url";

const __dir = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────
const args  = process.argv.slice(2);

const keyIdx   = args.indexOf("--key");
const fileIdx  = args.indexOf("--file");
const TMDB_KEY     = keyIdx  !== -1 ? args[keyIdx  + 1] : process.env.TMDB_KEY;
const IN_FILE      = fileIdx !== -1
  ? resolve(args[fileIdx + 1])
  : resolve(__dir, "../public/korean-series.json");
const FORCE        = args.includes("--force");
const RETRY_FAILED = args.includes("--retry-failed");
const TYPE         = args.includes("--type") ? args[args.indexOf("--type") + 1] : "tv"; // "tv" or "movie"

if (!TMDB_KEY) {
  console.error(
    "ERROR: TMDB API key required.\n" +
    "  node scripts/enrich-tmdb.mjs --key YOUR_KEY [--file public/english-tv.json]\n" +
    "  or set env: TMDB_KEY=YOUR_KEY node scripts/enrich-tmdb.mjs\n\n" +
    "  Get a free key at: https://www.themoviedb.org/settings/api"
  );
  process.exit(1);
}

const TMDB_BASE    = "https://api.themoviedb.org/3";
const IMG_BASE     = "https://image.tmdb.org/t/p/w500";
const BACKDROP_BASE = "https://image.tmdb.org/t/p/w1280";
const CONCURRENCY = 25;

// TMDB genre ID → name map (TV genres)
const TMDB_GENRES = {
  10759: "Action",
  16:    "Animation",
  35:    "Comedy",
  80:    "Crime",
  99:    "Documentary",
  18:    "Drama",
  10751: "Family",
  10762: "Kids",
  9648:  "Mystery",
  10763: "News",
  10764: "Reality",
  10765: "Sci-Fi & Fantasy",
  10766: "Soap",
  10767: "Talk",
  10768: "War & Politics",
  37:    "Western",
  // commonly returned sub-genres that TMDB maps via keywords
  10749: "Romance",
  28:    "Action",
  12:    "Adventure",
  14:    "Fantasy",
  36:    "Historical",
  53:    "Thriller",
  27:    "Horror",
};

// ── clean title before searching ─────────────────────────────
function cleanTitle(raw) {
  return raw
    .replace(/\[(?:Dual|Multi|Triple)\s*Audio\]/gi, "")
    .replace(/\(TV\s*(?:Mini\s*)?Series\s*[\d–\-–]+[^)]*\)/gi, "")
    .replace(/\(TV\s*Show\s*[\d–\-–]+[^)]*\)/gi, "")
    .replace(/\(Web\s*Series[^)]*\)/gi, "")
    .replace(/\s*[-–]\s*(?:Season|S)\s*\d+/gi, "")
    .replace(/\b(?:Season|Part)\s*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── TMDB search ───────────────────────────────────────────────
async function tmdbSearch(title, year) {
  const q = encodeURIComponent(title);
  const yearParam = TYPE === "movie" ? `primary_release_year=${year}` : `first_air_date_year=${year}`;
  const url = `${TMDB_BASE}/search/${TYPE}?api_key=${TMDB_KEY}&query=${q}&${yearParam}&language=en-US`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

async function tmdbSearchNoYear(title) {
  const q   = encodeURIComponent(title);
  const url = `${TMDB_BASE}/search/${TYPE}?api_key=${TMDB_KEY}&query=${q}&language=en-US`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
  const data = await res.json();
  return data.results ?? [];
}

// ── best match heuristic ──────────────────────────────────────
function pickBest(results, title, year) {
  if (!results.length) return null;

  const normalise = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const target    = normalise(title);

  // score each result
  const scored = results.map(r => {
    const name   = normalise(r.name || r.title || "");
    const orig   = normalise(r.original_name || r.original_title || "");
    let score    = 0;

    if (name === target || orig === target) score += 100;
    else if (name.includes(target) || target.includes(name)) score += 50;
    else if (orig.includes(target) || target.includes(orig)) score += 40;

    // year bonus
    const airYear = (r.first_air_date || r.release_date || "").slice(0, 4);
    if (year && airYear === String(year)) score += 30;
    else if (year && Math.abs(Number(airYear) - Number(year)) === 1) score += 10;

    // popularity bonus (small)
    score += Math.min(r.vote_count / 500, 5);

    return { r, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];

  // reject very poor matches
  return best.score >= 40 ? best.r : null;
}

// ── enrich one series ─────────────────────────────────────────
async function enrich(series) {
  const { title, year } = series;
  const q = cleanTitle(title);

  let results = await tmdbSearch(q, year);
  let match   = pickBest(results, q, year);

  // retry without year constraint if no good match
  if (!match && year) {
    results = await tmdbSearchNoYear(q);
    match   = pickBest(results, q, year);
  }

  if (!match) return { ...series, tmdbId: null };  // mark as attempted

  const genres = (match.genre_ids || [])
    .map(id => TMDB_GENRES[id])
    .filter(Boolean);

  // deduplicate and cap at 4 genres
  const uniqueGenres = [...new Set(genres)].slice(0, 4);
  if (!uniqueGenres.length) uniqueGenres.push(TYPE === "movie" ? "Drama" : "Drama");

  return {
    ...series,
    synopsis:    match.overview || series.synopsis || "",
    genre:       uniqueGenres,
    rating:      match.vote_average ? Math.round(match.vote_average * 10) / 10 : null,
    voteCount:   match.vote_count   || 0,
    tmdbId:      match.id,
    tmdbPoster:  match.poster_path   ? IMG_BASE      + match.poster_path   : null,
    tmdbBanner:  match.backdrop_path ? BACKDROP_BASE + match.backdrop_path : null,
  };
}

// ── concurrency pool ──────────────────────────────────────────
async function runPool(items, fn, concurrency, onDone) {
  const results = new Array(items.length);
  let idx = 0;

  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try {
        results[i] = await fn(items[i]);
      } catch (e) {
        // on rate limit or network error, keep original data
        results[i] = items[i];
      }
      onDone(i, results[i]);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  console.log(`\nDhakaFlix — TMDB enrichment\n${"─".repeat(40)}`);
  console.log(`Reading: ${IN_FILE}`);

  const series = JSON.parse(readFileSync(IN_FILE, "utf8"));
  const total  = series.length;

  const toProcess = FORCE
    ? series
    : RETRY_FAILED
      ? series.filter(s => !s.tmdbId)          // null (failed) + missing both
      : series.filter(s => !('tmdbId' in s));   // only truly unprocessed
  const skip = total - toProcess.length;

  console.log(`Total:   ${total} series`);
  console.log(`Skip:    ${skip} already enriched`);
  console.log(`Process: ${toProcess.length} series`);
  if (FORCE) console.log("(--force: re-enriching all)");
  console.log();

  if (toProcess.length === 0) {
    console.log("Nothing to do. Use --force to re-enrich all.");
    return;
  }

  // build a map for fast lookup by id
  const byId = Object.fromEntries(series.map(s => [s.id, s]));

  let done = 0;
  let matched = 0;
  let failed  = 0;
  const startMs = Date.now();

  function onDone(i, result) {
    done++;
    if (result.tmdbId)       matched++;
    else if (result.tmdbId === null) failed++;
    byId[result.id] = result;

    const pct     = Math.round((done / toProcess.length) * 100);
    const elapsed = ((Date.now() - startMs) / 1000).toFixed(0);
    const rate    = (done / ((Date.now() - startMs) / 1000)).toFixed(1);
    process.stdout.write(
      `\r  ${done}/${toProcess.length} (${pct}%) ` +
      `matched=${matched} failed=${failed} ` +
      `${rate} req/s  ${elapsed}s elapsed  `
    );
  }

  await runPool(toProcess, enrich, CONCURRENCY, onDone);

  console.log(`\n\n${"─".repeat(40)}`);
  console.log(`Matched:  ${matched}/${toProcess.length} (${Math.round(matched/toProcess.length*100)}%)`);
  console.log(`No match: ${failed}`);

  // rebuild array in original order with enriched data
  const enriched = series.map(s => byId[s.id] || s);

  writeFileSync(IN_FILE, JSON.stringify(enriched, null, 2), "utf8");
  console.log(`\nSaved → ${IN_FILE}`);

  // print genre breakdown
  const genreCount = {};
  for (const s of enriched) {
    for (const g of s.genre || []) {
      genreCount[g] = (genreCount[g] || 0) + 1;
    }
  }
  const sorted = Object.entries(genreCount).sort((a, b) => b[1] - a[1]);
  console.log("\nGenre breakdown:");
  for (const [g, n] of sorted) {
    const bar = "█".repeat(Math.round(n / total * 40));
    console.log(`  ${g.padEnd(20)} ${String(n).padStart(4)}  ${bar}`);
  }
}

main().catch(e => { console.error("\n" + e.message); process.exit(1); });
