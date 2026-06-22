import { useMemo, useState } from "react";
import { useBanglaMovies } from "../hooks/useBanglaMovies";
import VideoPlayer from "../components/VideoPlayer";
import PageBanner from "../components/PageBanner";
import "../components/SeriesGrid.css";

const SORT_OPTIONS = [
  { value: "rating", label: "Top Rated" },
  { value: "new",    label: "Newest" },
  { value: "az",     label: "A → Z" },
  { value: "za",     label: "Z → A" },
];

const PAGE_SIZE = 60;

export default function BanglaMovies() {
  const { movies, loading } = useBanglaMovies();

  const [query,   setQuery]   = useState("");
  const [sort,    setSort]    = useState("rating");
  const [page,    setPage]    = useState(1);
  const [playing, setPlaying] = useState(null);

  function handleSort(s)   { setSort(s);  setPage(1); }
  function handleSearch(e) { setQuery(e.target.value); setPage(1); }

  const filtered = useMemo(() => {
    let out = movies;
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
  }, [movies, query, sort]);

  const visible = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = page < Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div className="sg-root">
      {playing && (
        <VideoPlayer
          src={playing.fileUrl}
          title={playing.title}
          subtitle={playing.year ? `Bangla · ${playing.year}` : "Bangla"}
          tmdbId={playing.tmdbId}
          onClose={() => setPlaying(null)}
        />
      )}

      <PageBanner items={movies} count={5} />

      <div className="sg-header">
        <div className="sg-header-top">
          <div>
            <div className="sg-eyebrow">Browse</div>
            <h1 className="sg-title">Kolkata Bangla Movies</h1>
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
        </div>

        <div className="sg-count">
          {loading ? "Loading…" : `${filtered.length.toLocaleString()} movies`}
          {query && ` · filtered from ${movies.length.toLocaleString()}`}
        </div>
      </div>

      {loading ? (
        <div className="sg-grid">{Array.from({ length: 24 }).map((_, i) => <div key={i} className="sg-skeleton" />)}</div>
      ) : (
        <>
          <div className="sg-grid">
            {visible.map(m => {
              const poster = (m.tmdbPoster || m.poster || "").replace("/t/p/w500/", "/t/p/w342/");
              return (
                <div key={m.id} className="sg-card" onClick={() => setPlaying(m)} style={{ cursor: "pointer" }}>
                  <div className="sg-card-thumb">
                    <img src={poster || undefined} alt={m.title} loading="lazy"
                      onError={e => { e.target.style.opacity = "0.2"; }} />
                    {m.rating && <span className="sg-rating">&#9733; {m.rating}</span>}
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
