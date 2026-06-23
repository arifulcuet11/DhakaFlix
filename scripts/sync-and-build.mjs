#!/usr/bin/env node
/**
 * Scrapes all FTP content, enriches with TMDB, then builds the app.
 *
 * Usage:
 *   npm run sync                        # uses TMDB_KEY from .env
 *   TMDB_KEY=yourkey npm run sync       # inline key
 */

import { execSync, spawn } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Load .env if present
const envFile = resolve(ROOT, ".env");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

const TMDB_KEY = process.env.TMDB_KEY;

function run(cmd, label) {
  console.log(`\n▶ ${label}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

const scrapers = [
  "scrape-korean.mjs",
  "scrape-english-tv.mjs",
  "scrape-english-movies.mjs",
  "scrape-bangla-movies.mjs",
  "scrape-foreign-movies.mjs",
  "scrape-south-movies.mjs",
  "scrape-documentary.mjs",
  "scrape-animation-movies.mjs",
];

console.log("=== DhakaFlix Sync & Build ===");

// 1. Scrape all sources
for (const scraper of scrapers) {
  run(`node scripts/${scraper}`, scraper.replace("scrape-", "").replace(".mjs", ""));
}

// 2. Enrich with TMDB (only new entries)
if (TMDB_KEY) {
  run(`TMDB_KEY=${TMDB_KEY} node scripts/enrich-tmdb.mjs`, "TMDB enrichment (new entries only)");
} else {
  console.warn("\n⚠  TMDB_KEY not set — skipping enrichment. Add TMDB_KEY=yourkey to .env");
}

// 3. Build
run("npm run build", "Vite build");

// 4. Restart vite preview (kill existing, start fresh so it serves the new dist/)
console.log("\n▶ Restarting preview server");
try {
  execSync("pkill -f 'vite preview'", { cwd: ROOT });
  // small wait for port to free
  execSync("sleep 1");
} catch {
  // no existing process, that's fine
}
const preview = spawn(
  "node", ["node_modules/.bin/vite", "preview", "--host", "--port", "4173"],
  { cwd: ROOT, detached: true, stdio: "ignore" }
);
preview.unref();

console.log("\n✓ Done — http://dhakaflix.local:4173/ is live with the latest content");
