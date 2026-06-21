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
`src/main.jsx` → `src/App.jsx` — React Router with `basename={import.meta.env.BASE_URL}` (resolves to `/DhakaFlix/`). Four routes: `/` Home, `/:slug` CategoryPage, `/search` Search, `/series/:id` SeriesDetail.

### Data sources
Two types of content co-exist:

1. **Korean series** — fully scraped, enriched, and rich. `public/korean-series.json` (3.6 MB, 767 series, not bundled into JS). Fetched at runtime by `useKoreanSeries.js` which uses a module-level cache so all components share one fetch. Each entry has: `id`, `title`, `year`, `quality`, `genre[]`, `synopsis`, `rating`, `tmdbId`, `tmdbPoster` (w342), `tmdbBanner` (w1280), `seasons[].episodes[]` with `filename`, `sizeMB`, `finale`.

2. **Everything else** (movies, TV, games, software) — static links in `src/data/content.js`. These point directly to FTP URLs; there is no scraping or detail page for them.

### FTP server
Media lives on a LAN FTP at `http://172.16.50.14/` (and `.7`, `.8`, `.9`, `.12`). The server runs h5ai (directory listing). Video files are MKV with H.264. Do **not** add `crossOrigin` to `<video>` tags — the FTP server doesn't send CORS headers and this will break playback.

### Key component relationships
- `Home` → `Hero` (auto-sliding banner, uses `useKoreanSeries`) + `CategoryRow` (scrollable poster grid)
- `SeriesDetail` → `SeriesBanner` (idle video preview after 5s) + `VideoPlayer` (modal overlay) + episode list
- `VideoPlayer` is a fully custom player with no external library. It stores watch progress in `localStorage` under key `dhakaflix_progress` as `{ [episodeUrl]: seconds }`. Episode finished → saved as `0`.
- `SeriesBanner` manages idle detection via `document` event listeners; uses a hidden preload `<video>` element created on mount to buffer the first episode before preview starts.

### Image priority
- **Card posters**: `s.tmdbPoster || s.poster` — TMDB w342 first, FTP fallback
- **Hero backgrounds**: `s.tmdbBanner || s.banner` — TMDB w1280 first, FTP fallback
- **Side strip thumbs in Hero**: same `tmdbPoster` field

### Design tokens
Ground `#0D0F18`, surface `#13162A`, accent amber `#E8A020`, accent-2 blue `#4A6FA5`, text `#E8E6F0`, muted `#8A8AA8`. Fonts: Bebas Neue (display/titles), Inter (body), JetBrains Mono (badges/code). Defined in `src/index.css` as CSS custom properties.

### Scraper internals
`scripts/scrape-korean.mjs` — parses h5ai HTML with regex (no DOM parser). Detects episode numbers from filenames via `/[Ss]\d+[Ee](\d+)/`, `/[Ee][Pp]?\.?(\d+)/`, or 2–3 digit number between separators. Poster = `a_AL_.jpg`, banner = `a_VL_.jpg`. Runs 8 series in parallel, 4 seasons per series.

`scripts/enrich-tmdb.mjs` — cleans titles before searching (strips `[Dual Audio]`, `(TV Series 2023– )`, etc.), scores matches by name similarity + year proximity, retries without year if no match. Writes `tmdbId: null` on failure so `--retry-failed` can target only those. TMDB key: stored nowhere in the repo — pass via `--key` flag or `TMDB_KEY` env var.
