import "./SeriesBanner.css";

export default function SeriesBanner({ series, totalEpisodes }) {
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
