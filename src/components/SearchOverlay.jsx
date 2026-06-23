import { useState, useEffect, useRef, useMemo } from "react";
import { Link, useLocation } from "react-router-dom";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { useEnglishTV } from "../hooks/useEnglishTV";
import { useForeignMovies } from "../hooks/useForeignMovies";
import { useAnimationMovies } from "../hooks/useAnimationMovies";
import { useSouthMovies } from "../hooks/useSouthMovies";
import { useEnglishMovies } from "../hooks/useEnglishMovies";
import { useDocumentary } from "../hooks/useDocumentary";
import { useBanglaMovies } from "../hooks/useBanglaMovies";
import { categories } from "../data/content";
import VideoPlayer from "./VideoPlayer";
import "./SearchOverlay.css";

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='60' height='90' viewBox='0 0 60 90'%3E%3Crect width='60' height='90' fill='%231C2038'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='22' fill='%238A8AA8'%3E%3F%3C/text%3E%3C/svg%3E";

const allStaticItems = Object.entries(categories).flatMap(([, cat]) =>
  cat.items.map(item => ({ ...item, category: cat.label }))
);

const TRENDING = [
  "Squid Game", "Crash Landing on You", "Money Heist",
  "The Crown", "Breaking Bad", "Parasite", "Oppenheimer",
];

