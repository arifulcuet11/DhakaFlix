/**
 * Scrapes Animation Movies + Animation Movies (1080p) from FTP
 * Usage: node scripts/scrape-animation-movies.mjs
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mergeAndWrite } from "./merge-enrichment.mjs";

const __dir    = dirname(fileURLToPath(import.meta.url));
const BASE_URL = "http://172.16.50.14";
const OUT_FILE = resolve(__dir, "../public/animation-movies.json");

const SOURCES = [
  { path: "/DHAKA-FLIX-14/Animation%20Movies/",          yearFolders: true  },
  { path: "/DHAKA-FLIX-14/Animation%20Movies%20%281080p%29/", yearFolders: false },
];

const CONCURRENCY = 10;

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

function parseFolders(html, basePath) {
  const re = new RegExp(`href="(${basePath}[^"]+/)"`, "g");
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
    const href     = hrefM[1];
    const url      = href.startsWith("http") ? href : BASE_URL + href;
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
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
    imgs.push(m[1].startsWith("http") ? m[1] : BASE_URL + m[1]);
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

async function scrapeMovie(movieUrl) {
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

  return { id, title, year, quality, genre: [], poster, fileUrl: file.url, filename: file.filename, sizeMB: file.sizeMB };
}

async function main() {
  const seen = new Set();
  const allMovies = [];

  for (const source of SOURCES) {
    console.log(`\nScraping: ${decodeURIComponent(source.path)}`);
    const listHtml = await fetchText(BASE_URL + source.path);

    let movieUrls = [];

    if (source.yearFolders) {
      // year subfolders → movie folders inside each
      const yearFolders = parseFolders(listHtml, source.path);
      console.log(`  ${yearFolders.length} year folders`);
      for (const yearUrl of yearFolders) {
        let yearHtml;
        try { yearHtml = await fetchText(yearUrl); }
        catch (e) { continue; }
        const yearPath = yearUrl.replace(BASE_URL, "");
        movieUrls.push(...parseFolders(yearHtml, yearPath));
      }
    } else {
      // movie folders directly
      movieUrls = parseFolders(listHtml, source.path);
    }

    // deduplicate by folder name
    const fresh = movieUrls.filter(u => {
      const key = decodeURIComponent(u.split("/").filter(Boolean).pop());
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`  ${fresh.length} movies to scrape`);
    let done = 0;
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      const chunk = fresh.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(u => scrapeMovie(u)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) allMovies.push(r.value);
      }
      done += chunk.length;
      process.stdout.write(`\r  ${done}/${fresh.length} (${Math.round(done / fresh.length * 100)}%)  `);
    }
  }

  console.log(`\n\nDone. ${allMovies.length} animation movies scraped.`);
  allMovies.sort((a, b) => a.title.localeCompare(b.title));

  mergeAndWrite(OUT_FILE, allMovies);
  console.log(`Written → ${OUT_FILE}`);
}

main().catch(e => { console.error(e); process.exit(1); });
