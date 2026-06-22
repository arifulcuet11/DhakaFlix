import { useWatchlist } from "../hooks/useWatchlist";
import "./SeriesBanner.css";

export default function SeriesBanner({ series, totalEpisodes, onPlayFirst }) {
  const { isInList, toggle } = useWatchlist();
  const saved = isInList(series.id);

  const wlItem = {
    id: series.id,
    title: series.title,
    poster: series.tmdbPoster || series.poster,
    tag: `${series.year} · ${series.quality}`,
    genre: series.genre,
    rating: series.rating,
    seriesId: series.id,
    tvRoute: false,
  };
  const bannerUrl = series.tmdbBanner || series.banner || series.poster || "";

  function avgMB() {
    const all = series.seasons.flatMap(s => s.episodes);
    if (!all.length) return null;
    return (all.reduce((n, e) => n + e.sizeMB, 0) / all.length / 1024).toFixed(0);
  }

  return (
    <div className="sb-root">

      <div className="sb-bg" style={{ backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined }} />

      <div className="sb-grad-left" />
      <div className="sb-grad-bottom" />

      <div className="sb-content">
        <div className="sb-eyebrow">
          {series.genre.map(g => <span key={g} className="sb-tag">{g}</span>)}
          <span className="sb-tag sb-tag-outline">{series.year}</span>
          <span className="sb-tag sb-tag-outline">{series.quality}</span>
        </div>
        <h1 className="sb-title">{series.title}</h1>
        {series.synopsis && <p className="sb-synopsis">{series.synopsis}</p>}
        <div className="sb-actions">
          {onPlayFirst && (
            <button className="sb-play-btn" onClick={onPlayFirst}>
              &#9654; Watch Now
            </button>
          )}
          <button
            className={`sb-wl-btn${saved ? " sb-wl-btn--saved" : ""}`}
            onClick={() => toggle(wlItem)}
          >
            <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {saved ? "Saved" : "My List"}
          </button>
        </div>
        <div className="sb-stats">
          <div className="sb-stat">
            <span className="sb-stat-val">{totalEpisodes}</span>
            <span className="sb-stat-label">Episodes</span>
          </div>
          <div className="sb-stat-div" />
          <div className="sb-stat">
            <span className="sb-stat-val">{series.year}</span>
            <span className="sb-stat-label">Year</span>
          </div>
          {avgMB() && <>
            <div className="sb-stat-div" />
            <div className="sb-stat">
              <span className="sb-stat-val">~{avgMB()}</span>
              <span className="sb-stat-label">MB / EP</span>
            </div>
          </>}
          <div className="sb-stat-div" />
          <div className="sb-stat">
            <span className="sb-stat-val">{series.language}</span>
            <span className="sb-stat-label">Language</span>
          </div>
        </div>
      </div>

    </div>
  );
}
