import { useState, useEffect, useRef, useCallback } from "react";
import "./PageBanner.css";

const INTERVAL = 6000;

function getTopRecent(items, count) {
  return items
    .filter(s => s.tmdbBanner || s.banner)
    .sort((a, b) => (parseInt(b.year) || 0) - (parseInt(a.year) || 0))
    .slice(0, count);
}

export default function PageBanner({ items = [], count = 5 }) {
  const slides = getTopRecent(items, count);
  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);
  const rafRef = useRef(null);
  const startRef = useRef(null);

  const goTo = useCallback((idx) => {
    setCurrent(idx);
    setProgress(0);
    startRef.current = performance.now();
  }, []);

  useEffect(() => {
    if (!slides.length) return;
    startRef.current = performance.now();
    function tick(now) {
      const pct = Math.min(((now - startRef.current) / INTERVAL) * 100, 100);
      setProgress(pct);
      if (pct < 100) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [current, slides.length]);

  useEffect(() => {
    if (!slides.length) return;
    timerRef.current = setTimeout(() => goTo((current + 1) % slides.length), INTERVAL);
    return () => clearTimeout(timerRef.current);
  }, [current, slides.length, goTo]);

  if (!slides.length) return null;

  const slide = slides[current];
  const banner = slide.tmdbBanner || slide.banner;

  return (
    <div className="pb-root">
      {slides.map((s, i) => (
        <div
          key={i}
          className={`pb-bg ${i === current ? "active" : ""}`}
          style={{ backgroundImage: `url(${s.tmdbBanner || s.banner})` }}
        />
      ))}
      <div className="pb-overlay" />

      <div className="pb-content">
        <div className="pb-tag">{slide.genre?.[0] ?? slide.tag ?? "New"}</div>
        <h2 className="pb-title">{slide.title}</h2>
        <div className="pb-meta">
          {slide.year && <span>{slide.year}</span>}
          {slide.quality && <span>{slide.quality}</span>}
          {slide.rating && <span>&#9733; {slide.rating}</span>}
        </div>
        {slide.synopsis && <p className="pb-synopsis">{slide.synopsis}</p>}
      </div>

      <div className="pb-dots">
        {slides.map((_, i) => (
          <button
            key={i}
            className={`pb-dot${i === current ? " active" : ""}`}
            onClick={() => goTo(i)}
            aria-label={`Slide ${i + 1}`}
          >
            {i === current && (
              <span className="pb-dot-progress" style={{ width: `${progress}%` }} />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
