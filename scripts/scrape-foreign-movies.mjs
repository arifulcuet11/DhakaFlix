/**
 * Scrapes all Foreign Language Movies from the FTP server
 * Usage: node scripts/scrape-foreign-movies.mjs
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mergeAndWrite } from "./merge-enrichment.mjs";

const __dir    = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://172.16.50.7";
const CAT_PATH = "/DHAKA-FLIX-7/Foreign%20Language%20Movies/";
const OUT_FILE = resolve(__dir, "../public/foreign-movies.json");

const CONCURRENCY = 10;

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function parseFolders(html) {
  const re = /href="(\/DHAKA-FLIX-7\/[^"]+\/)"/g;
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!m[1].includes("/_h5ai/")) found.push(BASE_URL + m[1]);
  }
  return [...new Set(found)];
}

function parseMovieFile(html) {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const hrefM = /href="([^"]+\.mkv)"/i.exec(row[1]);
    const sizeM = /fb-s">(\d+)\s*KB/.exec(row[1]);
    if (!hrefM) continue;
    const href = hrefM[1];
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
    const url      = href.startsWith("http") ? href : BASE_URL + href;
    return { filename, sizeMB, url };
  }
  return null;
}

function parseImages(html) {
  const re = /href="([^"]+\.(jpg|jpeg|png))"/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes("/_h5ai/")) continue;
    const url = m[1].startsWith("http") ? m[1] : BASE_URL + m[1];
    imgs.push(url);
  }
  return imgs;
}

function parseFolderName(name) {
  const qualM  = name.match(/\b(720p|1080p|2160p|4K|480p)\b/i);
  const yearM  = name.match(/\((\d{4})\)/);
  const quality = qualM ? qualM[1] : "720p";
  const year    = yearM ? yearM[1] : "";
  let title = name
    .replace(/\(\d{4}\)/g, "")
    .replace(/\b(720p|1080p|2160p|4K|480p)\b/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, quality };
}

async function scrapeMovie(movieUrl, language) {
  const folderName = decodeURIComponent(movieUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(folderName);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");

  let html;
  try { html = await fetchText(movieUrl); }
  catch (e) { console.error(`  ✗ ${folderName}: ${e.message}`); return null; }

  const file = parseMovieFile(html);
  if (!file) return null;

  const imgs   = parseImages(html);
  const poster = imgs.find(u => u.includes("a_AL_")) || imgs[0] || "";

  return {
    id,
    title,
    year,
    quality,
    language,
    genre: [],
    poster,
    fileUrl: file.url,
    filename: file.filename,
    sizeMB: file.sizeMB,
  };
}

async function main() {
  console.log("Fetching language folders…");
  const listHtml = await fetchText(BASE_URL + CAT_PATH);
  const langFolders = parseFolders(listHtml).filter(u => {
    const seg = u.split("/").filter(Boolean).pop();
    return decodeURIComponent(seg) !== "Foreign Language Movies";
  });

  console.log(`Found ${langFolders.length} language folders.\n`);

  const allMovies = [];

  for (const langUrl of langFolders) {
    const language = decodeURIComponent(langUrl.split("/").filter(Boolean).pop())
      .replace(/ Language$/, "").replace(/ Movie(s)?$/, "").replace(/ Dubbing Movies$/, " Dubbed").trim();

    console.log(`\nScraping: ${language}`);
    let langHtml;
    try { langHtml = await fetchText(langUrl); }
    catch (e) { console.error(`  ✗ ${e.message}`); continue; }

    const movieUrls = parseFolders(langHtml);
    console.log(`  ${movieUrls.length} movies found`);

    let done = 0;
    for (let i = 0; i < movieUrls.length; i += CONCURRENCY) {
      const chunk = movieUrls.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(u => scrapeMovie(u, language)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) allMovies.push(r.value);
      }
      done += chunk.length;
      process.stdout.write(`\r  ${done}/${movieUrls.length} (${Math.round(done / movieUrls.length * 100)}%)  `);
    }
  }

  console.log(`\n\nDone. ${allMovies.length} movies scraped.`);
  allMovies.sort((a, b) => a.title.localeCompare(b.title));

  mergeAndWrite(OUT_FILE, allMovies);
  console.log(`Written → ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
