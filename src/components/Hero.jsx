import { useState, useEffect } from "react";
import { featured } from "../data/content";
import "./Hero.css";

export default function Hero() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCurrent(c => (c + 1) % featured.length), 5000);
    return () => clearInterval(t);
  }, []);

  const item = featured[current];

  return (
    <div className="hero">
      <div className="hero-bg" style={{ backgroundImage: `url(https://picsum.photos/seed/${current + 10}/1600/700)` }} />
      <div className="hero-overlay" />
      <div className="hero-content">
        <span className="hero-tag">{item.tag}</span>
        <h1 className="hero-title">{item.title}</h1>
        <p className="hero-sub">{item.subtitle}</p>
        <div className="hero-actions">
          <a href={item.url} target="_blank" rel="noreferrer" className="btn-play">
            &#9654; Browse
          </a>
          <button className="btn-info" onClick={() => setCurrent(c => (c + 1) % featured.length)}>
            Next &#8594;
          </button>
        </div>
      </div>
      <div className="hero-dots">
        {featured.map((_, i) => (
          <button key={i} className={`dot ${i === current ? "active" : ""}`} onClick={() => setCurrent(i)} />
        ))}
      </div>
    </div>
  );
}
