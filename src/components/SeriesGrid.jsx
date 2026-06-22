import { useMemo, useState, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import PageBanner from "./PageBanner";
import { useWatchlist } from "../hooks/useWatchlist";
import "./SeriesGrid.css";

const SORT_OPTIONS = [
  { value: "rating",  label: "Top Rated" },
  { value: "new",     label: "Newest First" },
  { value: "az",      label: "A → Z" },
  { value: "za",      label: "Z → A" },
];

const PAGE_SIZE = 60;

export default function SeriesGrid({ series, loading, genres, title, routePrefix = "/series", showBanner = true }) {
  const { isInList, toggle } = useWatchlist();
  const [searchParams, setSearchParams] = useSearchParams();

  const initSort  = searchParams.get("sort")  || "rating";
  const initGenre = searchParams.get("genre") || "All";

  const [query,       setQuery]       = useState(searchParams.get("q") || "");
  const [activeGenre, setActiveGenre] = useState(initGenre);
  const [sort,        setSort]        = useState(initSort);
  const [page,        setPage]        = useState(1);

  const updateParam = useCallback((key, val) => {
    setSearchParams(p => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); return n; }, { replace: true });
  }, [setSearchParams]);

  function handleGenre(g) {
    setActiveGenre(g);
    setPage(1);
    updateParam("genre", g === "All" ? "" : g);
  }
  function handleSort(s) {
    setSort(s);
    setPage(1);
    updateParam("sort", s);
  }
  function handleSearch(e) {
    const v = e.target.value;
    setQuery(v);
    setPage(1);
    updateParam("q", v);
  }

  const filtered = useMemo(() => {
    let out = series;
    if (activeGenre !== "All") out = out.filter(s => s.genre?.some(g => g === activeGenre));
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(s => s.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case "rating": out = [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      case "new":    out = [...out].sort((a, b) => b.year.localeCompare(a.year)); break;
      case "az":     out = [...out].sort((a, b) => a.title.localeCompare(b.title)); break;
      case "za":     out = [...out].sort((a, b) => b.title.localeCompare(a.title)); break;
    }
    return out;
  }, [series, activeGenre, query, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const visible   = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = page < pageCount;

  return (
    <div className="sg-root">

      {showBanner && <PageBanner items={series} count={5} />}

      {/* ── HEADER ── */}
      <div className="sg-header">
        <div className="sg-header-top">
          <div>
            <div className="sg-eyebrow">Browse</div>
            <h1 className="sg-title">{title}</h1>
          </div>
          <div className="sg-search-wrap">
            <span className="sg-search-icon">&#128269;</span>
            <input
              className="sg-search"
              type="text"
              placeholder="Search title…"
              value={query}
              onChange={handleSearch}
            />
          </div>
        </div>

        {/* sort + genre filters */}
        <div className="sg-controls">
          <div className="sg-sort">
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                className={`sg-sort-btn${sort === o.value ? " active" : ""}`}
                onClick={() => handleSort(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          <div className="sg-genres">
            {["All", ...genres].map(g => (
              <button
                key={g}
                className={`sg-genre-btn${activeGenre === g ? " active" : ""}`}
                onClick={() => handleGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <div className="sg-count">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} series`}
          {(activeGenre !== "All" || query) && ` · filtered from ${series.length.toLocaleString()}`}
        </div>
      </div>

      {/* ── GRID ── */}
      {loading ? (
        <div className="sg-grid">
          {Array.from({ length: 24 }).map((_, i) => (
            <div key={i} className="sg-skeleton" />
          ))}
        </div>
      ) : (
        <>
          <div className="sg-grid">
            {visible.map((s) => {
              const poster = (s.tmdbPoster || s.poster || "")
                .replace("/t/p/w500/", "/t/p/w342/");
              const saved = isInList(s.id);
              const wlItem = { id: s.id, title: s.title, poster: s.tmdbPoster || s.poster, tag: `${s.year} · ${s.quality}`, genre: s.genre, rating: s.rating, seriesId: s.id, tvRoute: routePrefix === "/tv" };
              return (
                <Link
                  key={s.id}
                  to={`${routePrefix}/${s.id}`}
                  className="sg-card"
                >
                  <button
                    className={`sg-wl-btn${saved ? " sg-wl-btn--saved" : ""}`}
                    onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(wlItem); }}
                    aria-label={saved ? "Remove from My List" : "Add to My List"}
                  >
                    <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                  <div className="sg-card-thumb">
                    <img
                      src={poster || undefined}
                      alt={s.title}
                      loading="lazy"
                      onError={e => {
                        if (s.poster && e.target.src !== s.poster) {
                          e.target.src = s.poster;
                        } else {
                          e.target.style.opacity = "0.2";
                        }
                      }}
                    />
                    {s.rating && (
                      <span className="sg-rating">&#9733; {s.rating}</span>
                    )}
                    <div className="sg-card-overlay">
                      <div className="sg-play">&#9654;</div>
                      <span className="sg-card-overlay-title">{s.title}</span>
                    </div>
                  </div>
                  <div className="sg-card-body">
                    <div className="sg-card-title">{s.title}</div>
                    <div className="sg-card-meta">
                      {s.genre?.slice(0, 2).join(" · ") || s.year}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="sg-empty">
              No series found for "{query || activeGenre}"
            </div>
          )}

          {hasMore && (
            <div className="sg-load-more-wrap">
              <button className="sg-load-more" onClick={() => setPage(p => p + 1)}>
                Load more · {filtered.length - visible.length} remaining
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
