import { Link } from "react-router-dom";
import "./CategoryRow.css";

export default function CategoryRow({ title, items, seeAllUrl, tvRoute }) {
  const countMatch = title ? title.match(/\((\d+[^)]*)\)/) : null;
  const cleanTitle = countMatch ? title.replace(/\s*\([^)]*\)/, "").trim() : (title || "");
  const countLabel = countMatch ? countMatch[1] : null;
  const showHeader = cleanTitle.length > 0;

  return (
    <div className="row">
      {showHeader && (
        <div className="row-header">
          <h2 className="row-title">{cleanTitle}</h2>
          {countLabel && <span className="row-count">{countLabel}</span>}
          {seeAllUrl && (
            <Link to={seeAllUrl} className="row-see-all">See all ›</Link>
          )}
        </div>
      )}

      <div className="row-scroll">
        {items.map((item, i) => {
          // use w342 size for TMDB images (cards are small, loads faster than w500)
          const rawPoster = item.poster || "";
          const posterSrc = rawPoster
            ? rawPoster.replace("/t/p/w500/", "/t/p/w342/")
            : `https://picsum.photos/seed/${encodeURIComponent(item.title)}/300/450`;
          const qualityLabel = item.tag ? item.tag.split("·")[1]?.trim() : null;
          const yearLabel    = item.tag ? item.tag.split("·")[0]?.trim() : null;

          const genreLabel = item.genre?.slice(0, 2).join(" · ") || null;

          const inner = (
            <>
              <div className="card-thumb">
                <img
                  src={posterSrc}
                  alt={item.title}
                  loading="lazy"
                  onError={e => {
                    // if TMDB image fails try FTP poster, then placeholder
                    if (item.poster && e.target.src !== item.poster) {
                      e.target.src = item.poster;
                    } else {
                      e.target.style.opacity = "0.3";
                    }
                  }}
                />
                {qualityLabel && (
                  <span className="card-quality-badge">{qualityLabel}</span>
                )}
                {item.rating && (
                  <span className="card-rating-badge">&#9733; {item.rating}</span>
                )}
                {item.progressPct != null && (
                  <div className="card-progress-bar">
                    <div className="card-progress-fill" style={{ width: `${item.progressPct}%` }} />
                  </div>
                )}
                <div className="card-overlay">
                  <div className="card-play-btn">&#9654;</div>
                  {yearLabel && <span className="card-overlay-tag">{yearLabel}</span>}
                  <span className="card-overlay-title">{item.title}</span>
                </div>
              </div>
              <div className="card-body">
                <div className="card-title">{item.title}</div>
                <div className="card-meta">{genreLabel || yearLabel}</div>
              </div>
            </>
          );

          if (item.onPlay) {
            return (
              <div
                key={i}
                className="card"
                style={{ "--accent": "#E8A020", cursor: "pointer" }}
                onClick={item.onPlay}
              >
                {inner}
              </div>
            );
          }

          if (item.seriesId) {
            const route = (tvRoute || item.tvRoute)
              ? `/tv/${item.seriesId}`
              : `/series/${item.seriesId}`;
            return (
              <Link
                key={i}
                to={route}
                className="card"
                style={{ "--accent": "#E8A020" }}
              >
                {inner}
              </Link>
            );
          }

          return (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="card"
              style={{ "--accent": "#E8A020" }}
            >
              {inner}
            </a>
          );
        })}
      </div>
    </div>
  );
}
