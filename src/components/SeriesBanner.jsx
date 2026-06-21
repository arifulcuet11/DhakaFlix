import { useState, useEffect, useRef, useCallback } from "react";
import "./SeriesBanner.css";

const IDLE_DELAY  = 5000;
const PREVIEW_SEC = 30;

function pickRandomEp(series, excludeUrl = null) {
  const allEps = series.seasons.flatMap(s => s.episodes);
  if (!allEps.length) return null;
  // avoid repeating the same episode back-to-back
  const pool = allEps.filter(ep => {
    const season = series.seasons.find(s => s.episodes.includes(ep));
    if (!season) return false;
    const url = season.folderUrl + encodeURIComponent(ep.filename);
    return url !== excludeUrl;
  });
  const candidates = pool.length ? pool : allEps;
  const ep     = candidates[Math.floor(Math.random() * candidates.length)];
  const season = series.seasons.find(s => s.episodes.includes(ep));
  if (!season) return null;
  return { ep, url: season.folderUrl + encodeURIComponent(ep.filename) };
}

export default function SeriesBanner({ series, totalEpisodes, videoPlaying = false }) {
  const bannerUrl = series.banner || series.poster || "";

  const [preview,      setPreview]      = useState(null);
  const [previewMuted, setPreviewMuted] = useState(true);
  const [previewTime,  setPreviewTime]  = useState(0);
  const [previewReady, setPreviewReady] = useState(false);

  const idleRef       = useRef(null);
  const cycleRef      = useRef(null);  // timer for next episode
  const videoRef      = useRef(null);
  const preloadRef    = useRef(null);
  const previewRef    = useRef(null);
  const mutedRef      = useRef(true);  // stable mute ref for cycle callback
  const previewStartRef = useRef(0);

  // ── preload first episode on mount ───────────────────────────
  useEffect(() => {
    const ep = pickRandomEp(series);
    if (!ep) return;
    const v = document.createElement("video");
    v.src = ep.url; v.preload = "auto"; v.muted = true; v.style.display = "none";
    document.body.appendChild(v);
    preloadRef.current = v;
    return () => { v.pause(); v.src = ""; v.remove(); };
  }, [series]);

  // ── start a specific episode as preview ───────────────────────
  const startEpisode = useCallback((ep) => {
    previewRef.current = ep;
    setPreview(ep);
    setPreviewTime(0);
    setPreviewReady(false);
    setPreviewMuted(false); // always try unmuted — onCanPlay falls back if blocked
  }, []);

  // ── cycle to next random episode ─────────────────────────────
  const cycleNext = useCallback(() => {
    const current = previewRef.current;
    const next = pickRandomEp(series, current?.url);
    if (!next) return;
    clearTimeout(cycleRef.current);
    startEpisode(next);
  }, [series, startEpisode]);

  // ── stop preview entirely ────────────────────────────────────
  const stopPreview = useCallback(() => {
    clearTimeout(cycleRef.current);
    previewRef.current = null;
    setPreview(null);
    setPreviewTime(0);
    setPreviewReady(false);
    // keep muted state as-is for next time
  }, []);

  // ── idle scheduler ────────────────────────────────────────────
  const scheduleIdle = useCallback(() => {
    clearTimeout(idleRef.current);
    idleRef.current = setTimeout(() => {
      if (previewRef.current) return;
      const ep = pickRandomEp(series);
      if (!ep) return;
      startEpisode(ep);
    }, IDLE_DELAY);
  }, [series, startEpisode]);

  const lastMousePos = useRef(null);

  const onMouseMove = useCallback((e) => {
    const pos = lastMousePos.current;
    if (pos) {
      const dx = e.clientX - pos.x;
      const dy = e.clientY - pos.y;
      // only stop preview on significant movement (50px)
      if (previewRef.current && Math.sqrt(dx * dx + dy * dy) > 50) {
        stopPreview();
      }
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    scheduleIdle();
  }, [stopPreview, scheduleIdle]);

  const onOtherActivity = useCallback(() => {
    scheduleIdle();
  }, [scheduleIdle]);

  useEffect(() => {
    document.addEventListener("mousemove", onMouseMove, { passive: true });
    ["keydown", "scroll", "touchstart"].forEach(e =>
      document.addEventListener(e, onOtherActivity, { passive: true })
    );
    scheduleIdle();
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      ["keydown", "scroll", "touchstart"].forEach(e =>
        document.removeEventListener(e, onOtherActivity)
      );
      clearTimeout(idleRef.current);
      clearTimeout(cycleRef.current);
    };
  }, [onMouseMove, onOtherActivity, scheduleIdle]);

  // ── sync muted ref ────────────────────────────────────────────
  useEffect(() => { mutedRef.current = previewMuted; }, [previewMuted]);

  // ── stop preview when the main VideoPlayer modal opens ───────
  useEffect(() => {
    if (videoPlaying) stopPreview();
  }, [videoPlaying, stopPreview]);

  // ── video playback effect ─────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !preview) return;

    v.muted   = mutedRef.current;
    v.preload = "auto";
    v.src     = preview.url;

    const pre = preloadRef.current;
    if (pre && pre.src === preview.url && pre.buffered.length > 0) {
      v.currentTime = pre.currentTime;
    }

    function onCanPlay() {
      // try unmuted first — works if user has interacted with the page
      v.muted = false;
      v.play().catch(() => {
        // browser blocked unmuted autoplay — fall back to muted
        v.muted = true;
        setPreviewMuted(true);
        v.play().catch(e => { if (e.name !== "AbortError") console.warn(e); });
      });
    }
    function onPlaying() {
      setPreviewReady(true);
      previewStartRef.current = v.currentTime;
      // schedule next episode after PREVIEW_SEC
      clearTimeout(cycleRef.current);
      cycleRef.current = setTimeout(cycleNext, PREVIEW_SEC * 1000);
    }
    function onTimeUpdate() { setPreviewTime(v.currentTime); }
    function onEnded()      { cycleNext(); } // file shorter than expected

    v.addEventListener("canplay",    onCanPlay,    { once: true });
    v.addEventListener("playing",    onPlaying,    { once: true });
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("ended",      onEnded,      { once: true });
    v.load();

    return () => {
      clearTimeout(cycleRef.current);
      v.removeEventListener("canplay",    onCanPlay);
      v.removeEventListener("playing",    onPlaying);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("ended",      onEnded);
      v.pause();
      v.src = "";
    };
  }, [preview, cycleNext]);

  // sync mute to live video
  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = previewMuted;
  }, [previewMuted]);

  function avgMB() {
    const all = series.seasons.flatMap(s => s.episodes);
    if (!all.length) return null;
    return (all.reduce((n, e) => n + e.sizeMB, 0) / all.length / 1024).toFixed(0);
  }

  const elapsed    = previewReady ? Math.max(0, previewTime - previewStartRef.current) : 0;
  const previewPct = Math.min((elapsed / PREVIEW_SEC) * 100, 100);

  return (
    <div className="sb-root">

      {/* static background */}
      <div className="sb-bg" style={{ backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined }} />

      {/* preview video */}
      {preview && (
        <>
          <video
            ref={videoRef}
            className={`sb-preview-video${previewReady ? " sb-preview-ready" : ""}`}
            src={preview.url}
            playsInline
            muted={previewMuted}
          />
          {!previewReady && (
            <div className="sb-preview-loading">
              <div className="sb-spin" />
              <span>Loading preview…</span>
            </div>
          )}
        </>
      )}

      <div className="sb-grad-left" />
      <div className="sb-grad-bottom" />

      {/* content */}
      <div className="sb-content">
        <div className="sb-eyebrow">
          {series.genre.map(g => <span key={g} className="sb-tag">{g}</span>)}
          <span className="sb-tag sb-tag-outline">{series.year}</span>
          <span className="sb-tag sb-tag-outline">{series.quality}</span>
        </div>
        <h1 className="sb-title">{series.title}</h1>
        {series.synopsis && <p className="sb-synopsis">{series.synopsis}</p>}
        <div className="sb-stats">
          <div className="sb-stat">
            <span className="sb-stat-val">{totalEpisodes}</span>
            <span className="sb-stat-label">Episodes</span>
          </div>
          <div className="sb-stat-div" />
          <div className="sb-stat">
            <span className="sb-stat-val">{series.year}</span>
            <span className="sb-stat-label">Year</span>
          </div>
          {avgMB() && <>
            <div className="sb-stat-div" />
            <div className="sb-stat">
              <span className="sb-stat-val">~{avgMB()}</span>
              <span className="sb-stat-label">MB / EP</span>
            </div>
          </>}
          <div className="sb-stat-div" />
          <div className="sb-stat">
            <span className="sb-stat-val">{series.language}</span>
            <span className="sb-stat-label">Language</span>
          </div>
        </div>
      </div>

      {/* preview HUD */}
      {preview && (
        <div className="sb-preview-bar">
          <div className="sb-preview-info">
            <span className="sb-preview-badge">Preview</span>
            <span className="sb-preview-ep">
              Episode {preview.ep.episode}{preview.ep.finale ? " — Finale" : ""}
            </span>
            {previewReady && (
              <span className="sb-preview-next-label">
                next in {Math.max(0, PREVIEW_SEC - Math.floor(elapsed))}s
              </span>
            )}
          </div>
          <div className="sb-preview-actions">
            <button
              className="sb-preview-btn"
              onClick={e => { e.stopPropagation(); cycleNext(); }}
              title="Skip to next episode preview"
            >
              ⏭ Skip
            </button>
            <button
              className="sb-preview-btn"
              onClick={e => { e.stopPropagation(); setPreviewMuted(m => !m); }}
            >
              {previewMuted ? "🔇 Unmute" : "🔊 Mute"}
            </button>
            <button
              className="sb-preview-btn sb-preview-close"
              onClick={e => { e.stopPropagation(); stopPreview(); }}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {preview && (
        <div className="sb-preview-progress">
          <div className="sb-preview-fill" style={{ width: `${previewPct}%` }} />
        </div>
      )}
    </div>
  );
}
