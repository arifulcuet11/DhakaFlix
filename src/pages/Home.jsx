import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Hero from "../components/Hero";
import CategoryRow from "../components/CategoryRow";
import VideoPlayer from "../components/VideoPlayer";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { useEnglishTV } from "../hooks/useEnglishTV";
import { useForeignMovies } from "../hooks/useForeignMovies";
import { useAnimationMovies } from "../hooks/useAnimationMovies";
import { useEnglishMovies } from "../hooks/useEnglishMovies";
import { useSouthMovies } from "../hooks/useSouthMovies";
import { useContinueWatching } from "../hooks/useContinueWatching";
import "./Page.css";
import "./Home.css";

const GENRES = ["All", "Drama", "Comedy", "Mystery", "Crime", "Action", "Sci-Fi & Fantasy", "Romance", "Family", "War & Politics"];

export default function Home() {
  const { series: koreanSeries, loading } = useKoreanSeries();
  const { series: englishSeries } = useEnglishTV();
  const { movies: foreignMovies } = useForeignMovies();
  const { movies: animationMovies } = useAnimationMovies();
  const { movies: englishMovies } = useEnglishMovies();
  const { movies: southMovies } = useSouthMovies();
  const [playingAnimation, setPlayingAnimation] = useState(null);
  const [playingEnglish, setPlayingEnglish] = useState(null);
  const [playingSouth, setPlayingSouth] = useState(null);
  const [activeGenre, setActiveGenre] = useState("All");
  const [playingMovie, setPlayingMovie] = useState(null);
  const [continuePlayingUrl, setContinuePlayingUrl] = useState(null);

  const continueWatching = useContinueWatching(koreanSeries, englishSeries);

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
      {playingSouth && (
        <VideoPlayer
          src={playingSouth.fileUrl}
          title={playingSouth.title}
          subtitle={playingSouth.year ? `${playingSouth.source} · ${playingSouth.year}` : playingSouth.source}
          tmdbId={playingSouth.tmdbId}
          onClose={() => setPlayingSouth(null)}
        />
      )}
      {playingEnglish && (
        <VideoPlayer
          src={playingEnglish.fileUrl}
          title={playingEnglish.title}
          subtitle={playingEnglish.year ? `${playingEnglish.year} · ${playingEnglish.quality}` : playingEnglish.quality}
          tmdbId={playingEnglish.tmdbId}
          onClose={() => setPlayingEnglish(null)}
        />
      )}
      {continuePlayingUrl && (
        <VideoPlayer
          src={continuePlayingUrl}
          title={continueWatching.find(i => i.episodeUrl === continuePlayingUrl)?.title || ""}
          subtitle={(() => {
            const item = continueWatching.find(i => i.episodeUrl === continuePlayingUrl);
            if (!item) return "";
            return `S${item.season} · E${item.episodeNum}`;
          })()}
          onClose={() => setContinuePlayingUrl(null)}
        />
      )}
      <Hero />

      <div className="home-content">

        {/* ── CONTINUE WATCHING ── */}
        {continueWatching.length > 0 && (
          <CategoryRow
            title="Continue Watching"
            items={continueWatching.slice(0, 20).map(item => ({
              title: item.title,
              tag: `S${item.season} · E${item.episodeNum}`,
              poster: item.poster,
              progressPct: item.duration
                ? Math.min(99, Math.round((item.progress / item.duration) * 100))
                : null,
              onPlay: () => setContinuePlayingUrl(item.episodeUrl),
            }))}
          />
        )}

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

        {/* ── IMDB TOP 250 highlights ── */}
        {englishMovies.length > 0 && (
          <CategoryRow
            title="IMDb Top 250"
            items={englishMovies
              .filter(m => m.source === "IMDb Top 250" && m.rating)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.year} · ${m.quality}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingEnglish(m),
              }))}
            seeAllUrl="/english-movies?source=IMDb+Top+250"
          />
        )}

        <div className="home-divider" />

        {/* ── ENGLISH MOVIES highlights ── */}
        {englishMovies.length > 0 && (
          <CategoryRow
            title="English Movies"
            items={englishMovies
              .filter(m => m.rating && m.voteCount > 100)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.year} · ${m.quality}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingEnglish(m),
              }))}
            seeAllUrl="/english-movies"
          />
        )}

        <div className="home-divider" />

        {/* ── HINDI MOVIES highlights ── */}
        {southMovies.length > 0 && (
          <CategoryRow
            title="Hindi Movies"
            items={southMovies
              .filter(m => m.source === "Hindi Movies" && m.rating)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.year} · ${m.quality}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingSouth(m),
              }))}
            seeAllUrl="/south-movies?source=Hindi+Movies"
          />
        )}

        <div className="home-divider" />

        {/* ── SOUTH INDIAN MOVIES highlights ── */}
        {southMovies.length > 0 && (
          <CategoryRow
            title="South Indian Movies"
            items={southMovies
              .filter(m => m.source !== "Hindi Movies" && m.rating)
              .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
              .slice(0, 20)
              .map(m => ({
                title: m.title,
                tag: `${m.year} · ${m.quality}`,
                poster: m.tmdbPoster || m.poster,
                rating: m.rating,
                onPlay: () => setPlayingSouth(m),
              }))}
            seeAllUrl="/south-movies"
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


      </div>
    </div>
  );
}
