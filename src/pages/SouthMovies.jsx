import { useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useSouthMovies } from "../hooks/useSouthMovies";
import VideoPlayer from "../components/VideoPlayer";
import "../components/SeriesGrid.css";

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "new",    label: "Newest" },
  { value: "az",     label: "A → Z" },
  { value: "za",     label: "Z → A" },
];

const SOURCES = ["All", "Hindi Movies", "South Hindi Dubbed", "South Indian Movies"];
const PAGE_SIZE = 60;

export default function SouthMovies() {
  const { movies, loading } = useSouthMovies();
  const [searchParams, setSearchParams] = useSearchParams();

  const [query,        setQuery]        = useState(searchParams.get("q") || "");
  const [activeSource, setActiveSource] = useState(searchParams.get("source") || "All");
  const [sort,         setSort]         = useState(searchParams.get("sort") || "rating");
  const [page,         setPage]         = useState(1);
  const [playing,      setPlaying]      = useState(null);

  const updateParam = useCallback((key, val) => {
    setSearchParams(p => { const n = new URLSearchParams(p); val ? n.set(key, val) : n.delete(key); return n; }, { replace: true });
  }, [setSearchParams]);

  function handleSource(s) { setActiveSource(s); setPage(1); updateParam("source", s === "All" ? "" : s); }
  function handleSort(s)   { setSort(s);         setPage(1); updateParam("sort", s); }
  function handleSearch(e) { const v = e.target.value; setQuery(v); setPage(1); updateParam("q", v); }

  const filtered = useMemo(() => {
    let out = movies;
    if (activeSource !== "All") out = out.filter(m => m.source === activeSource);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter(m => m.title.toLowerCase().includes(q));
    }
    switch (sort) {
      case "rating": out = [...out].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); break;
      case "new":    out = [...out].sort((a, b) => (b.year || "").localeCompare(a.year || "")); break;
      case "az":     out = [...out].sort((a, b) => a.title.localeCompare(b.title)); break;
      case "za":     out = [...out].sort((a, b) => b.title.localeCompare(a.title)); break;
    }
    return out;
  }, [movies, activeSource, query, sort]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page < Math.ceil(filtered.length / PAGE_SIZE);

  const SOURCE_LABELS = {
    "Hindi Movies":       "Hindi",
    "South Hindi Dubbed": "Dubbed",
    "South Indian Movies":"South",
  };

  return (
    <div className="sg-root">
      {playing && (
        <VideoPlayer
          src={playing.fileUrl}
          title={playing.title}
          subtitle={playing.year ? `${playing.source} · ${playing.year} · ${playing.quality}` : playing.source}
          tmdbId={playing.tmdbId}
          onClose={() => setPlaying(null)}
        />
      )}

      <div className="sg-header">
        <div className="sg-header-top">
          <div>
            <div className="sg-eyebrow">Browse</div>
            <h1 className="sg-title">South &amp; Hindi Movies</h1>
          </div>
          <div className="sg-search-wrap">
            <span className="sg-search-icon">&#128269;</span>
            <input className="sg-search" type="text" placeholder="Search title…" value={query} onChange={handleSearch} />
          </div>
        </div>

        <div className="sg-controls">
          <div className="sg-sort">
            {SORT_OPTIONS.map(o => (
              <button key={o.value} className={`sg-sort-btn${sort === o.value ? " active" : ""}`} onClick={() => handleSort(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
          <div className="sg-genres">
            {SOURCES.map(s => (
              <button key={s} className={`sg-genre-btn${activeSource === s ? " active" : ""}`} onClick={() => handleSource(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="sg-count">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} movies`}
          {(activeSource !== "All" || query) && ` · filtered from ${movies.length.toLocaleString()}`}
        </div>
      </div>

      {loading ? (
        <div className="sg-grid">{Array.from({ length: 24 }).map((_, i) => <div key={i} className="sg-skeleton" />)}</div>
      ) : (
        <>
          <div className="sg-grid">
            {visible.map(m => {
              const poster = (m.tmdbPoster || m.poster || "").replace("/t/p/w500/", "/t/p/w342/");
              const badge  = SOURCE_LABELS[m.source];
              return (
                <div key={m.id} className="sg-card" onClick={() => setPlaying(m)} style={{ cursor: "pointer" }}>
                  <div className="sg-card-thumb">
                    <img src={poster || undefined} alt={m.title} loading="lazy"
                      onError={e => { e.target.style.opacity = "0.2"; }} />
                    {m.rating && <span className="sg-rating">&#9733; {m.rating}</span>}
                    {badge && <span className="sg-badge-source">{badge}</span>}
                    <div className="sg-card-overlay">
                      <div className="sg-play">&#9654;</div>
                      <span className="sg-card-overlay-title">{m.title}</span>
                    </div>
                  </div>
                  <div className="sg-card-body">
                    <div className="sg-card-title">{m.title}</div>
                    <div className="sg-card-meta">{m.year || "—"} · {m.quality}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="sg-empty">No movies found{query ? ` for "${query}"` : ""}</div>
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