export default function SearchOverlay({ onClose }) {
  const [query, setQuery] = useState("");
  const [player, setPlayer] = useState(null);
  const inputRef = useRef(null);
  const overlayRef = useRef(null);
  const location = useLocation();
  const openPathRef = useRef(location.pathname);

  const { series: korean } = useKoreanSeries();
  const { series: english } = useEnglishTV();
  const { movies: foreign } = useForeignMovies();
  const { movies: animation } = useAnimationMovies();
  const { movies: south } = useSouthMovies();
  const { movies: englishMovies } = useEnglishMovies();
  const { movies: docs } = useDocumentary();
  const { movies: bangla } = useBanglaMovies();

  // focus input on mount
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  // lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // close when user navigates away (pathname different from when overlay opened)
  useEffect(() => {
    if (location.pathname !== openPathRef.current) onClose();
  }, [location.pathname]);

  const q = query.toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return null;
    const match = str => (str || "").toLowerCase().includes(q);

    return {
      korean:  korean.filter(s => match(s.title) || (s.genre || []).some(g => match(g))).slice(0, 12),
      english: english.filter(s => match(s.title) || (s.genre || []).some(g => match(g))).slice(0, 8),
      foreign: foreign.filter(m => match(m.title) || match(m.language)).slice(0, 8),
      animation: animation.filter(m => match(m.title)).slice(0, 6),
      south: south.filter(m => match(m.title)).slice(0, 6),
      englishMovies: englishMovies.filter(m => match(m.title)).slice(0, 6),
      docs: docs.filter(m => match(m.title)).slice(0, 6),
      bangla: bangla.filter(m => match(m.title)).slice(0, 6),
      statics: allStaticItems.filter(i => match(i.title) || match(i.category)).slice(0, 8),
    };
  }, [q, korean, english, foreign, animation, south, englishMovies, docs, bangla]);

  const totalCount = results
    ? Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
    : 0;

  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleTrendingClick(term) {
    setQuery(term);
    inputRef.current?.focus();
  }

  return (
    <div className="so-backdrop" ref={overlayRef} onClick={handleBackdropClick}>
      <div className="so-panel">

        {/* ── SEARCH BAR ── */}
        <div className="so-bar">
          <svg className="so-bar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            className="so-input"
            type="text"
            placeholder="Search movies, series, genres…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
          {query && (
            <button className="so-clear" onClick={() => { setQuery(""); inputRef.current?.focus(); }} aria-label="Clear">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
          <button className="so-close" onClick={onClose} aria-label="Close search">
            Esc
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="so-body">

          {/* Empty state — show trending */}
          {!q && (
            <div className="so-empty">
              <p className="so-trending-label">Trending searches</p>
              <div className="so-trending-chips">
                {TRENDING.map(t => (
                  <button key={t} className="so-chip" onClick={() => handleTrendingClick(t)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>
                    </svg>
                    {t}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* No results */}
          {q && totalCount === 0 && (
            <div className="so-no-results">
              <span className="so-no-results-icon">🎬</span>
              <p className="so-no-results-text">No results for <strong>"{query}"</strong></p>
              <p className="so-no-results-sub">Try a different keyword or browse by category</p>
            </div>
          )}

          {/* Results */}
          {q && totalCount > 0 && (
            <div className="so-results">
              <p className="so-result-count">{totalCount} result{totalCount !== 1 ? "s" : ""}</p>

              {results.korean.length > 0 && (
                <ResultSection title="Korean Drama">
                  {results.korean.map(s => (
                    <SeriesCard key={`ko-${s.id}`} item={s} to={`/series/${s.id}`} onClose={onClose} />
                  ))}
                </ResultSection>
              )}

              {results.english.length > 0 && (
                <ResultSection title="English TV">
                  {results.english.map(s => (
                    <SeriesCard key={`en-${s.id}`} item={s} to={`/tv/${s.id}`} onClose={onClose} />
                  ))}
                </ResultSection>
              )}

              {results.englishMovies.length > 0 && (
                <ResultSection title="English Movies">
                  {results.englishMovies.map(m => (
                    <MovieCard key={`em-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.south.length > 0 && (
                <ResultSection title="Hindi / South Indian">
                  {results.south.map(m => (
                    <MovieCard key={`so-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.foreign.length > 0 && (
                <ResultSection title="Foreign Movies">
                  {results.foreign.map(m => (
                    <MovieCard key={`fo-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.animation.length > 0 && (
                <ResultSection title="Animation">
                  {results.animation.map(m => (
                    <MovieCard key={`an-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.docs.length > 0 && (
                <ResultSection title="Documentary">
                  {results.docs.map(m => (
                    <MovieCard key={`do-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.bangla.length > 0 && (
                <ResultSection title="Bangla Movies">
                  {results.bangla.map(m => (
                    <MovieCard key={`ba-${m.id}`} item={m} onPlay={() => setPlayer(m)} />
                  ))}
                </ResultSection>
              )}

              {results.statics.length > 0 && (
                <ResultSection title="Other">
                  <div className="so-static-list">
                    {results.statics.map((item, i) => (
                      <a key={i} href={item.url} target="_blank" rel="noreferrer" className="so-static-item" onClick={onClose}>
                        <div className="so-static-left">
                          <span className="so-static-tag">{item.tag}</span>
                          <span className="so-static-title">{item.title}</span>
                          <span className="so-static-cat">{item.category}</span>
                        </div>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" width="14" height="14"><line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/></svg>
                      </a>
                    ))}
                  </div>
                </ResultSection>
              )}
            </div>
          )}
        </div>
      </div>

      {player && (
        <VideoPlayer
          src={player.fileUrl}
          title={player.title}
          subtitle={[player.year, player.quality].filter(Boolean).join(" · ")}
          tmdbId={player.tmdbId}
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  );
}

function ResultSection({ title, children }) {
  return (
    <section className="so-section">
      <h3 className="so-section-title">{title}</h3>
      <div className="so-card-row">{children}</div>
    </section>
  );
}

function SeriesCard({ item, to, onClose }) {
  const poster = item.tmdbPoster || item.poster;
  return (
    <Link to={to} className="so-card" onClick={onClose}>
      <div className="so-card-thumb">
        <img src={poster || PLACEHOLDER} alt={item.title} loading="lazy"
          onError={e => { e.currentTarget.src = PLACEHOLDER; }} />
        <div className="so-card-play">▶</div>
        {item.rating && <span className="so-card-rating">★ {Number(item.rating).toFixed(1)}</span>}
      </div>
      <div className="so-card-info">
        <p className="so-card-title">{item.title}</p>
        <p className="so-card-meta">{[item.year, item.quality].filter(Boolean).join(" · ")}</p>
        {item.genre?.length > 0 && (
          <p className="so-card-genre">{item.genre.slice(0, 2).join(", ")}</p>
        )}
      </div>
    </Link>
  );
}

function MovieCard({ item, onPlay }) {
  const poster = item.tmdbPoster || item.poster;
  return (
    <div className="so-card" role="button" tabIndex={0} onClick={onPlay}
      onKeyDown={e => e.key === "Enter" && onPlay()}>
      <div className="so-card-thumb">
        <img src={poster || PLACEHOLDER} alt={item.title} loading="lazy"
          onError={e => { e.currentTarget.src = PLACEHOLDER; }} />
        <div className="so-card-play">▶</div>
        {item.rating && <span className="so-card-rating">★ {Number(item.rating).toFixed(1)}</span>}
      </div>
      <div className="so-card-info">
        <p className="so-card-title">{item.title}</p>
        <p className="so-card-meta">{[item.year, item.quality || item.language].filter(Boolean).join(" · ")}</p>
        {item.genre?.length > 0 && (
          <p className="so-card-genre">{item.genre.slice(0, 2).join(", ")}</p>
        )}
      </div>
    </div>
  );
}
