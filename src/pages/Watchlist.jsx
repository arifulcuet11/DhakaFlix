import { Link } from "react-router-dom";
import { useWatchlist } from "../hooks/useWatchlist";
import "../components/SeriesGrid.css";
import "./Watchlist.css";

export default function Watchlist() {
  const { list, remove } = useWatchlist();

  if (list.length === 0) {
    return (
      <div className="wl-root">
        <div className="wl-empty">
          <div className="wl-empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </div>
          <h1 className="wl-empty-title">Your list is empty</h1>
          <p className="wl-empty-sub">Browse content and tap the heart icon to save titles here.</p>
          <Link to="/" className="wl-empty-cta">Browse Content</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="wl-root">
      <div className="sg-header">
        <div className="sg-header-top">
          <div>
            <div className="sg-eyebrow">Saved</div>
            <h1 className="sg-title">My List</h1>
          </div>
        </div>
        <div className="sg-count">{list.length} {list.length === 1 ? "title" : "titles"} saved</div>
      </div>

      <div className="wl-grid">
        {list.map(item => {
          const poster = (item.poster || "").replace("/t/p/w500/", "/t/p/w342/");
          const route = item.seriesId
            ? (item.tvRoute ? `/tv/${item.seriesId}` : `/series/${item.seriesId}`)
            : null;

          const cardInner = (
            <>
              <div className="sg-card-thumb">
                <img
                  src={poster || undefined}
                  alt={item.title}
                  loading="lazy"
                  onError={e => { e.target.style.opacity = "0.2"; }}
                />
                {item.rating && <span className="sg-rating">&#9733; {item.rating}</span>}
                <button
                  className="wl-remove-btn"
                  onClick={e => { e.preventDefault(); e.stopPropagation(); remove(item.id); }}
                  aria-label="Remove from My List"
                  title="Remove from My List"
                >
                  ✕
                </button>
                <div className="sg-card-overlay">
                  <div className="sg-play">&#9654;</div>
                  <span className="sg-card-overlay-title">{item.title}</span>
                </div>
              </div>
              <div className="sg-card-body">
                <div className="sg-card-title">{item.title}</div>
                <div className="sg-card-meta">{item.genre?.slice(0, 2).join(" · ") || item.tag}</div>
              </div>
            </>
          );

          if (route) {
            return <Link key={item.id} to={route} className="sg-card">{cardInner}</Link>;
          }
          if (item.url) {
            return <a key={item.id} href={item.url} target="_blank" rel="noreferrer" className="sg-card">{cardInner}</a>;
          }
          return <div key={item.id} className="sg-card">{cardInner}</div>;
        })}
      </div>
    </div>
  );
}
