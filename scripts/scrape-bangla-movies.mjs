/**
 * Scrapes Kolkata Bangla Movies from FTP
 * Usage: node scripts/scrape-bangla-movies.mjs
 */

import { writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, "../public/bangla-movies.json");
const BASE  = "http://172.16.50.7";
const PATH  = "/DHAKA-FLIX-7/Kolkata%20Bangla%20Movies/";
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
    const href     = hrefM[1];
    const url      = href.startsWith("http") ? href : BASE + href;
    const filename = decodeURIComponent(href.split("/").pop());
    const sizeMB   = sizeM ? Math.round(Number(sizeM[1]) / 1024) : 0;
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
  // "Title (2023) 1080p" or "Title (2023) 720p HDTS"
  const qualM  = raw.match(/\b(1080p|2160p|4K|720p|480p|540p)\b/i);
  const yearM  = raw.match(/\((\d{4})\)/);
  const quality = qualM ? qualM[1] : "720p";
  const year    = yearM ? yearM[1] : "";
  const title   = raw
    .replace(/\(\d{4}\)/g, "")
    .replace(/\b(1080p|2160p|4K|720p|480p|540p)\b/gi, "")
    .replace(/\b(HDTS|HDTV|HDCAM|WEB-DL|WEBRip|BluRay|DVDRip)\b/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, quality };
}

async function scrapeMovie(movieUrl) {
  const raw = decodeURIComponent(movieUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(raw);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");

  let html;
  try { html = await fetchText(movieUrl); }
  catch { return null; }

  const file = parseMovieFile(html);
  if (!file) return null;

  const imgs   = parseImages(html);
  const poster = imgs.find(u => u.includes("a_AL_")) || imgs[0] || "";
  const banner = imgs.find(u => u.includes("a_VL_")) || "";

  return { id, title, year, quality, genre: ["Bangla"], language: "Bengali", poster, banner, fileUrl: file.url, filename: file.filename, sizeMB: file.sizeMB };
}

async function main() {
  console.log("Scraping Kolkata Bangla Movies…");
  const rootHtml = await fetchText(BASE + PATH);
  const yearUrls = parseFolders(rootHtml, PATH);
  console.log(`${yearUrls.length} year folders found`);

  // collect all movie folder URLs from each year folder
  const movieUrls = [];
  for (const yearUrl of yearUrls) {
    try {
      const html = await fetchText(yearUrl);
      const yearPath = yearUrl.replace(BASE, "");
      const movies = parseFolders(html, yearPath);
      movieUrls.push(...movies);
    } catch { /* skip */ }
  }
  console.log(`${movieUrls.length} movie folders found`);

  const all = [];
  let done = 0;
  for (let i = 0; i < movieUrls.length; i += CONCURRENCY) {
    const chunk   = movieUrls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(u => scrapeMovie(u)));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) all.push(r.value);
    }
    done += chunk.length;
    process.stdout.write(`\r${done}/${movieUrls.length} (${Math.round(done / movieUrls.length * 100)}%)  `);
  }

  all.sort((a, b) => a.title.localeCompare(b.title));
  writeFileSync(OUT, JSON.stringify(all, null, 2), "utf8");
  console.log(`\nDone. ${all.length} movies → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
