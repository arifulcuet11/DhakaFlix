import { useEffect, useRef, useState, useCallback } from "react";
import "./VideoPlayer.css";

function fmt(s) {
  if (!s || isNaN(s)) return "0:00";
  const h   = Math.floor(s / 3600);
  const m   = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

// parse SRT → [{start, end, text}]
function parseSRT(raw) {
  const blocks = raw.trim().split(/\n\s*\n/);
  return blocks.map(b => {
    const lines = b.trim().split("\n");
    const timeLine = lines.find(l => l.includes("-->"));
    if (!timeLine) return null;
    const [s, e] = timeLine.split("-->").map(t => {
      const [hh, mm, ss] = t.trim().replace(",", ".").split(":").map(Number);
      return hh * 3600 + mm * 60 + ss;
    });
    const text = lines.slice(lines.indexOf(timeLine) + 1).join("\n").replace(/<[^>]+>/g, "");
    return { start: s, end: e, text };
  }).filter(Boolean);
}

function parseVTT(raw) {
  return parseSRT(raw.replace(/WEBVTT.*?\n\n/, ""));
}

const SPEEDS   = [0.5, 0.75, 1, 1.25, 1.5, 2];
const STORAGE  = "dhakaflix_progress";
const DURATION_STORAGE = "dhakaflix_duration";
const VOLUME_STORAGE   = "dhakaflix_volume";

function saveProgress(src, time) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE) || "{}");
    all[src] = time;
    localStorage.setItem(STORAGE, JSON.stringify(all));
    window.dispatchEvent(new Event("dhakaflix_progress_updated"));
  } catch {}
}
function loadProgress(src) {
  try { return JSON.parse(localStorage.getItem(STORAGE) || "{}")[src] || 0; }
  catch { return 0; }
}
function saveDuration(src, duration) {
  try {
    const all = JSON.parse(localStorage.getItem(DURATION_STORAGE) || "{}");
    all[src] = duration;
    localStorage.setItem(DURATION_STORAGE, JSON.stringify(all));
  } catch {}
}
function loadVolume() {
  try { return parseFloat(localStorage.getItem(VOLUME_STORAGE)) || 1; }
  catch { return 1; }
}
function persistVolume(v) {
  try { localStorage.setItem(VOLUME_STORAGE, String(v)); } catch {}
}

