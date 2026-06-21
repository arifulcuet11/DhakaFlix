import { useState, useEffect } from "react";

const STORAGE          = "dhakaflix_progress";
const DURATION_STORAGE = "dhakaflix_duration";

function buildContinueWatching(koreanSeries, englishSeries) {
  let raw, durations;
  try {
    raw       = JSON.parse(localStorage.getItem(STORAGE)          || "{}");
    durations = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
  } catch {
    return [];
  }

  const results = [];

  for (const [episodeUrl, seconds] of Object.entries(raw)) {
    // skip finished (0) and tiny progress (≤ 30s)
    if (!seconds || seconds <= 30) continue;

    // search korean series
    let found = null;
    for (const series of koreanSeries) {
      for (const season of series.seasons || []) {
        for (const ep of season.episodes || []) {
          if (ep.url === episodeUrl) {
            found = {
              seriesId: series.id,
              title: series.title,
              poster: series.tmdbPoster || series.poster,
              episodeUrl,
              episodeNum: ep.episode,
              season: season.season,
              progress: seconds,
              duration: durations[episodeUrl] || null,
              source: "korean",
            };
            break;
          }
        }
        if (found) break;
      }
      if (found) break;
    }

    // search english series if not found in korean
    if (!found) {
      for (const series of englishSeries) {
        for (const season of series.seasons || []) {
          for (const ep of season.episodes || []) {
            if (ep.url === episodeUrl) {
              found = {
                seriesId: series.id,
                title: series.title,
                poster: series.tmdbPoster || series.poster,
                episodeUrl,
                episodeNum: ep.episode,
                season: season.season,
                progress: seconds,
                duration: durations[episodeUrl] || null,
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

  return results;
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

  return items;
}
