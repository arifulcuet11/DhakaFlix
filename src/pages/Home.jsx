import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import CategoryRow from "../components/CategoryRow";
import VideoPlayer from "../components/VideoPlayer";
import { categories } from "../data/content";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { useEnglishTV } from "../hooks/useEnglishTV";
import { useForeignMovies } from "../hooks/useForeignMovies";
import { useAnimationMovies } from "../hooks/useAnimationMovies";
import "./Page.css";
import "./Home.css";

const GENRES = ["All", "Drama", "Comedy", "Mystery", "Crime", "Action", "Sci-Fi & Fantasy", "Romance", "Family", "War & Politics"];

export default function Home() {
  const { series: koreanSeries, loading } = useKoreanSeries();
  const { series: englishSeries } = useEnglishTV();
  const { movies: foreignMovies } = useForeignMovies();
  const { movies: animationMovies } = useAnimationMovies();
  const [playingAnimation, setPlayingAnimation] = useState(null);
  const [activeGenre, setActiveGenre] = useState("All");
  const [playingMovie, setPlayingMovie] = useState(null);

  const filteredKorean = useMemo(() => {
    if (activeGenre === "All") return koreanSeries;
    return koreanSeries.filter(s =>
      s.genre?.some(g => g === activeGenre)
    );
  }, [koreanSeries, activeGenre]);

  const toCard = s => ({
    title: s.title,
    tag: `${s.year} · ${s.quality}`,
    poster: s.tmdbPoster || s.poster,   // TMDB first — much better quality
    seriesId: s.id,
    rating: s.rating,
    genre: s.genre,
  });

  const koreanCards = filteredKorean.map(toCard);

  // top-rated: enriched series sorted by rating, take top 20
  const topRatedCards = useMemo(() =>
    koreanSeries
      .filter(s => s.rating && s.voteCount > 50)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 20)
      .map(toCard),
    [koreanSeries]
  );

  // new releases: highest year first
  const newCards = useMemo(() =>
    koreanSeries
      .filter(s => s.year >= "2023")
      .sort((a, b) => b.year.localeCompare(a.year))
      .slice(0, 20)
      .map(toCard),
    [koreanSeries]
  );

  return (
    <div className="home">
      {playingMovie && (
        <VideoPlayer
          src={playingMovie.fileUrl}
          title={playingMovie.title}
          subtitle={`${playingMovie.language}${playingMovie.year ? ` · ${playingMovie.year}` : ""}`}
          onClose={() => setPlayingMovie(null)}
        />
      )}
      {playingAnimation && (
        <VideoPlayer
          src={playingAnimation.fileUrl}
          title={playingAnimation.title}
          subtitle={playingAnimation.year ? `Animation · ${playingAnimation.year}` : "Animation"}
          onClose={() => setPlayingAnimation(null)}
        />
      )}
      <Hero />

      <div className="home-content">

        {/* ── TOP RATED ── */}
        {topRatedCards.length > 0 && (
          <CategoryRow title="Top Rated" items={topRatedCards} seeAllUrl="/korean?sort=rating" />
        )}

        {/* ── NEW RELEASES ── */}
        {newCards.length > 0 && (
          <CategoryRow title="New Releases" items={newCards} seeAllUrl="/korean?sort=new" />
        )}

        {/* ── KOREAN DRAMA with genre filter ── */}
        <section className="home-section">
          <div className="home-section-header">
            <div className="home-section-title-row">
              <h2 className="home-section-title">Korean Drama</h2>
              {!loading && (
                <span className="home-section-count">{filteredKorean.length}</span>
              )}
              <Link to="/korean" className="home-see-all">See all ›</Link>
            </div>
            <div className="home-genre-filter">
              {GENRES.map(g => (
                <button
                  key={g}
                  className={`home-genre-btn${activeGenre === g ? " active" : ""}`}
                  onClick={() => setActiveGenre(g)}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="home-loading">
              <div className="home-loading-row">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="home-skeleton-card" />
                ))}
              </div>
            </div>
          ) : (
            <CategoryRow title="" items={koreanCards} />
          )}
        </section>

        <div className="home-divider" />

        {/* ── ENGLISH TV highlights ── */}
        {englishSeries.length > 0 && (
          <CategoryRow
            title="English TV & WEB Series"
            items={englishSeries
              .filter(s => s.rating && s.voteCount > 100)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 20)
              .map(s => ({
                title: s.title,
                tag: `${s.year} · ${s.quality}`,
                poster: s.tmdbPoster || s.poster,
                seriesId: s.id,
                rating: s.rating,
                genre: s.genre,
                tvRoute: true,
              }))}
            seeAllUrl="/tvseries"
            tvRoute
          />
        )}

        <div className="home-divider" />

        {/* ── FOREIGN MOVIES highlights ── */}
        {foreignMovies.length > 0 && (
          <CategoryRow
            title="Foreign Language Movies"
            items={foreignMovies
              .filter(m => m.rating && m.voteCount > 50)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.language} · ${m.year}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingMovie(m),
              }))}
            seeAllUrl="/foreign-movies"
          />
        )}

        <div className="home-divider" />

        {/* ── ANIMATION MOVIES highlights ── */}
        {animationMovies.length > 0 && (
          <CategoryRow
            title="Animation Movies"
            items={animationMovies
              .filter(m => m.rating && m.voteCount > 50)
              .sort((a, b) => b.rating - a.rating)
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.year} · ${m.quality}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingAnimation(m),
              }))}
            seeAllUrl="/animation-movies"
          />
        )}

        <div className="home-divider" />

        <CategoryRow title="Movies" items={categories.movies.items} />
        <CategoryRow title="Games" items={categories.games.items} />
        <CategoryRow title="Software & Tutorials" items={categories.software.items} />

      </div>
    </div>
  );
}
