import { useState, useEffect, useCallback, useRef } from "react";

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

function searchSeries(seriesList, episodeUrl, seconds, duration, isFinished, watchedAt, source) {
  for (const series of seriesList) {
    for (const season of series.seasons || []) {
      for (const ep of season.episodes || []) {
        const builtUrl = season.folderUrl + encodeURIComponent(ep.filename);
        if (builtUrl !== episodeUrl) continue;

        let displayUrl     = episodeUrl;
        let displayEpNum   = ep.episode;
        let displaySeason  = season.season;
        let displayFinished = isFinished;

        if (isFinished) {
          const nextEp = season.episodes.find(e => e.episode === ep.episode + 1);
          if (nextEp) {
            displayUrl      = season.folderUrl + encodeURIComponent(nextEp.filename);
            displayEpNum    = nextEp.episode;
            displayFinished = false;
          } else {
            const nextSeason = series.seasons.find(s => s.season === season.season + 1);
            if (nextSeason && nextSeason.episodes.length > 0) {
              const firstEp   = nextSeason.episodes[0];
              displayUrl      = nextSeason.folderUrl + encodeURIComponent(firstEp.filename);
              displayEpNum    = firstEp.episode;
              displaySeason   = nextSeason.season;
              displayFinished = false;
            }
          }
        }

        return {
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
          timeLeft: (!displayFinished && duration) ? fmtTimeLeft(duration - seconds) : null,
          watchedAt: watchedAt[episodeUrl] || 0,
          source,
        };
      }
    }
  }
  return null;
}

function searchMovies(movieList, url, seconds, duration, isFinished, watchedAt, source) {
  for (const movie of movieList) {
    if (movie.fileUrl !== url) continue;
    return {
      seriesId: movie.id,
      title: movie.title,
      poster: movie.tmdbPoster || movie.poster,
      episodeUrl: url,
      displayUrl: url,
      episodeNum: null,
      season: null,
      progress: seconds,
      duration,
      isFinished,
      timeLeft: (!isFinished && duration) ? fmtTimeLeft(duration - seconds) : null,
      watchedAt: watchedAt[url] || 0,
      source,
    };
  }
  return null;
}

function buildContinueWatching(koreanSeries, englishSeries, englishMovies, banglaMovies, foreignMovies, animationMovies, southMovies, documentaries) {
  let raw, durations, watchedAt;
  try {
    raw       = JSON.parse(localStorage.getItem(STORAGE)          || "{}");
    durations = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
    watchedAt = JSON.parse(localStorage.getItem(WATCHED_AT)       || "{}");
  } catch {
    return [];
  }

  const results = [];

  for (const [url, seconds] of Object.entries(raw)) {
    if (seconds !== 0 && seconds < 10) continue;

    const duration   = durations[url] || null;
    const isFinished = seconds === 0 || (duration && seconds / duration > 0.90);

    const found =
      searchSeries(koreanSeries,  url, seconds, duration, isFinished, watchedAt, "korean")  ||
      searchSeries(englishSeries, url, seconds, duration, isFinished, watchedAt, "english") ||
      searchMovies(englishMovies,    url, seconds, duration, isFinished, watchedAt, "english-movie")   ||
      searchMovies(banglaMovies,     url, seconds, duration, isFinished, watchedAt, "bangla-movie")    ||
      searchMovies(foreignMovies,    url, seconds, duration, isFinished, watchedAt, "foreign-movie")   ||
      searchMovies(animationMovies,  url, seconds, duration, isFinished, watchedAt, "animation-movie") ||
      searchMovies(southMovies,      url, seconds, duration, isFinished, watchedAt, "south-movie")     ||
      searchMovies(documentaries,    url, seconds, duration, isFinished, watchedAt, "documentary");

    if (found) results.push(found);
  }

  // One entry per item — keep most recently watched
  const byId = new Map();
  for (const item of results) {
    const existing = byId.get(item.seriesId);
    if (!existing || item.watchedAt > existing.watchedAt) {
      byId.set(item.seriesId, item);
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.watchedAt - a.watchedAt);
}

export function removeFromContinueWatching(episodeUrl) {
  try {
    const progress  = JSON.parse(localStorage.getItem(STORAGE)          || "{}");
    const durations = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
    const watched   = JSON.parse(localStorage.getItem(WATCHED_AT)       || "{}");
    delete progress[episodeUrl];
    delete durations[episodeUrl];
    delete watched[episodeUrl];
    localStorage.setItem(STORAGE,          JSON.stringify(progress));
    localStorage.setItem(DURATION_STORAGE, JSON.stringify(durations));
    localStorage.setItem(WATCHED_AT,       JSON.stringify(watched));
    window.dispatchEvent(new Event("dhakaflix_progress_updated"));
  } catch {}
}

export function useContinueWatching(koreanSeries, englishSeries, englishMovies, banglaMovies, foreignMovies, animationMovies, southMovies, documentaries) {
  const [items, setItems] = useState([]);
  const dataRef = useRef({});

  useEffect(() => {
    dataRef.current = { koreanSeries, englishSeries, englishMovies, banglaMovies, foreignMovies, animationMovies, southMovies, documentaries };
  });

  useEffect(() => {
    const allEmpty = !koreanSeries.length && !englishSeries.length && !englishMovies.length &&
      !banglaMovies.length && !foreignMovies.length && !animationMovies.length &&
      !southMovies.length && !documentaries.length;
    if (allEmpty) return;
    setItems(buildContinueWatching(koreanSeries, englishSeries, englishMovies, banglaMovies, foreignMovies, animationMovies, southMovies, documentaries));
  }, [koreanSeries, englishSeries, englishMovies, banglaMovies, foreignMovies, animationMovies, southMovies, documentaries]);

  useEffect(() => {
    function onUpdate() {
      const d = dataRef.current;
      setItems(buildContinueWatching(d.koreanSeries, d.englishSeries, d.englishMovies, d.banglaMovies, d.foreignMovies, d.animationMovies, d.southMovies, d.documentaries));
    }
    window.addEventListener("dhakaflix_progress_updated", onUpdate);
    return () => window.removeEventListener("dhakaflix_progress_updated", onUpdate);
  }, []);

  const remove = useCallback((episodeUrl) => {
    removeFromContinueWatching(episodeUrl);
  }, []);

  return { items, remove };
}