// episodes: [{episode, filename, finale, url}]  optional — for episode panel
export default function VideoPlayer({ src, title, subtitle, onClose, onNext, onPrev, episodes, currentEpIdx, onJumpTo }) {
  const videoRef      = useRef(null);
  const wrapRef       = useRef(null);
  const hideTimer     = useRef(null);
  const seekRef       = useRef(null);
  const volRef        = useRef(null);
  const tapTimer      = useRef(null);
  const subRef        = useRef(null);
  const touchStartX   = useRef(null);
  const touchStartY   = useRef(null);

  const [playing,    setPlaying]    = useState(false);
  const [current,    setCurrent]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [buffered,   setBuffered]   = useState(0);
  const [volume,     setVolume]     = useState(() => loadVolume());
  const [muted,      setMuted]      = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showCtrl,   setShowCtrl]   = useState(true);
  const [waiting,    setWaiting]    = useState(true);
  const [speed,      setSpeed]      = useState(1);
  const [showSpeed,  setShowSpeed]  = useState(false);
  const [skipFlash,  setSkipFlash]  = useState(null);
  const [endOverlay, setEndOverlay] = useState(false);
  const [nextCount,  setNextCount]  = useState(5);
  const [resumed,    setResumed]    = useState(false);
  const [pip,        setPip]        = useState(false);
  const [showEps,    setShowEps]    = useState(false);
  const [subs,       setSubs]       = useState([]);     // parsed subtitle cues
  const [subLine,    setSubLine]    = useState("");     // current subtitle text
  const [seekTooltip, setSeekTooltip] = useState(null); // {x, time}
  const [seekDrag,    setSeekDrag]    = useState(null); // ratio while dragging (visual only)
  const [cinematic,  setCinematic]  = useState(false);

  // ── auto-hide ───────────────────────────────────────────────
  const revealControls = useCallback(() => {
    setShowCtrl(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setShowCtrl(false);
    }, 3000);
  }, []);

  // ── body scroll lock ────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = "hidden";
    if (cinematic) document.body.classList.add("vp-cinematic-bg");
    return () => {
      document.body.style.overflow = "";
      document.body.classList.remove("vp-cinematic-bg");
    };
  }, [cinematic]);

  useEffect(() => {
    if (cinematic) document.body.classList.add("vp-cinematic-bg");
    else document.body.classList.remove("vp-cinematic-bg");
  }, [cinematic]);

  // ── auto-play + resume on src change ───────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    let cancelled = false;
    setWaiting(true); setEndOverlay(false); setSubs([]); setSubLine("");
    setCurrent(0); setDuration(0); setBuffered(0);
    v.load();
    function tryResume() {
      if (cancelled) return;
      const saved = loadProgress(src);
      if (saved > 10) { v.currentTime = saved; setResumed(true); setTimeout(() => setResumed(false), 3000); }
      v.volume = loadVolume();
      v.play().catch(e => {
        // AbortError is expected when src changes or component unmounts mid-play
        if (e.name !== "AbortError") console.warn("play() failed:", e);
      });
      v.removeEventListener("loadedmetadata", tryResume);
    }
    v.addEventListener("loadedmetadata", tryResume);
    return () => { cancelled = true; v.removeEventListener("loadedmetadata", tryResume); };
  }, [src]);

  // ── save progress every 5s ──────────────────────────────────
  useEffect(() => {
    const id = setInterval(() => {
      const v = videoRef.current;
      if (v && v.currentTime > 5) saveProgress(src, v.currentTime);
    }, 5000);
    return () => clearInterval(id);
  }, [src]);

  // ── subtitle sync ───────────────────────────────────────────
  useEffect(() => {
    if (!subs.length) { setSubLine(""); return; }
    const cue = subs.find(c => current >= c.start && current <= c.end);
    setSubLine(cue ? cue.text : "");
  }, [current, subs]);

  // ── fullscreen listener ─────────────────────────────────────
  useEffect(() => {
    function onFs() { setFullscreen(!!document.fullscreenElement); }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // ── PiP listener ────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    function onEnterPip() { setPip(true); }
    function onLeavePip() { setPip(false); }
    v.addEventListener("enterpictureinpicture", onEnterPip);
    v.addEventListener("leavepictureinpicture", onLeavePip);
    return () => {
      v.removeEventListener("enterpictureinpicture", onEnterPip);
      v.removeEventListener("leavepictureinpicture", onLeavePip);
    };
  }, []);

  // ── auto-next countdown ─────────────────────────────────────
  useEffect(() => {
    if (!endOverlay || !onNext) return;
    setNextCount(5);
    const tick = setInterval(() => {
      setNextCount(n => { if (n <= 1) { clearInterval(tick); onNext(); return 0; } return n - 1; });
    }, 1000);
    return () => clearInterval(tick);
  }, [endOverlay, onNext]);

  // ── keyboard shortcuts ──────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      const v = videoRef.current;
      if (!v || e.target.tagName === "INPUT") return;
      switch (e.key) {
        case "Escape":
          if (showEps)    { setShowEps(false);   return; }
          if (endOverlay) { setEndOverlay(false); return; }
          if (showSpeed)  { setShowSpeed(false);  return; }
          onClose(); break;
        case " ": case "k": case "K":
          e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case "f": case "F": e.preventDefault(); toggleFullscreen(); break;
        case "m": case "M": e.preventDefault(); v.muted = !v.muted; setMuted(v.muted); break;
        case "p": case "P": e.preventDefault(); togglePip(); break;
        case "c": case "C": e.preventDefault(); setCinematic(x => !x); break;
        case "e": case "E": e.preventDefault(); setShowEps(x => !x); break;
        case "ArrowLeft":
          e.preventDefault();
          v.currentTime = Math.max(0, v.currentTime - 10);
          setSkipFlash("back"); setTimeout(() => setSkipFlash(null), 600);
          revealControls(); break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          setSkipFlash("fwd"); setTimeout(() => setSkipFlash(null), 600);
          revealControls(); break;
        case "ArrowUp":   e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); persistVolume(v.volume); break;
        case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); persistVolume(v.volume); break;
        case "n": case "N": if (onNext) onNext(); break;
        default: break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, revealControls, endOverlay, showSpeed, showEps]);

  // ── video events ────────────────────────────────────────────
  function onTimeUpdate() {
    const v = videoRef.current;
    if (!v) return;
    setCurrent(v.currentTime);
    if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
  }
  function onDurationChange() {
    if (videoRef.current) {
      const d = videoRef.current.duration;
      setDuration(d);
      if (d && isFinite(d)) saveDuration(src, d);
    }
  }
  function onPlay()    { setPlaying(true);  revealControls(); }
  function onPause()   { setPlaying(false); setShowCtrl(true); clearTimeout(hideTimer.current); }
  function onWaiting() { setWaiting(true); }
  function onCanPlay() { setWaiting(false); }
  function onEnded()   { setEndOverlay(true); setShowCtrl(true); saveProgress(src, 0); }

  // ── seek bar ────────────────────────────────────────────────
  function getSeekRatio(e) {
    const bar = seekRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  }
  function seek(e) {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    v.currentTime = getSeekRatio(e) * v.duration;
  }
  function onSeekMouseMove(e) {
    if (!duration) return;
    const bar = seekRef.current;
    if (!bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setSeekTooltip({ x: e.clientX - rect.left, time: ratio * duration });
  }
  function onSeekMouseDown(e) {
    e.preventDefault();
    const ratio = getSeekRatio(e);
    setSeekDrag(ratio);
    setSeekTooltip({ x: e.clientX - seekRef.current.getBoundingClientRect().left, time: ratio * duration });

    const onMove = ev => {
      const r = getSeekRatio(ev);
      setSeekDrag(r);
      const bar = seekRef.current;
      if (bar) setSeekTooltip({ x: ev.clientX - bar.getBoundingClientRect().left, time: r * duration });
    };
    const onUp = ev => {
      const v = videoRef.current;
      if (v && v.duration) v.currentTime = getSeekRatio(ev) * v.duration;
      setSeekDrag(null);
      setSeekTooltip(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── volume ──────────────────────────────────────────────────
  function setVol(e) {
    const v = videoRef.current, bar = volRef.current;
    if (!v || !bar) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.volume = ratio; setVolume(ratio); persistVolume(ratio);
    if (ratio > 0) { v.muted = false; setMuted(false); }
  }
  function onVolMouseDown(e) {
    setVol(e);
    const onMove = ev => setVol(ev);
    const onUp   = ()  => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",  onUp);
  }

  // ── double-tap to seek (mobile/touch) ───────────────────────
  function onWrapClick(e) {
    // ignore clicks on controls/header
    if (e.target.closest(".vp-controls") || e.target.closest(".vp-header") || e.target.closest(".vp-ep-panel")) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const third = rect.width / 3;

    if (tapTimer.current) {
      // double tap
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
      if (x < third) {
        skip(-10);
      } else if (x > rect.width - third) {
        skip(10);
      } else {
        togglePlay();
      }
    } else {
      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        togglePlay();
      }, 250);
    }
  }

  // ── controls ────────────────────────────────────────────────
  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(e => { if (e.name !== "AbortError") console.warn(e); });
    else v.pause();
  }
  function toggleMute() { const v = videoRef.current; if (!v) return; v.muted = !v.muted; setMuted(v.muted); }
  function toggleFullscreen() {
    const el = wrapRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
    else document.exitFullscreen();
  }
  function togglePip() {
    const v = videoRef.current;
    if (!v) return;
    if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
    else v.requestPictureInPicture().catch(() => {});
  }
  function applySpeed(s) {
    const v = videoRef.current;
    if (v) v.playbackRate = s;
    setSpeed(s); setShowSpeed(false);
  }
  function skip(sec) {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + sec));
    setSkipFlash(sec > 0 ? "fwd" : "back");
    setTimeout(() => setSkipFlash(null), 600);
    revealControls();
  }

  // ── touch swipe seeking ─────────────────────────────────────
  function onTouchStart(e) {
    // only track if not on controls/header/ep-panel
    if (e.target.closest(".vp-controls") || e.target.closest(".vp-header") || e.target.closest(".vp-ep-panel")) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartX.current;
    const deltaY = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;

    // ignore if predominantly vertical (scroll)
    if (Math.abs(deltaY) > Math.abs(deltaX)) return;
    // require at least 50px horizontal swipe
    if (Math.abs(deltaX) < 50) return;

    const seekSec = Math.round(deltaX / 50) * 10;
    skip(seekSec);
  }

  // ── subtitle file picker ─────────────────────────────────────
  function onSubFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const raw = ev.target.result;
      const parsed = file.name.endsWith(".vtt") ? parseVTT(raw) : parseSRT(raw);
      setSubs(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  const pct     = seekDrag !== null ? seekDrag * 100 : duration ? (current / duration) * 100 : 0;
  const bufPct  = duration ? (buffered / duration) * 100 : 0;
  const volPct  = muted ? 0 : volume * 100;
  const volIcon = muted || volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊";
  const pipSupported = document.pictureInPictureEnabled;

  return (
    <>
      {/* cinematic page dim */}
      {cinematic && <div className="vp-cinematic-dim" onClick={onClose} />}

      <div className={`vp-overlay${cinematic ? " vp-cinematic" : ""}`} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div className="vp-modal">

          {/* ── VIDEO WRAP ── */}
          <div
            ref={wrapRef}
            className={`vp-wrap${fullscreen ? " vp-fullscreen" : ""}`}
            onMouseMove={revealControls}
            onClick={onWrapClick}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
          >
            {/* header */}
            <div className={`vp-header${showCtrl ? "" : " vp-hidden"}`} onClick={e => e.stopPropagation()}>
              <div className="vp-header-info">
                {title    && <span className="vp-title">{title}</span>}
                {title && subtitle && <span className="vp-sep">·</span>}
                {subtitle && <span className="vp-subtitle">{subtitle}</span>}
              </div>
              <div className="vp-header-right">
                {pip && <span className="vp-pip-badge">PiP</span>}
                <button className="vp-close" onClick={onClose} aria-label="Close">✕</button>
              </div>
            </div>

            <video
              ref={videoRef}
              className="vp-video"
              src={src}
              autoPlay
              playsInline
              preload="auto"
              onTimeUpdate={onTimeUpdate}
              onDurationChange={onDurationChange}
              onPlay={onPlay}
              onPause={onPause}
              onWaiting={onWaiting}
              onCanPlay={onCanPlay}
              onEnded={onEnded}
            />

            {/* subtitle overlay */}
            {subLine && (
              <div className="vp-subtitle-overlay">
                {subLine.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
              </div>
            )}

            {/* spinner */}
            {waiting && !endOverlay && (
              <div className="vp-spinner"><div className="vp-spin-ring" /></div>
            )}

            {/* skip flash */}
            {skipFlash && (
              <div className={`vp-skip-flash vp-skip-${skipFlash}`}>
                {skipFlash === "fwd" ? "+10s ▶▶" : "◀◀ -10s"}
              </div>
            )}

            {/* resume toast */}
            {resumed && <div className="vp-toast">Resumed from where you left off</div>}

            {/* ── END OVERLAY ── */}
            {endOverlay && (
              <div className="vp-end-overlay" onClick={e => e.stopPropagation()}>
                <div className="vp-end-box">
                  <div className="vp-end-title">{title}</div>
                  <div className="vp-end-sub">{subtitle} — finished</div>
                  {onNext ? (
                    <>
                      <div className="vp-end-countdown">
                        Next episode in <span>{nextCount}</span>s
                      </div>
                      <div className="vp-end-actions">
                        <button className="vp-end-btn vp-end-next" onClick={onNext}>Play Next ▶</button>
                        <button className="vp-end-btn vp-end-cancel" onClick={() => setEndOverlay(false)}>Cancel</button>
                      </div>
                    </>
                  ) : (
                    <div className="vp-end-done">You've reached the last episode.</div>
                  )}
                </div>
              </div>
            )}

            {/* ── EPISODE PANEL ── */}
            {showEps && episodes && (
              <div className="vp-ep-panel" onClick={e => e.stopPropagation()}>
                <div className="vp-ep-panel-header">
                  <span>Episodes</span>
                  <button className="vp-ep-panel-close" onClick={() => setShowEps(false)}>✕</button>
                </div>
                <div className="vp-ep-list">
                  {episodes.map((ep, idx) => (
                    <button
                      key={ep.episode}
                      className={`vp-ep-item${idx === currentEpIdx ? " vp-ep-active" : ""}`}
                      onClick={() => { onJumpTo && onJumpTo(idx); setShowEps(false); }}
                    >
                      <span className="vp-ep-num">{String(ep.episode).padStart(2, "0")}</span>
                      <span className="vp-ep-name">
                        Episode {ep.episode}{ep.finale ? " — Finale" : ""}
                      </span>
                      {idx === currentEpIdx && <span className="vp-ep-now">▶ Now</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── CUSTOM CONTROLS ── */}
            {!endOverlay && (
              <div className={`vp-controls${showCtrl ? "" : " vp-hidden"}`} onClick={e => e.stopPropagation()}>

                {/* seek bar */}
                <div className="vp-seek-area">
                  <div
                    ref={seekRef}
                    className="vp-seek-track"
                    onMouseDown={onSeekMouseDown}
                    onMouseMove={onSeekMouseMove}
                    onMouseLeave={() => setSeekTooltip(null)}
                  >
                    {seekTooltip && (
                      <div className="vp-seek-tooltip" style={{ left: seekTooltip.x }}>
                        {fmt(seekTooltip.time)}
                      </div>
                    )}
                    <div className="vp-seek-buf"   style={{ width: `${bufPct}%` }} />
                    <div className="vp-seek-fill"  style={{ width: `${pct}%` }} />
                    <div className="vp-seek-thumb" style={{ left:  `${pct}%` }} />
                  </div>
                </div>

                {/* bottom bar */}
                <div className="vp-bar">
                  <div className="vp-bar-left">
                    {onPrev && <button className="vp-btn" onClick={onPrev} title="Previous episode">⏮</button>}
                    <button className="vp-btn" onClick={() => skip(-10)} title="Rewind 10s (←)">⏪</button>
                    <button className="vp-btn vp-btn-play" onClick={togglePlay} title="Play / Pause (Space)">
                      {playing ? "⏸" : "▶"}
                    </button>
                    <button className="vp-btn" onClick={() => skip(10)} title="Forward 10s (→)">⏩</button>
                    {onNext && <button className="vp-btn" onClick={onNext} title="Next episode (N)">⏭</button>}

                    <button className="vp-btn" onClick={toggleMute} title="Mute (M)">{volIcon}</button>
                    <div ref={volRef} className="vp-vol-track" onMouseDown={onVolMouseDown} title="Volume">
                      <div className="vp-vol-fill"  style={{ width: `${volPct}%` }} />
                      <div className="vp-vol-thumb" style={{ left:  `${volPct}%` }} />
                    </div>

                    <span className="vp-time">{fmt(current)} / {fmt(duration)}</span>
                  </div>

                  <div className="vp-bar-right">
                    {/* episode list panel toggle */}
                    {episodes && (
                      <button
                        className={`vp-btn vp-btn-eps${showEps ? " active" : ""}`}
                        onClick={e => { e.stopPropagation(); setShowEps(v => !v); }}
                        title="Episodes (E)"
                      >
                        ☰
                      </button>
                    )}

                    {/* subtitle picker */}
                    <label className="vp-btn vp-btn-cc" title="Load subtitle file (.srt / .vtt)">
                      {subs.length ? "CC●" : "CC"}
                      <input ref={subRef} type="file" accept=".srt,.vtt" onChange={onSubFile} style={{ display: "none" }} />
                    </label>

                    {/* cinematic mode */}
                    <button
                      className={`vp-btn vp-btn-cinema${cinematic ? " active" : ""}`}
                      onClick={e => { e.stopPropagation(); setCinematic(v => !v); }}
                      title="Cinematic mode (C)"
                    >
                      🎬
                    </button>

                    {/* PiP */}
                    {pipSupported && (
                      <button
                        className={`vp-btn${pip ? " active" : ""}`}
                        onClick={e => { e.stopPropagation(); togglePip(); }}
                        title="Picture in Picture (P)"
                      >
                        ⧉
                      </button>
                    )}

                    {/* speed */}
                    <div className="vp-speed-wrap">
                      {showSpeed && (
                        <div className="vp-speed-menu" onClick={e => e.stopPropagation()}>
                          {SPEEDS.map(s => (
                            <button
                              key={s}
                              className={`vp-speed-opt${speed === s ? " active" : ""}`}
                              onClick={() => applySpeed(s)}
                            >
                              {s === 1 ? "Normal" : `${s}×`}
                            </button>
                          ))}
                        </div>
                      )}
                      <button
                        className="vp-btn vp-btn-speed"
                        onClick={e => { e.stopPropagation(); setShowSpeed(v => !v); }}
                        title="Playback speed"
                      >
                        {speed === 1 ? "1×" : `${speed}×`}
                      </button>
                    </div>

                    {/* fullscreen */}
                    <button className="vp-btn vp-btn-fs" onClick={toggleFullscreen} title="Fullscreen (F)">
                      {fullscreen ? (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/>
                          <path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/>
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <path d="M3 7V3h4"/><path d="M21 7V3h-4"/>
                          <path d="M3 17v4h4"/><path d="M21 17v4h-4"/>
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
