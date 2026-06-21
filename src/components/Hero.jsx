import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { featured } from "../data/content";
import "./Hero.css";

const INTERVAL = 8000;
const MAX_SIDE_THUMBS = 8;

const fallbackSlides = featured.map((f, i) => ({
  type: "category",
  title: f.title,
  subtitle: f.subtitle,
  banner: null,
  poster: null,
  tag: f.tag,
  url: f.url,
  seed: i + 10,
}));

export default function Hero() {
  const { series: koreanSeries } = useKoreanSeries();

  const slides = useMemo(() => {
    const seriesSlides = koreanSeries
      .filter(s => s.tmdbBanner || s.banner)
      .map(s => ({
        type: "series",
        id: s.id,
        title: s.title,
        subtitle: s.synopsis,
        banner: s.tmdbBanner || s.banner,   // TMDB 1280px backdrop first
        poster: s.tmdbPoster || s.poster,
        tag: s.genre?.[0] ?? "Korean Drama",
        year: s.year,
        quality: s.quality,
        rating: s.rating,
        episodeCount: s.seasons?.reduce((n, se) => n + se.episodes.length, 0) ?? 0,
      }));
    return [...seriesSlides, ...fallbackSlides];
  }, [koreanSeries]);

  const [current, setCurrent] = useState(0);
  const [prev, setPrev] = useState(null);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const progressRef = useRef(null);
  const startRef = useRef(null);

  const goTo = useCallback((idx) => {
    setPrev(current);
    setCurrent(idx);
    setProgress(0);
    startRef.current = performance.now();
  }, [current]);

  const next = useCallback(() => {
    goTo((current + 1) % (slides.length || 1));
  }, [current, goTo, slides.length]);

  useEffect(() => {
    if (paused) { cancelAnimationFrame(progressRef.current); return; }
    startRef.current = performance.now();
    function tick(now) {
      const elapsed = now - startRef.current;
      const pct = Math.min((elapsed / INTERVAL) * 100, 100);
      setProgress(pct);
      if (pct < 100) progressRef.current = requestAnimationFrame(tick);
    }
    progressRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(progressRef.current);
  }, [current, paused]);

  useEffect(() => {
    if (paused) { clearTimeout(timerRef.current); return; }
    timerRef.current = setTimeout(next, INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [current, paused, next]);

  const slide = slides[current];

  const sideSlides = useMemo(() => {
    if (!slides.length) return [];
    const count = Math.min(slides.length, MAX_SIDE_THUMBS);
    return Array.from({ length: count }, (_, i) => ({ slide: slides[i], idx: i }));
  }, [slides]);

  function bannerUrl(s) {
    if (s.banner) return s.banner;
    return `https://picsum.photos/seed/${s.seed ?? s.title}/1600/700`;
  }

  function thumbUrl(s) {
    if (s.poster) return s.poster;
    if (s.banner) return s.banner;
    return `https://picsum.photos/seed/${encodeURIComponent(s.title)}/160/90`;
  }

  function renderCTA(s) {
    if (s.type === "series") {
      return (
        <Link to={`/series/${s.id}`} className="hero-btn-play">
          &#9654; Watch Now
        </Link>
      );
    }
    return (
      <a href={s.url} target="_blank" rel="noreferrer" className="hero-btn-play">
        &#9654; Browse
      </a>
    );
  }

  const totalDots = Math.min(slides.length, 20);

  if (!slide) return null;

  return (
    <div
      className="hero"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.slice(0, 20).map((s, i) => (
        <div
          key={i}
          className={`hero-bg-layer ${i === current ? "active" : i === prev ? "prev" : ""}`}
          style={{ backgroundImage: `url(${bannerUrl(s)})` }}
        />
      ))}

      <div className="hero-overlay-left" />
      <div className="hero-overlay-bottom" />

      <div className="hero-content">
        <div className="hero-featured-badge">Featured</div>

        <div className="hero-eyebrow">
          <span className="hero-tag">{slide.tag}</span>
          {slide.year    && <span className="hero-year">{slide.year}</span>}
          {slide.quality && <span className="hero-quality">{slide.quality}</span>}
          {slide.rating  && <span className="hero-rating">&#9733; {slide.rating}</span>}
        </div>

        <h1 className="hero-title">{slide.title}</h1>

        {slide.subtitle && <p className="hero-sub">{slide.subtitle}</p>}
        {slide.episodeCount > 0 && <p className="hero-eps">{slide.episodeCount} Episodes</p>}

        <div className="hero-actions">
          {renderCTA(slide)}
          <button className="hero-btn-info" onClick={next} aria-label="Next slide">
            More &#8594;
          </button>
        </div>
      </div>

      {totalDots > 1 && (
        <div className="hero-dots">
          {Array.from({ length: totalDots }, (_, i) => (
            <button
              key={i}
              className={`hero-dot${i === current ? " active" : ""}`}
              onClick={() => goTo(i)}
              aria-label={`Slide ${i + 1}`}
            />
          ))}
        </div>
      )}

      {sideSlides.length > 1 && (
        <div className="hero-side-strip">
          {sideSlides.map(({ slide: s, idx }) => (
            <button
              key={idx}
              className={`hero-side-thumb${idx === current ? " active" : ""}`}
              onClick={() => goTo(idx)}
              aria-label={s.title}
            >
              <img
                src={thumbUrl(s)}
                alt={s.title}
                loading="lazy"
                onError={e => { e.target.src = `https://picsum.photos/seed/${encodeURIComponent(s.title)}/160/90`; }}
              />
              {idx === current && (
                <div className="hero-side-progress">
                  <div className="hero-side-progress-bar" style={{ width: `${progress}%` }} />
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {paused && <div className="hero-paused">&#9646;&#9646; Paused</div>}
    </div>
  );
}
