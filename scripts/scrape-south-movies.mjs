/**
 * Scrapes Hindi Movies, South Indian Movies (Hindi Dubbed), South Indian Movies
 * Usage: node scripts/scrape-south-movies.mjs
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, "../public/south-movies.json");
const BASE  = "http://172.16.50.14";

const SOURCES = [
  { path: "/DHAKA-FLIX-14/Hindi%20Movies/",                              label: "Hindi Movies"          },
  { path: "/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/Hindi%20Dubbed/",     label: "South Hindi Dubbed"    },
  { path: "/DHAKA-FLIX-14/SOUTH%20INDIAN%20MOVIES/South%20Movies/",     label: "South Indian Movies"   },
];

const CONCURRENCY = 10;

async function fetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

function parseFolders(html, basePath) {
  const re = new RegExp(`href="(${basePath}[^"]+/)"`, "g");
  const found = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!m[1].includes("/_h5ai/")) found.push(BASE + m[1]);
  }
  return [...new Set(found)];
}

function parseMovieFile(html) {
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/g;
  let row;
  while ((row = rowRe.exec(html)) !== null) {
    const hrefM = /href="([^"]+\.(?:mkv|mp4|avi))"/i.exec(row[1]);
    const sizeM = /fb-s">(\d+)\s*KB/.exec(row[1]);
    if (!hrefM) continue;
    const href    = hrefM[1];
    const url     = href.startsWith("http") ? href : BASE + href;
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB  = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
    return { filename, sizeMB, url };
  }
  return null;
}

function parseImages(html) {
  const re = /href="([^"]+\.(?:jpg|jpeg|png))"/gi;
  const imgs = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    if (m[1].includes("/_h5ai/")) continue;
    imgs.push(m[1].startsWith("http") ? m[1] : BASE + m[1]);
  }
  return imgs;
}

function parseFolderName(raw) {
  const qualM  = raw.match(/\b(720p|1080p|2160p|4K|480p)\b/i);
  const yearM  = raw.match(/\((\d{4})\)/) || raw.match(/\b((?:19|20)\d{2})\b/);
  const quality = qualM ? qualM[1] : "720p";
  const year    = yearM ? yearM[1] : "";
  const title   = raw
    .replace(/\(\d{4}\)/g, "")
    .replace(/\b(720p|1080p|2160p|4K|480p)\b/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, quality };
}

async function scrapeMovie(movieUrl, label) {
  const raw = decodeURIComponent(movieUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(raw);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");

  let html;
  try { html = await fetchText(movieUrl); }
  catch (e) { return null; }

  const file = parseMovieFile(html);
  if (!file) return null;

  const imgs   = parseImages(html);
  const poster = imgs.find(u => u.includes("a_AL_")) || imgs[0] || "";

  return { id, title, year, quality, genre: [], poster, fileUrl: file.url, filename: file.filename, sizeMB: file.sizeMB, source: label };
}

async function main() {
  const seen      = new Set();
  const allMovies = [];

  for (const source of SOURCES) {
    console.log(`\n── ${source.label}`);
    const listHtml = await fetchText(BASE + source.path);
    const yearFolders = parseFolders(listHtml, source.path);
    console.log(`  ${yearFolders.length} year folders`);

    let movieUrls = [];
    for (const yearUrl of yearFolders) {
      let yHtml;
      try { yHtml = await fetchText(yearUrl); }
      catch { continue; }
      const yPath = yearUrl.replace(BASE, "");
      movieUrls.push(...parseFolders(yHtml, yPath));
    }

    const fresh = movieUrls.filter(u => {
      const key = decodeURIComponent(u.split("/").filter(Boolean).pop()).toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    console.log(`  ${fresh.length} movies to scrape`);
    let done = 0;
    for (let i = 0; i < fresh.length; i += CONCURRENCY) {
      const chunk = fresh.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(chunk.map(u => scrapeMovie(u, source.label)));
      for (const r of settled) {
        if (r.status === "fulfilled" && r.value) allMovies.push(r.value);
      }
      done += chunk.length;
      process.stdout.write(`\r  ${done}/${fresh.length} (${Math.round(done / fresh.length * 100)}%)  `);
    }
    console.log();
  }

  // final dedup by id
  const idSeen = new Set();
  const deduped = allMovies.filter(m => {
    if (idSeen.has(m.id)) return false;
    idSeen.add(m.id);
    return true;
  });

  deduped.sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(OUT, JSON.stringify(deduped, null, 2), "utf8");
  console.log(`\nDone. ${deduped.length} movies → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
