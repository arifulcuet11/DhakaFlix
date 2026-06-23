import { Link } from "react-router-dom";
import { useWatchlist } from "../hooks/useWatchlist";
import { useScrollReveal } from "../hooks/useScrollReveal";
import "./CategoryRow.css";

export default function CategoryRow({ title, items, seeAllUrl, tvRoute }) {
  const { isInList, toggle } = useWatchlist();
  const revealRef = useScrollReveal();
  const countMatch = title ? title.match(/\((\d+[^)]*)\)/) : null;
  const cleanTitle = countMatch ? title.replace(/\s*\([^)]*\)/, "").trim() : (title || "");
  const countLabel = countMatch ? countMatch[1] : null;
  const showHeader = cleanTitle.length > 0;

  return (
    <div ref={revealRef} className="row reveal">
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
          const isNew = yearLabel && parseInt(yearLabel) >= 2024;

          const wlId = item.seriesId || item.title;
          const wlItem = {
            id: wlId,
            title: item.title,
            poster: item.poster,
            tag: item.tag,
            genre: item.genre,
            rating: item.rating,
            seriesId: item.seriesId || null,
            tvRoute: tvRoute || item.tvRoute || false,
            url: item.url || null,
            onPlay: item.onPlay ? "__has_play__" : null,
          };
          const saved = isInList(wlId);

          function handleWlClick(e) {
            e.preventDefault();
            e.stopPropagation();
            toggle(wlItem);
          }

          function handleRemoveClick(e) {
            e.preventDefault();
            e.stopPropagation();
            item.onRemove();
          }

          const cardInner = (
            <>
              <div className="card-thumb">
                {item.isFinished && <span className="card-next-badge">NEXT</span>}
                {!item.isFinished && isNew && <span className="card-new-badge">NEW</span>}
                <img
                  src={posterSrc}
                  alt={item.title}
                  loading="lazy"
                  onError={e => {
                    if (item.poster && e.target.src !== item.poster) {
                      e.target.src = item.poster;
                    } else {
                      e.target.style.opacity = "0.2";
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
                <div className="card-meta">
                  {item.timeLeft
                    ? <span className="card-time-left">{item.timeLeft}</span>
                    : (genreLabel || yearLabel)
                  }
                </div>
              </div>
            </>
          );

          // Action button (heart or remove) rendered as sibling outside the anchor
          const actionBtn = item.onRemove ? (
            <button
              className="card-remove-btn"
              onClick={handleRemoveClick}
              aria-label="Remove from Continue Watching"
              title="Remove"
            >✕</button>
          ) : (
            <button
              className={`card-wl-btn${saved ? " card-wl-btn--saved" : ""}`}
              onClick={handleWlClick}
              aria-label={saved ? "Remove from My List" : "Add to My List"}
            >
              <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          );

          if (item.onPlay) {
            return (
              <div
                key={i}
                className="card"
                style={{ "--accent": "#E8A020", cursor: "pointer" }}
                onClick={item.onPlay}
              >
                {actionBtn}
                {cardInner}
              </div>
            );
          }

          if (item.seriesId) {
            const route = (tvRoute || item.tvRoute)
              ? `/tv/${item.seriesId}`
              : `/series/${item.seriesId}`;
            return (
              <div key={i} className="card" style={{ "--accent": "#E8A020" }}>
                {actionBtn}
                <Link to={route} className="card-link">
                  {cardInner}
                </Link>
              </div>
            );
          }

          return (
            <div key={i} className="card" style={{ "--accent": "#E8A020" }}>
              {actionBtn}
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="card-link"
              >
                {cardInner}
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
