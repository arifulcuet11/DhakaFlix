import { useState, useEffect, useCallback } from "react";

const STORAGE          = "dhakaflix_progress";
const DURATION_STORAGE = "dhakaflix_duration";
const WATCHED_AT       = "dhakaflix_watched_at";

function fmtTimeLeft(seconds) {
  if (!seconds || seconds <= 0) return null;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return "< 1m left";
}

function buildContinueWatching(koreanSeries, englishSeries) {
  let raw, durations, watchedAt;
  try {
    raw       = JSON.parse(localStorage.getItem(STORAGE)      || "{}");
    durations = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
    watchedAt = JSON.parse(localStorage.getItem(WATCHED_AT)   || "{}");
  } catch {
    return [];
  }

  const results = [];

  for (const [episodeUrl, seconds] of Object.entries(raw)) {
    // skip episodes never really started (< 10s, not a finished=0 entry)
    if (seconds !== 0 && seconds < 10) continue;

    const duration = durations[episodeUrl] || null;
    const isFinished = seconds === 0 || (duration && seconds / duration > 0.90);

    // search korean series
    let found = null;
    for (const series of koreanSeries) {
      for (const season of series.seasons || []) {
        for (const ep of season.episodes || []) {
          const builtUrl = season.folderUrl + encodeURIComponent(ep.filename);
          if (builtUrl === episodeUrl) {
            // if finished, find next episode
            let displayUrl    = episodeUrl;
            let displayEpNum  = ep.episode;
            let displaySeason = season.season;
            let displayFinished = isFinished;

            if (isFinished) {
              const nextEp = season.episodes.find(e => e.episode === ep.episode + 1);
              if (nextEp) {
                const nextUrl = season.folderUrl + encodeURIComponent(nextEp.filename);
                displayUrl    = nextUrl;
                displayEpNum  = nextEp.episode;
                displayFinished = false;
              } else {
                // try next season
                const allSeasons = series.seasons;
                const nextSeason = allSeasons.find(s => s.season === season.season + 1);
                if (nextSeason && nextSeason.episodes.length > 0) {
                  const firstEp = nextSeason.episodes[0];
                  displayUrl    = nextSeason.folderUrl + encodeURIComponent(firstEp.filename);
                  displayEpNum  = firstEp.episode;
                  displaySeason = nextSeason.season;
                  displayFinished = false;
                }
                // if no next season either, keep as finished
              }
            }

            const timeLeft = (!isFinished && duration)
              ? fmtTimeLeft(duration - seconds)
              : null;

            found = {
              seriesId: series.id,
              title: series.title,
              poster: series.tmdbPoster || series.poster,
              episodeUrl,       // original URL (for removal)
              displayUrl,       // URL to play
              episodeNum: displayEpNum,
              season: displaySeason,
              progress: seconds,
              duration,
              isFinished: displayFinished,
              timeLeft,
              watchedAt: watchedAt[episodeUrl] || 0,
              source: "korean",
            };
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    // search english series
    if (!found) {
      for (const series of englishSeries) {
        for (const season of series.seasons || []) {
          for (const ep of season.episodes || []) {
            const builtUrl = season.folderUrl + encodeURIComponent(ep.filename);
            if (builtUrl === episodeUrl) {
              let displayUrl    = episodeUrl;
              let displayEpNum  = ep.episode;
              let displaySeason = season.season;
              let displayFinished = isFinished;

              if (isFinished) {
                const nextEp = season.episodes.find(e => e.episode === ep.episode + 1);
                if (nextEp) {
                  displayUrl    = season.folderUrl + encodeURIComponent(nextEp.filename);
                  displayEpNum  = nextEp.episode;
                  displayFinished = false;
                } else {
                  const nextSeason = series.seasons.find(s => s.season === season.season + 1);
                  if (nextSeason && nextSeason.episodes.length > 0) {
                    const firstEp = nextSeason.episodes[0];
                    displayUrl    = nextSeason.folderUrl + encodeURIComponent(firstEp.filename);
                    displayEpNum  = firstEp.episode;
                    displaySeason = nextSeason.season;
                    displayFinished = false;
                  }
                }
              }

              const timeLeft = (!isFinished && duration)
                ? fmtTimeLeft(duration - seconds)
                : null;

              found = {
                seriesId: series.id,
                title: series.title,
                poster: series.tmdbPoster || series.poster,
                episodeUrl,
                displayUrl,
                episodeNum: displayEpNum,
                season: displaySeason,
                progress: seconds,
                duration,
                isFinished: displayFinished,
                timeLeft,
                watchedAt: watchedAt[episodeUrl] || 0,
                source: "english",
              };
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
    }

    if (found) results.push(found);
  }

  // One entry per series — keep most recently watched
  const bySeriesId = new Map();
  for (const item of results) {
    const existing = bySeriesId.get(item.seriesId);
    if (!existing || item.watchedAt > existing.watchedAt) {
      bySeriesId.set(item.seriesId, item);
    }
  }

  // Sort by most recently watched first
  return Array.from(bySeriesId.values())
    .sort((a, b) => b.watchedAt - a.watchedAt);
}

export function removeFromContinueWatching(episodeUrl) {
  try {
    const progress  = JSON.parse(localStorage.getItem(STORAGE)      || "{}");
    const durations = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
    const watched   = JSON.parse(localStorage.getItem(WATCHED_AT)   || "{}");
    delete progress[episodeUrl];
    delete durations[episodeUrl];
    delete watched[episodeUrl];
    localStorage.setItem(STORAGE,      JSON.stringify(progress));
    localStorage.setItem(DURATION_STORAGE, JSON.stringify(durations));
    localStorage.setItem(WATCHED_AT,   JSON.stringify(watched));
    window.dispatchEvent(new Event("dhakaflix_progress_updated"));
  } catch {}
}

export function useContinueWatching(koreanSeries, englishSeries) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!koreanSeries.length && !englishSeries.length) return;
    setItems(buildContinueWatching(koreanSeries, englishSeries));
  }, [koreanSeries, englishSeries]);

  useEffect(() => {
    function onUpdate() {
      setItems(buildContinueWatching(koreanSeries, englishSeries));
    }
    window.addEventListener("dhakaflix_progress_updated", onUpdate);
    return () => window.removeEventListener("dhakaflix_progress_updated", onUpdate);
  }, [koreanSeries, englishSeries]);

  const remove = useCallback((episodeUrl) => {
    removeFromContinueWatching(episodeUrl);
  }, []);

  return { items, remove };
}
