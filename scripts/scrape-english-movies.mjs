/**
 * Scrapes English Movies, English Movies (1080p), and IMDb Top-250
 * Usage: node scripts/scrape-english-movies.mjs
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mergeAndWrite } from "./merge-enrichment.mjs";

const __dir  = dirname(fileURLToPath(import.meta.url));
const OUT    = resolve(__dir, "../public/english-movies.json");

const SOURCES = [
  { base: "http://172.16.50.7",  path: "/DHAKA-FLIX-7/English%20Movies/",                  yearFolders: true,  imdb: false, label: "English Movies"       },
  { base: "http://172.16.50.14", path: "/DHAKA-FLIX-14/English%20Movies%20%281080p%29/",   yearFolders: true,  imdb: false, label: "English Movies 1080p"  },
  { base: "http://172.16.50.14", path: "/DHAKA-FLIX-14/IMDb%20Top-250%20Movies/",          yearFolders: false, imdb: true,  label: "IMDb Top 250"          },
];

const CONCURRENCY = 10;

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseFolders(html, basePath, base) {
  const re = new RegExp(`href="(${basePath}[^"]+/)"`, "g");
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!m[1].includes("/_h5ai/")) found.push(base + m[1]);
  }
  return [...new Set(found)];
}

function parseMovieFile(html, base) {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const hrefM = /href="([^"]+\.(?:mkv|mp4|avi))"/i.exec(row[1]);
    const sizeM = /fb-s">(\d+)\s*KB/.exec(row[1]);
    if (!hrefM) continue;
    const href     = hrefM[1];
    const url      = href.startsWith("http") ? href : base + href;
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
    return { filename, sizeMB, url };
  }
  return null;
}

function parseImages(html, base) {
  const re = /href="([^"]+\.(?:jpg|jpeg|png))"/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes("/_h5ai/")) continue;
    imgs.push(m[1].startsWith("http") ? m[1] : base + m[1]);
  }
  return imgs;
}

function parseFolderName(raw) {
  // strip IMDb rank prefix: "001. Title" → "Title"
  const name     = raw.replace(/^\d+\.\s*/, "");
  const qualM    = name.match(/\b(720p|1080p|2160p|4K|480p)\b/i);
  const yearM    = name.match(/\((\d{4})\)/);
  const quality  = qualM ? qualM[1] : "720p";
  const year     = yearM ? yearM[1] : "";
  const title    = name
    .replace(/\(\d{4}\)/g, "")
    .replace(/\b(720p|1080p|2160p|4K|480p)\b/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, quality };
}

function makeId(title, year) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");
}

async function scrapeMovie(movieUrl, base, source) {
  const raw = decodeURIComponent(movieUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(raw);
  const id = makeId(title, year);

  let html;
  try { html = await fetchText(movieUrl); }
  catch (e) { console.error(`  ✗ ${raw}: ${e.message}`); return null; }

  const file = parseMovieFile(html, base);
  if (!file) return null;

  const imgs   = parseImages(html, base);
  const poster = imgs.find(u => u.includes("a_AL_")) || imgs[0] || "";

  return { id, title, year, quality, genre: [], poster, fileUrl: file.url, filename: file.filename, sizeMB: file.sizeMB, source: source.label };
}

async function main() {
  const seen      = new Set(); // dedup by title+year
  const allMovies = [];

  for (const source of SOURCES) {
    console.log(`\n── ${source.label}`);
    const listHtml = await fetchText(source.base + source.path);

    let movieUrls = [];

    if (source.yearFolders) {
      const yearFolders = parseFolders(listHtml, source.path, source.base);
      console.log(`  ${yearFolders.length} year folders`);
      for (const yearUrl of yearFolders) {
        let yHtml;
        try { yHtml = await fetchText(yearUrl); }
        catch { continue; }
        const yPath = yearUrl.replace(source.base, "");
        movieUrls.push(...parseFolders(yHtml, yPath, source.base));
      }
    } else {
      // IMDb: movie folders directly in root
      movieUrls = parseFolders(listHtml, source.path, source.base);
    }

    // deduplicate: prefer 1080p over 720p for same title+year
    const fresh = movieUrls.filter(u => {
      const raw    = decodeURIComponent(u.split("/").filter(Boolean).pop()).replace(/^\d+\.\s*/, "");
      const yearM  = raw.match(/\((\d{4})\)/);
      const year   = yearM ? yearM[1] : "";
      const title  = raw.replace(/\(\d{4}\)/g, "").replace(/\b(720p|1080p|2160p|4K|480p)\b/gi, "").replace(/\[.*?\]/g, "").replace(/\s+/g, " ").trim();
      const key    = `${title.toLowerCase()}|${year}`;
      const is1080 = raw.includes("1080p");
      if (seen.has(key)) {
        // only replace if this is 1080p and existing was not
        if (is1080) seen.delete(key); else return false;
      }
      seen.add(key);
      return true;
    });

    console.log(`  ${fresh.length} movies to scrape`);

    let done = 0;
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      const chunk    = fresh.slice(i, i + CONCURRENCY);
      const settled  = await Promise.allSettled(chunk.map(u => scrapeMovie(u, source.base, source)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) allMovies.push(r.value);
      }
      done += chunk.length;
      process.stdout.write(`\r  ${done}/${fresh.length} (${Math.round(done / fresh.length * 100)}%)  `);
    }
    console.log();
  }

  // final dedup by id keeping first occurrence
  const idSeen = new Set();
  const deduped = allMovies.filter(m => {
    if (idSeen.has(m.id)) return false;
    idSeen.add(m.id);
    return true;
  });

  deduped.sort((a, b) => a.title.localeCompare(b.title));
  mergeAndWrite(OUT, deduped);
  console.log(`\nDone. ${deduped.length} English movies → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
