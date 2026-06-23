# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev        # start dev server → http://localhost:5173/DhakaFlix/
npm run build      # production build → dist/
npm run lint       # ESLint
npm run preview    # serve the dist/ build locally
npm run deploy     # build + push to GitHub Pages (gh-pages -d dist)
```

**Data pipeline** (run from project root, not src/):
```bash
# 1. Scrape FTP server → public/korean-series.json
node scripts/scrape-korean.mjs

# 2. Enrich with TMDB metadata (synopsis, genres, ratings, poster/banner images)
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY          # new series only
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY --retry-failed  # retry nulls
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY --force         # re-enrich all
```

## Architecture

### Routing
`src/main.jsx` → `src/App.jsx` — React Router with `basename={import.meta.env.BASE_URL}` (resolves to `/DhakaFlix/`). Routes: `/` Home, `/:slug` CategoryPage, `/search` Search, `/series/:id` SeriesDetail (Korean), `/tv/:id` SeriesDetail (English), plus explicit paths for each content type (`/tvseries`, `/korean`, `/foreign-movies`, etc.).

### Data sources
Three tiers of content co-exist:

1. **Scraped JSON series** (Korean + English TV + several movie categories) — `public/*.json` files, not bundled into JS. Each has a matching `useXxx.js` hook in `src/hooks/` that uses a module-level singleton cache (`let cache = null; let promise = null`) so all components share one fetch per file. The Korean data (`korean-series.json`, ~3.6 MB) is the richest: `id`, `title`, `year`, `quality`, `genre[]`, `synopsis`, `rating`, `tmdbId`, `tmdbPoster` (w342), `tmdbBanner` (w1280), `seasons[].episodes[]` with `filename`, `sizeMB`, `finale`. English TV (`english-tv.json`) follows the same shape.

2. **Static FTP links** — `src/data/content.js`. Categories of movies, games, and software point directly to FTP directory URLs. No detail page or scraping for these.

3. **Watchlist & watch progress** — pure `localStorage`. Watchlist key: `dhakaflix_watchlist` (array of series objects). Progress key: `dhakaflix_progress` (`{ [episodeUrl]: seconds }`; `0` = finished). Duration key: `dhakaflix_duration`. `useWatchlist.js` uses a module-level `Set` of listeners so all hook instances stay in sync without a context provider.

### FTP server
Media lives on a LAN FTP at `http://172.16.50.14/` (and `.7`, `.8`, `.9`, `.12`). The server runs h5ai (directory listing). Video files are MKV with H.264. Do **not** add `crossOrigin` to `<video>` tags — the FTP server doesn't send CORS headers and this will break playback.

### Local proxy / server status
`useServerStatus.js` pings `http://localhost:3001/ping` every 15 s to detect whether the local proxy is running. `PROXY_URL` is exported from the same file. The proxy is a separate process not in this repo.

### Key component relationships
- `Home` → `Hero` (auto-sliding banner, uses `useKoreanSeries`) + `CategoryRow` (scrollable poster grid)
- `SeriesDetail` → `SeriesBanner` (idle video preview after 5s) + `VideoPlayer` (modal overlay) + episode list
- `VideoPlayer` is fully custom (no library). Subtitles are fetched from OpenSubtitles.com v1 API (key hardcoded as `OS_API_KEY`; subtitle text is cached in `localStorage` under `dhakaflix_sub_cache`, max 50 entries). Progress is saved on `timeupdate` and on close.
- `SeriesBanner` manages idle detection via `document` event listeners; uses a hidden preload `<video>` element created on mount to buffer the first episode before preview starts.
- `useContinueWatching` scans `dhakaflix_progress` against both Korean and English series data to surface in-progress episodes; reacts to `dhakaflix_progress_updated` window events.

### Image priority
- **Card posters**: `s.tmdbPoster || s.poster` — TMDB w342 first, FTP fallback
- **Hero backgrounds**: `s.tmdbBanner || s.banner` — TMDB w1280 first, FTP fallback

### Design tokens
Ground `#0D0F18`, surface `#13162A`, accent amber `#E8A020`, accent-2 blue `#4A6FA5`, text `#E8E6F0`, muted `#8A8AA8`. Fonts: Bebas Neue (display/titles), Inter (body), JetBrains Mono (badges/code). Defined in `src/index.css` as CSS custom properties.

### PWA
`public/sw.js` is a hand-written service worker; `public/manifest.json` enables install-to-homescreen. The 404.html is a SPA redirect shim for GitHub Pages.

### Scraper internals
Each content category has its own `scripts/scrape-*.mjs`. All parse h5ai HTML with regex (no DOM parser). Korean scraper detects episode numbers from filenames via `/[Ss]\d+[Ee](\d+)/`, `/[Ee][Pp]?\.?(\d+)/`, or 2–3 digit number between separators. Poster = `a_AL_.jpg`, banner = `a_VL_.jpg`. Runs 8 series in parallel, 4 seasons per series.

`scripts/enrich-tmdb.mjs` handles all scraped JSON files: cleans titles before searching (strips `[Dual Audio]`, `(TV Series 2023– )`, etc.), scores matches by name similarity + year proximity, retries without year if no match. Writes `tmdbId: null` on failure so `--retry-failed` can target only those. TMDB key: stored nowhere in the repo — pass via `--key` flag or `TMDB_KEY` env var.
