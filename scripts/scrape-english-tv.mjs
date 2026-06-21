/**
 * Scrapes all English TV & WEB Series from the FTP server
 * and writes public/english-tv.json
 *
 * Usage: node scripts/scrape-english-tv.mjs
 *
 * Structure:
 *   http://172.16.50.12/DHAKA-FLIX-12/TV-WEB-Series/
 *     TV Series ★  0  —  9/   (series starting with digits)
 *     TV Series ♥  A  —  L/   (series A–L)
 *     TV Series ♦  M  —  R/   (series M–R)
 *     TV Series ♦  S  —  Z/   (series S–Z)
 *       SeriesFolder (TV Series YYYY–YYYY) QUALITYp [Dual Audio]/
 *         a_AL_.jpg or a11.jpg  — poster
 *         a_V1_.jpg or a22.jpg  — banner
 *         Season 1/ Season 2/ … (or flat MKV files)
 *           Episode.S01E01.mkv …
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir    = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://172.16.50.12";
const CAT_PATH = "/DHAKA-FLIX-12/TV-WEB-Series/";
const OUT_FILE = resolve(__dir, "../public/english-tv.json");

const CONCURRENCY        = 10;
const SEASON_CONCURRENCY = 4;

// ── fetch helpers ─────────────────────────────────────────────
async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

// ── parse series/season subfolder links ──────────────────────
function parseFolderLinks(html) {
  const re = /href="(\/DHAKA-FLIX-12[^"]+\/)"/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.includes("/_h5ai/")) continue;
    found.push(BASE_URL + href);
  }
  return [...new Set(found)];
}

// ── parse .mkv files with sizes ───────────────────────────────
function parseFiles(html) {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  const results = [];
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const hrefM = /href="([^"]+\.mkv)"/i.exec(row[1]);
    const sizeM = /fb-s">(\d+)\s*KB/.exec(row[1]);
    if (!hrefM) continue;
    const href     = hrefM[1];
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
    results.push({ filename, sizeMB });
  }
  return results;
}

// ── parse image URLs ─────────────────────────────────────────
function parseImages(html) {
  const re = /href="([^"]+\.(?:jpg|jpeg|png))"/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (href.includes("/_h5ai/")) continue;
    const url  = href.startsWith("http") ? href : BASE_URL + href;
    const name = decodeURIComponent(url.split("/").pop()).toLowerCase();
    imgs.push({ url, name });
  }
  return imgs;
}

// pick poster and banner from whatever image names are present
function pickImages(imgs) {
  // Convention A: a_AL_.jpg (poster), a_V1_.jpg or a_VL_.jpg (banner)
  // Convention B: a11.jpg (poster), a22.jpg (banner)
  const poster =
    imgs.find(i => i.name.includes("a_al_"))?.url ||
    imgs.find(i => i.name === "a11.jpg")?.url ||
    imgs.find(i => i.name.match(/^a\d+\.jpg$/))?.url ||
    imgs[0]?.url || "";

  const banner =
    imgs.find(i => i.name.includes("a_v"))?.url ||
    imgs.find(i => i.name === "a22.jpg")?.url ||
    imgs.find(i => i.name.match(/^a2\d*\.jpg$/))?.url ||
    imgs[1]?.url || "";

  return { poster, banner };
}

// ── parse title / year / quality from folder name ─────────────
function parseFolderName(name) {
  const qualM  = name.match(/\b(720p|1080p|2160p|4K|480p|576p)\b/i);
  const yearM  = name.match(/\(?\b(19|20)\d{2}\b/);
  const quality = qualM ? qualM[1] : "720p";
  const year    = yearM ? yearM[0].replace(/[()]/g, "") : "";

  let title = name
    .replace(/\(TV\s*(?:Mini\s*)?Series[^)]*\)/gi, "")
    .replace(/\(TV\s*Show[^)]*\)/gi, "")
    .replace(/\(Web\s*Series[^)]*\)/gi, "")
    .replace(/\[(?:Dual|Multi|Triple)\s*Audio\]/gi, "")
    .replace(/\b(720p|1080p|2160p|4K|480p|576p)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return { title, year, quality };
}

// ── guess episode number from filename ───────────────────────
function guessEpNum(filename) {
  const m =
    filename.match(/[Ss]\d+[Ee](\d+)/) ||
    filename.match(/[Ee][Pp]?\.?(\d+)/) ||
    filename.match(/[-._\s](\d{2,3})[-._\s]/);
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

  const sNumM  = label.match(/Season\s*(\d+)/i) || label.match(/S(\d+)/i);
  const seasonNum = sNumM ? parseInt(sNumM[1], 10) : 1;

  const episodes = files
    .map(f => ({
      episode: guessEpNum(f.filename),
      filename: f.filename,
      sizeMB: f.sizeMB,
      finale: isFinale(f.filename),
    }))
    .filter(e => e.episode > 0)
    .sort((a, b) => a.episode - b.episode);

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

  const imgs             = parseImages(html);
  const { poster, banner } = pickImages(imgs);
  const allFolders       = parseFolderLinks(html);
  const seasonFolders    = allFolders.filter(u => {
    const seg = decodeURIComponent(u.split("/").filter(Boolean).pop());
    return /season|s\d+/i.test(seg);
  });

  let seasonData = [];

  if (seasonFolders.length === 0) {
    // flat structure — episodes directly in series folder
    const files = parseFiles(html);
    if (files.length > 0) {
      const episodes = files
        .map(f => ({
          episode: guessEpNum(f.filename),
          filename: f.filename,
          sizeMB: f.sizeMB,
          finale: isFinale(f.filename),
        }))
        .filter(e => e.episode > 0)
        .sort((a, b) => a.episode - b.episode);
      if (episodes.length > 0)
        seasonData = [{ season: 1, label: "Season 1", folderUrl: seriesUrl, episodes }];
    }
  } else {
    // fetch seasons in parallel chunks
    for (let i = 0; i < seasonFolders.length; i += SEASON_CONCURRENCY) {
      const chunk   = seasonFolders.slice(i, i + SEASON_CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(u => scrapeSeason(u)));
      for (const r of settled)
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
    language: "English",
    genre: [],           // filled by enrich-tmdb.mjs
    poster,
    banner,
    seasons: seasonData,
  };
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  console.log("Fetching top-level folder list…");
  const rootHtml    = await fetchText(BASE_URL + CAT_PATH);
  const subFolders  = parseFolderLinks(rootHtml).filter(u => {
    const seg = decodeURIComponent(u.split("/").filter(Boolean).pop());
    return /TV\s*Series/i.test(seg);
  });
  console.log(`Found ${subFolders.length} sub-folders.`);

  // collect all series URLs across all sub-folders
  const allSeriesUrls = [];
  for (const sub of subFolders) {
    const html  = await fetchText(sub);
    const links = parseFolderLinks(html).filter(u => !subFolders.includes(u));
    console.log(`  ${decodeURIComponent(sub.split("/").pop())}: ${links.length} series`);
    allSeriesUrls.push(...links);
  }

  const uniqueUrls = [...new Set(allSeriesUrls)];
  console.log(`\nTotal: ${uniqueUrls.length} series. Scraping…\n`);

  const results = [];
  let done = 0;

  for (let i = 0; i < uniqueUrls.length; i += CONCURRENCY) {
    const chunk   = uniqueUrls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(u => scrapeSeries(u)));
    for (const r of settled)
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    done += chunk.length;
    const pct = Math.round((done / uniqueUrls.length) * 100);
    process.stdout.write(`\r  ${done}/${uniqueUrls.length} (${pct}%)  scraped=${results.length}  `);
  }

  console.log(`\n\nDone. ${results.length} series scraped.`);
  results.sort((a, b) => a.title.localeCompare(b.title));

  writeFileSync(OUT_FILE, JSON.stringify(results, null, 2), "utf8");
  console.log(`Written → ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
