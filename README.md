# DhakaFlix

A Netflix-style streaming frontend for a local FTP media server. Built with React + Vite. Serves Korean dramas, movies, TV series, games, and software from `http://172.16.50.14/`.

---

## Features

- Cinematic hero banner with auto-advancing slides and dot indicators
- Poster-style card grid (2:3) with hover expand + genre/rating overlay
- Genre filter for Korean Drama (Drama, Comedy, Mystery, Crime, Action, Sci-Fi & Fantasy, Romance…)
- Top Rated and New Releases rows powered by TMDB metadata
- Series detail page with sticky poster panel and episode list
- Full in-browser video player: seek bar, volume, fullscreen, skip ±10s, speed selector, subtitles (SRT/VTT), Picture-in-Picture, cinematic mode, episode panel, resume from where you left off
- Idle video preview on series pages — plays a random episode clip after 5s of inactivity, cycles infinitely
- Watch progress badges (In Progress / Watched) saved to localStorage

---

## Tech Stack

- React 18 + Vite
- react-router-dom (client-side routing)
- No external UI libraries — all components hand-written
- Fonts: Bebas Neue, Inter, JetBrains Mono
- Deployed to GitHub Pages (`base: '/DhakaFlix/'`)

---

## Project Structure

```
src/
  components/
    Navbar.jsx / .css       — fixed top nav with search
    Hero.jsx / .css         — auto-sliding hero banner
    CategoryRow.jsx / .css  — horizontal scrollable card row
    SeriesBanner.jsx / .css — series detail banner with video preview
    VideoPlayer.jsx / .css  — full custom video player
  pages/
    Home.jsx / .css         — landing page with genre filter
    SeriesDetail.jsx / .css — series detail + episode list
    CategoryPage.jsx        — movies / TV / games / software pages
    Search.jsx              — live search across all content
  hooks/
    useKoreanSeries.js      — fetches + caches korean-series.json at runtime
  data/
    content.js              — static data for movies, TV, games, software
public/
  korean-series.json        — 767 Korean series, 13 742 episodes (3.6 MB, not bundled)
scripts/
  scrape-korean.mjs         — scrapes FTP server → generates korean-series.json
  enrich-tmdb.mjs           — enriches JSON with TMDB synopsis, genres, ratings
```

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173/DhakaFlix/
npm run build      # production build → dist/
```

---

## Data Pipeline

### 1. Scrape the FTP server

Parses the h5ai directory listing at `http://172.16.50.14/DHAKA-FLIX-14/KOREAN TV & WEB Series/`, extracts series folders, season folders, and episode filenames with sizes.

```bash
node scripts/scrape-korean.mjs
```

Output: `public/korean-series.json` — 767 series, ~3.6 MB.

Each series entry contains:

```json
{
  "id": "alchemy-of-souls-2022",
  "title": "Alchemy of Souls",
  "year": "2022",
  "quality": "1080p",
  "language": "Korean",
  "genre": ["Drama", "Sci-Fi & Fantasy", "Action", "Mystery"],
  "poster": "http://172.16.50.14/.../a_AL_.jpg",
  "banner": "http://172.16.50.14/.../a_VL_.jpg",
  "synopsis": "A powerful sorceress…",
  "rating": 8.6,
  "voteCount": 412,
  "tmdbId": 125164,
  "tmdbPoster": "https://image.tmdb.org/t/p/w500/...",
  "seasons": [
    {
      "season": 1,
      "folderUrl": "http://172.16.50.14/.../Season 1/",
      "episodes": [
        { "episode": 1, "filename": "…E01….mkv", "sizeMB": 1420, "finale": false }
      ]
    }
  ]
}
```

### 2. Enrich with TMDB metadata

Matches each series title+year against the [TMDB](https://www.themoviedb.org/) TV search API and writes back `synopsis`, `genre`, `rating`, `voteCount`, `tmdbId`, and `tmdbPoster`.

**Get a free API key:** [themoviedb.org/settings/api](https://www.themoviedb.org/settings/api) → Request an API key → Developer (personal use is free).

```bash
# First run — processes all series
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY

# After re-scraping — only processes new/unenriched series
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY

# Retry the ones that didn't match last time
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY --retry-failed

# Re-enrich everything from scratch
node scripts/enrich-tmdb.mjs --key YOUR_TMDB_KEY --force
```

Current match rate: **753/767 (98%)**.

Genre breakdown after enrichment:

| Genre | Count |
|---|---|
| Drama | 692 |
| Comedy | 317 |
| Mystery | 202 |
| Crime | 145 |
| Sci-Fi & Fantasy | 139 |
| Action | 104 |
| Family | 13 |
| War & Politics | 11 |
| Romance | 8 |

### 3. When to re-run

Re-run the scraper whenever new series are added to the FTP server, then run the enrichment script to pull TMDB data for the new entries only (already-enriched entries are skipped automatically).

---

## Video Playback

MKV files with H.264 video play natively in Chrome and Edge via the HTML `<video>` tag — no transcoding needed. The `crossOrigin` attribute is intentionally omitted to avoid CORS preflight errors from the FTP server.

Safari and Firefox have limited MKV support; use Chrome or Edge for best results.

---

## Design Tokens

| Token | Value |
|---|---|
| Ground | `#0D0F18` |
| Surface | `#13162A` |
| Accent (amber) | `#E8A020` |
| Accent 2 (blue) | `#4A6FA5` |
| Text | `#E8E6F0` |
| Muted | `#8A8AA8` |
| Display font | Bebas Neue |
| Body font | Inter |
| Mono font | JetBrains Mono |
