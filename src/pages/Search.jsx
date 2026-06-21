import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { useEnglishTV } from "../hooks/useEnglishTV";
import { useForeignMovies } from "../hooks/useForeignMovies";
import { useAnimationMovies } from "../hooks/useAnimationMovies";
import { categories } from "../data/content";
import VideoPlayer from "../components/VideoPlayer";
import "./Search.css";

const PLACEHOLDER = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='154' height='231' viewBox='0 0 154 231'%3E%3Crect width='154' height='231' fill='%231C2038'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='40' fill='%238A8AA8'%3E%3F%3C/text%3E%3C/svg%3E";

const allStaticItems = Object.entries(categories).flatMap(([, cat]) =>
  cat.items.map(item => ({ ...item, category: cat.label }))
);

function PosterCard({ poster, title, meta, rating, onClick, to }) {
  const img = (
    <div className="sg-card-thumb">
      <img
        src={poster || PLACEHOLDER}
        alt={title}
        loading="lazy"
        onError={e => { e.currentTarget.src = PLACEHOLDER; }}
      />
      {rating && <span className="sg-rating">★ {Number(rating).toFixed(1)}</span>}
      <div className="sg-card-overlay">
        <div className="sg-play">▶</div>
        <div className="sg-card-overlay-title">{title}</div>
      </div>
    </div>
  );

  const body = (
    <div className="sg-card-body">
      <div className="sg-card-title">{title}</div>
      {meta && <div className="sg-card-meta">{meta}</div>}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="sg-card">
        {img}
        {body}
      </Link>
    );
  }

  return (
    <div className="sg-card" role="button" tabIndex={0} onClick={onClick}
      onKeyDown={e => e.key === "Enter" && onClick && onClick()}>
      {img}
      {body}
    </div>
  );
}

function SearchGroup({ title, count, children }) {
  return (
    <section className="search-group">
      <h2 className="search-group-title">
        {title}
        <span className="search-group-count">{count}</span>
      </h2>
      <div className="sg-grid search-group-grid">
        {children}
      </div>
    </section>
  );
}

export default function Search({ query }) {
  const { series: korean } = useKoreanSeries();
  const { series: english } = useEnglishTV();
  const { movies: foreign } = useForeignMovies();
  const { movies: animation } = useAnimationMovies();

  const [player, setPlayer] = useState(null); // { src, title }

  const q = (query || "").toLowerCase().trim();

  const results = useMemo(() => {
    if (!q) return null;

    const match = str => (str || "").toLowerCase().includes(q);

    const koreanResults = korean.filter(s =>
      match(s.title) || (s.genre || []).some(g => match(g))
    );

    const englishResults = english.filter(s =>
      match(s.title) || (s.genre || []).some(g => match(g))
    );

    const foreignResults = foreign.filter(m =>
      match(m.title) || match(m.language)
    );

    const animationResults = animation.filter(m =>
      match(m.title)
    );

    const staticResults = allStaticItems.filter(i =>
      match(i.title) || match(i.category)
    );

    return { koreanResults, englishResults, foreignResults, animationResults, staticResults };
  }, [q, korean, english, foreign, animation]);

  const totalCount = results
    ? results.koreanResults.length + results.englishResults.length +
      results.foreignResults.length + results.animationResults.length +
      results.staticResults.length
    : 0;

  const hasAny = totalCount > 0;

  return (
    <div className="search-root">
      {/* Header */}
      <div className="search-header">
        <div className="sg-eyebrow">Search</div>
        <h1 className="sg-title">
          {q ? `Results for "${query}"` : "Discover"}
        </h1>
        {q && (
          <p className="search-header-meta">
            {hasAny ? `${totalCount} title${totalCount !== 1 ? "s" : ""} found` : "No results found"}
          </p>
        )}
      </div>

      {/* Empty state — no query */}
      {!q && (
        <div className="search-empty">
          <div className="search-empty-icon">🔍</div>
          <h2 className="search-empty-title">Search across 5,000+ titles</h2>
          <p className="search-empty-sub">
            Korean dramas, English series, foreign films, animation and more
          </p>
        </div>
      )}

      {/* No results */}
      {q && !hasAny && (
        <div className="search-empty">
          <div className="search-empty-icon">🎬</div>
          <h2 className="search-empty-title">No titles found for "{query}"</h2>
          <p className="search-empty-sub">Try a different keyword or browse categories from the home page</p>
        </div>
      )}

      {/* Results grouped */}
      {q && hasAny && (
        <div className="search-groups">
          {results.koreanResults.length > 0 && (
            <SearchGroup title="Korean Drama" count={results.koreanResults.length}>
              {results.koreanResults.map(s => (
                <PosterCard
                  key={s.id}
                  poster={s.tmdbPoster || s.poster}
                  title={s.title}
                  meta={[s.year, s.quality].filter(Boolean).join(" · ")}
                  rating={s.rating}
                  to={`/series/${s.id}`}
                />
              ))}
            </SearchGroup>
          )}

          {results.englishResults.length > 0 && (
            <SearchGroup title="English TV" count={results.englishResults.length}>
              {results.englishResults.map(s => (
                <PosterCard
                  key={s.id}
                  poster={s.tmdbPoster || s.poster}
                  title={s.title}
                  meta={[s.year, s.quality].filter(Boolean).join(" · ")}
                  rating={s.rating}
                  to={`/tv/${s.id}`}
                />
              ))}
            </SearchGroup>
          )}

          {results.foreignResults.length > 0 && (
            <SearchGroup title="Foreign Movies" count={results.foreignResults.length}>
              {results.foreignResults.map(m => (
                <PosterCard
                  key={m.id}
                  poster={m.tmdbPoster || m.poster}
                  title={m.title}
                  meta={[m.year, m.language].filter(Boolean).join(" · ")}
                  rating={m.rating}
                  onClick={() => setPlayer({ src: m.fileUrl, title: m.title })}
                />
              ))}
            </SearchGroup>
          )}

          {results.animationResults.length > 0 && (
            <SearchGroup title="Animation" count={results.animationResults.length}>
              {results.animationResults.map(m => (
                <PosterCard
                  key={m.id}
                  poster={m.tmdbPoster || m.poster}
                  title={m.title}
                  meta={[m.year, m.quality].filter(Boolean).join(" · ")}
                  rating={m.rating}
                  onClick={() => setPlayer({ src: m.fileUrl, title: m.title })}
                />
              ))}
            </SearchGroup>
          )}

          {results.staticResults.length > 0 && (
            <section className="search-group">
              <h2 className="search-group-title">
                Other
                <span className="search-group-count">{results.staticResults.length}</span>
              </h2>
              <div className="search-static-list">
                {results.staticResults.map((item, i) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="search-static-item"
                  >
                    <div className="search-static-left">
                      <span className="search-tag">{item.tag}</span>
                      <span className="search-static-title">{item.title}</span>
                      <span className="search-static-cat">{item.category}</span>
                    </div>
                    <span className="search-static-arrow">&#8599;</span>
                  </a>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Video player modal */}
      {player && (
        <VideoPlayer
          src={player.src}
          title={player.title}
          onClose={() => setPlayer(null)}
        />
      )}
    </div>
  );
}
