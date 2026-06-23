/**
 * Scrapes Documentary from FTP
 * Usage: node scripts/scrape-documentary.mjs
 */

import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { mergeAndWrite } from "./merge-enrichment.mjs";

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT   = resolve(__dir, "../public/documentary.json");
const BASE  = "http://172.16.50.9";
const PATH  = "/DHAKA-FLIX-9/Documentary/";
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
  // handles: "Title (TV Documentary 2021) 720p" or "Title (TV Documentary 2021– ) 720p"
  const qualM  = raw.match(/\b(720p|1080p|2160p|4K|480p|540p)\b/i);
  const yearM  = raw.match(/\((?:TV\s+Documentary\s+)?(\d{4})/i);
  const quality = qualM ? qualM[1] : "720p";
  const year    = yearM ? yearM[1] : "";
  const title   = raw
    .replace(/\(TV\s+Documentary[^)]*\)/gi, "")
    .replace(/\(\d{4}[^)]*\)/g, "")
    .replace(/\b(720p|1080p|2160p|4K|480p|540p)\b/gi, "")
    .replace(/\[.*?\]/g, "")
    .replace(/\bWEBRip\b/gi, "")
    .replace(/\bNF\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return { title, year, quality };
}

async function scrapeDoc(docUrl) {
  const raw = decodeURIComponent(docUrl.split("/").filter(Boolean).pop());
  const { title, year, quality } = parseFolderName(raw);
  const id = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + (year ? `-${year}` : "");

  let html;
  try { html = await fetchText(docUrl); }
  catch { return null; }

  const file = parseMovieFile(html);
  if (!file) return null;

  const imgs   = parseImages(html);
  const poster = imgs.find(u => u.includes("a_AL_")) || imgs[0] || "";

  return { id, title, year, quality, genre: ["Documentary"], poster, fileUrl: file.url, filename: file.filename, sizeMB: file.sizeMB };
}

async function main() {
  console.log("Scraping Documentary…");
  const listHtml = await fetchText(BASE + PATH);
  const docUrls  = parseFolders(listHtml, PATH);
  console.log(`${docUrls.length} documentaries found`);

  const all = [];
  let done = 0;
  for (let i = 0; i < docUrls.length; i += CONCURRENCY) {
    const chunk   = docUrls.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(chunk.map(u => scrapeDoc(u)));
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) all.push(r.value);
    }
    done += chunk.length;
    process.stdout.write(`\r${done}/${docUrls.length} (${Math.round(done / docUrls.length * 100)}%)  `);
  }

  all.sort((a, b) => a.title.localeCompare(b.title));
  mergeAndWrite(OUT, all);
  console.log(`\nDone. ${all.length} documentaries → ${OUT}`);
}

main().catch(e => { console.error(e); process.exit(1); });
