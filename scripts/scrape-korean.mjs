/**
 * Scrapes all Korean TV & WEB Series from the FTP server
 * and writes src/data/korean-series.json
 *
 * Usage: node scripts/scrape-korean.mjs
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir    = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://172.16.50.14";
const CAT_PATH = "/DHAKA-FLIX-14/KOREAN%20TV%20%26%20WEB%20Series/";
const OUT_FILE = resolve(__dir, "../src/data/korean-series.json");

const CONCURRENCY = 8; // parallel series fetches
const SEASON_CONCURRENCY = 4; // parallel season fetches per series

// ── fetch helpers ─────────────────────────────────────────────
async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ── parse directory links from h5ai HTML ──────────────────────
function parseFolders(html, baseUrl) {
  const re = /href="([^"]+\/)"/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href === "../" || href === "/" || href.includes("/_h5ai/")) continue;
    found.push(href.startsWith("http") ? href : BASE_URL + href);
  }
  return [...new Set(found)];
}

function parseFiles(html) {
  // each row: href + size in same <tr>
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const results = [];
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const hrefM = /href="([^"]+\.mkv)"/i.exec(row[1]);
    const sizeM = /fb-s">(\d+)\s*KB/.exec(row[1]);
    if (!hrefM) continue;
    const href = hrefM[1];
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
    results.push({ filename, sizeMB });
  }
  return results;
}

function parseImages(html) {
  const re = /href="([^"]+\.(jpg|jpeg|png))"/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.includes("/_h5ai/")) continue;
    const url = href.startsWith("http") ? href : BASE_URL + href;
    const name = decodeURIComponent(url.split("/").pop());
    imgs.push({ url, label: name.replace(/\.[^.]+$/, "") });
  }
  return imgs;
}

// ── parse series title / year / quality from folder name ─────
function parseFolderName(name) {
  const qualM  = name.match(/\b(720p|1080p|2160p|4K|480p)\b/i);
  const yearM  = name.match(/\(?\b(19|20)\d{2}\b\)?/);
  const quality = qualM ? qualM[1] : "720p";
  let title = name
    .replace(/\(TV\s*(Mini\s*)?Series\s*\d{4}\)/i, "")
    .replace(/\(TV\s*Show\s*\d{4}\)/i, "")
    .replace(/\(\d{4}\)/g, "")
    .replace(/\b(720p|1080p|2160p|4K|480p)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const year = yearM ? yearM[0].replace(/[()]/g, "") : "";
  return { title, year, quality };
}

// ── guess episode number from filename ───────────────────────
function guessEpNum(filename) {
  // S01E02, E02, EP02, Ep.02
  const m =
    filename.match(/[Ss]\d+[Ee](\d+)/) ||
    filename.match(/[Ee][Pp]?\.?(\d+)/) ||
    filename.match(/[-._](\d{2,3})[-._]/);
  return m ? parseInt(m[1], 10) : 0;
}

function isFinale(filename) {
  return /\bEND\b/i.test(filename);
}

// ── scrape one season folder ──────────────────────────────────
async function scrapeSeason(seasonUrl) {
  const html = await fetchText(seasonUrl);
  const files = parseFiles(html);
  const label = decodeURIComponent(seasonUrl.split("/").filter(Boolean).pop());

  // guess season number from folder name
  const sNumM = label.match(/Season\s*(\d+)/i) || label.match(/S(\d+)/i);
  const seasonNum = sNumM ? parseInt(sNumM[1], 10) : 1;

  const episodes = files.map(f => ({
    episode: guessEpNum(f.filename),
    filename: f.filename,
    sizeMB: f.sizeMB,
    finale: isFinale(f.filename),
  })).filter(e => e.episode > 0).sort((a, b) => a.episode - b.episode);

  return { season: seasonNum, label, folderUrl: seasonUrl, episodes };
}

// ── scrape one series folder ──────────────────────────────────
async function scrapeSeries(seriesUrl) {
  const folderName = decodeURIComponent(seriesUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(folderName);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");

  let html;
  try { html = await fetchText(seriesUrl); }
  catch (e) { console.error(`  ✗ ${folderName}: ${e.message}`); return null; }

  const images   = parseImages(html);
  const poster   = images.find(i => i.url.includes("a_AL_"))?.url || images[0]?.url || "";
  const banner   = images.find(i => i.url.includes("a_VL_"))?.url || images[1]?.url || "";
  const seasons  = parseFolders(html, seriesUrl).filter(u => {
    const seg = decodeURIComponent(u.split("/").filter(Boolean).pop());
    return /season|s\d+/i.test(seg);
  });

  let seasonData = [];
  if (seasons.length === 0) {
    // flat structure — episodes directly in series folder
    const files = parseFiles(html);
    if (files.length > 0) {
      const episodes = files.map(f => ({
        episode: guessEpNum(f.filename),
        filename: f.filename,
        sizeMB: f.sizeMB,
        finale: isFinale(f.filename),
      })).filter(e => e.episode > 0).sort((a, b) => a.episode - b.episode);
      seasonData = [{ season: 1, label: "Season 1", folderUrl: seriesUrl, episodes }];
    }
  } else {
    // fetch seasons with limited concurrency
    const chunks = [];
    for (let i = 0; i < seasons.length; i += SEASON_CONCURRENCY)
      chunks.push(seasons.slice(i, i + SEASON_CONCURRENCY));
    for (const chunk of chunks) {
      const results = await Promise.allSettled(chunk.map(u => scrapeSeason(u)));
      for (const r of results)
        if (r.status === "fulfilled" && r.value) seasonData.push(r.value);
    }
    seasonData.sort((a, b) => a.season - b.season);
  }

  if (seasonData.length === 0) return null;

  return {
    id,
    title,
    year,
    quality,
    language: "Korean",
    genre: ["Drama"],
    poster,
    banner,
    images,
    seasons: seasonData,
  };
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  console.log("Fetching series list…");
  const listHtml = await fetchText(BASE_URL + CAT_PATH);

  // extract all series folder URLs
  const allUrls = [];
  const re = /href="(\/DHAKA-FLIX-14\/KOREAN[^"]+\/)"/g;
  let m;
  while ((m = re.exec(listHtml)) !== null) {
    if (!m[1].includes("/_h5ai/")) allUrls.push(BASE_URL + m[1]);
  }
  const uniqueUrls = [...new Set(allUrls)];
  console.log(`Found ${uniqueUrls.length} series. Scraping…\n`);

  const results = [];
  let done = 0;

  // process in chunks
  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const chunk = uniqueUrls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(u => scrapeSeries(u)));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
    done += chunk.length;
    const pct = Math.round((done / uniqueUrls.length) * 100);
    process.stdout.write(`\r  ${done}/${uniqueUrls.length} (${pct}%)  `);
  }

  console.log(`\n\nDone. ${results.length} series scraped.`);

  // sort alphabetically by title
  results.sort((a, b) => a.title.localeCompare(b.title));

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`Written → ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
