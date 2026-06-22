import { useState, useEffect } from "react";
import { useParams, Navigate } from "react-router-dom";
import { useKoreanSeries } from "../hooks/useKoreanSeries";
import { useEnglishTV } from "../hooks/useEnglishTV";
import SeriesBanner from "../components/SeriesBanner";
import VideoPlayer from "../components/VideoPlayer";
import "./SeriesDetail.css";

const STORAGE = "dhakaflix_progress";

function loadAllProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE) || "{}"); }
  catch { return {}; }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).catch(() => {
    prompt("Copy this link and paste into VLC → Media → Open Network Stream:", url);
  });
}

export default function SeriesDetail({ source = "korean" }) {
  const { id } = useParams();
  const korean  = useKoreanSeries();
  const english = useEnglishTV();
  const { series: seriesData, loading } = source === "english" ? english : korean;
  const series = seriesData.find(s => s.id === id);
  const [activeSeason,  setActiveSeason]  = useState(0);
  const [playingIdx,    setPlayingIdx]    = useState(null);
  const [tipDismissed,  setTipDismissed]  = useState(false);
  const [copied,        setCopied]        = useState(null);
  const [progress,      setProgress]      = useState({});

  // refresh progress from localStorage whenever player closes
  useEffect(() => { setProgress(loadAllProgress()); }, [playingIdx]);

  if (loading) return <div className="sd-loading">Loading…</div>;
  if (!series) return <Navigate to={source === "english" ? "/tvseries" : "/tvseries"} replace />;

  const season        = series.seasons[activeSeason];
  const episodes      = season.episodes;
  const totalEpisodes = series.seasons.reduce((n, s) => n + s.episodes.length, 0);

  function episodeUrl(ep) {
    return season.folderUrl + encodeURIComponent(ep.filename);
  }

  function fmtSize(kb) {
    return kb >= 1024 ? (kb / 1024).toFixed(0) + " MB" : kb + " KB";
  }

  function handleCopy(ep) {
    copyLink(episodeUrl(ep));
    setCopied(ep.episode);
    setTimeout(() => setCopied(null), 2000);
  }

  // build episode list for the in-player episode panel
  const episodeList = episodes.map((ep, idx) => ({
    ...ep,
    url: episodeUrl(ep),
  }));

  const playingEp = playingIdx !== null ? episodes[playingIdx] : null;
  const hasPrev   = playingIdx > 0;
  const hasNext   = playingIdx !== null && playingIdx < episodes.length - 1;

  // progress badge helpers
  function getEpProgress(ep) {
    const saved = progress[episodeUrl(ep)];
    if (!saved || saved < 5) return 0;
    // assume ~45min episode if sizeMB ≈ 500 (we don't have duration, use ratio heuristic)
    return saved; // raw seconds — we show as a bar fraction when duration is known
  }
  function wasWatched(ep) {
    // episode was fully watched if progress was reset to 0 by onEnded (saved as 0)
    const key = episodeUrl(ep);
    const all = loadAllProgress();
    return key in all && all[key] === 0;
  }
  function inProgress(ep) {
    const saved = progress[episodeUrl(ep)];
    return saved && saved > 10;
  }

  return (
    <div className="sd-root">
      <div className="sd-glow" />

      {/* ── VIDEO PLAYER MODAL ── */}
      {playingEp && (
        <VideoPlayer
          src={episodeUrl(playingEp)}
          title={series.title}
          subtitle={`Episode ${String(playingEp.episode).padStart(2, "0")}${playingEp.finale ? " — Finale" : ""}`}
          poster={series.tmdbPoster || series.poster}
          tmdbId={series.tmdbId}
          seasonNum={activeSeason + 1}
          episodeNum={playingEp.episode}
          onClose={() => setPlayingIdx(null)}
          onPrev={hasPrev ? () => setPlayingIdx(i => i - 1) : null}
          onNext={hasNext ? () => setPlayingIdx(i => i + 1) : null}
          episodes={episodeList}
          currentEpIdx={playingIdx}
          onJumpTo={idx => setPlayingIdx(idx)}
        />
      )}

      {/* ── STICKY LEFT PANEL ── */}
      <aside className="sd-panel-left">
        <div className="sd-poster-wrap">
          <img
            src={series.poster}
            alt={`${series.title} poster`}
            className="sd-poster-img"
            onError={e => { e.target.src = `https://placehold.co/300x500/13162A/4A6FA5?text=${encodeURIComponent(series.title)}`; }}
          />
          <div className="sd-poster-overlay" />
          <div className="sd-poster-meta">
            <div className="sd-eyebrow">Korean Drama</div>
            <div className="sd-poster-title">{series.title}</div>
            <div className="sd-tags">
              <span className="sd-tag sd-tag-quality">{series.quality}</span>
              <span className="sd-tag sd-tag-lang">{series.language}</span>
              {series.genre.map(g => (
                <span key={g} className="sd-tag sd-tag-genre">{g}</span>
              ))}
              <span className="sd-tag sd-tag-genre">{series.year}</span>
            </div>
          </div>
        </div>
      </aside>

      {/* ── SCROLLABLE RIGHT PANEL ── */}
      <main className="sd-panel-right">
        <SeriesBanner
          series={series}
          totalEpisodes={totalEpisodes}
          onPlayFirst={() => setPlayingIdx(0)}
        />

        <div className="sd-content">

          {/* TIP BANNER */}
          {!tipDismissed && (
            <div className="sd-vlc-tip">
              <span className="sd-vlc-tip-icon">📺</span>
              <div className="sd-vlc-tip-text">
                <strong>Watch in browser</strong> — click <span className="sd-vlc-highlight">▶</span> to play.
                Inside the player: <span className="sd-vlc-highlight">CC</span> loads subtitles · <span className="sd-vlc-highlight">☰</span> shows episodes · <span className="sd-vlc-highlight">⧉</span> Picture-in-Picture · <span className="sd-vlc-highlight">🎬</span> cinematic mode.
              </div>
              <button className="sd-vlc-tip-close" onClick={() => setTipDismissed(true)} aria-label="Dismiss">✕</button>
            </div>
          )}

          <div className="sd-section-header">
            <span className="sd-section-title">Episodes</span>
            <div className="sd-season-selector">
              {series.seasons.map((s, i) => (
                <button
                  key={i}
                  className={`sd-season-btn${activeSeason === i ? " active" : ""}`}
                  onClick={() => { setActiveSeason(i); setPlayingIdx(null); }}
                >
                  S{String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          <div className="sd-episode-list">
            {episodes.map((ep, idx) => {
              const watched    = wasWatched(ep);
              const inProg     = inProgress(ep);
              return (
                <div
                  key={ep.episode}
                  className={`sd-episode${ep.finale ? " sd-finale" : ""}${playingIdx === idx ? " sd-playing" : ""}${watched ? " sd-watched" : ""}`}
                >
                  <div className="sd-ep-info">
                    <div className="sd-ep-title-row">
                      <span className="sd-ep-title" data-num={String(ep.episode).padStart(2, "0")}>
                        Episode {ep.episode}{ep.finale ? " — Series Finale" : ""}
                      </span>
                      {watched && <span className="sd-ep-badge sd-ep-badge-done">✓ Watched</span>}
                      {inProg  && !watched && <span className="sd-ep-badge sd-ep-badge-prog">In Progress</span>}
                    </div>
                    <span className="sd-ep-filename">{ep.filename}</span>
                  </div>

                  <div className="sd-ep-right">
                    {ep.finale && <span className="sd-finale-badge">Final</span>}
                    <span className="sd-ep-size">{fmtSize(ep.sizeMB)}</span>

                    <button
                      className={`sd-ep-copy${copied === ep.episode ? " copied" : ""}`}
                      onClick={() => handleCopy(ep)}
                      title="Copy link for VLC"
                    >
                      {copied === ep.episode ? "✓" : "⎘"}
                    </button>

                    <button
                      className="sd-ep-watch"
                      onClick={() => setPlayingIdx(idx)}
                      title="Watch in browser"
                    >
                      ▶
                    </button>

                    <a href={episodeUrl(ep)} download className="sd-ep-dl" title="Download">↓</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
