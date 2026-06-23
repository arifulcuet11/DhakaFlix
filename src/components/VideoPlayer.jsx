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

// ── OpenSubtitles.com v1 API (free key required) ─────────────
const OS_API_KEY = "4RFVxXv80EapG22fz4E5gXXwEbT5YBMp";
// legacy localStorage key kept for backwards compat but key is now hardcoded
function loadOsKey() { return OS_API_KEY; }
function saveOsKey() {}

async function searchSubtitles({ query, tmdbId, season, episode, apiKey }) {
  const params = new URLSearchParams({ per_page: 50, order_by: "download_count", order_direction: "desc" });
  // TMDB ID gives exact match — use it when available, fall back to text query
  if (tmdbId) {
    params.set("tmdb_id", tmdbId);
  } else {
    params.set("query", query);
  }
  if (season)  params.set("season_number", season);
  if (episode) params.set("episode_number", episode);
  const res = await fetch(`https://api.opensubtitles.com/api/v1/subtitles?${params}`, {
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
  });
  if (res.status === 401 || res.status === 403) throw new Error("invalid_key");
  if (!res.ok) throw new Error(`search ${res.status}`);
  const json = await res.json();
  return (json.data || [])
    .map((item, i) => ({
      id: item.attributes.files?.[0]?.file_id || String(i),
      lang: (item.attributes.language || "en").toLowerCase(),
      releaseName: item.attributes.release || item.attributes.feature_details?.title || query,
      downloads: item.attributes.download_count || 0,
      rating: item.attributes.ratings || 0,
      fileId: item.attributes.files?.[0]?.file_id,
      fileName: item.attributes.files?.[0]?.file_name || "subtitle.srt",
      hearingImpaired: item.attributes.hearing_impaired || false,
      fps: item.attributes.fps || null,
    }))
    .sort((a, b) => b.downloads - a.downloads);
}

async function fetchSubtitleText(fileId, apiKey) {
  const res = await fetch("https://api.opensubtitles.com/api/v1/download", {
    method: "POST",
    headers: { "Api-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ file_id: fileId }),
  });
  if (!res.ok) throw new Error(`download-link ${res.status}`);
  const { link, file_name } = await res.json();
  if (!link) throw new Error("no download link");
  const fileRes = await fetch(link);
  if (!fileRes.ok) throw new Error(`download ${fileRes.status}`);
  return { text: await fileRes.text(), name: file_name || "subtitle.srt" };
}

// ── Subtitle cache (localStorage) ───────────────────────────
const SUB_CACHE_KEY = "dhakaflix_sub_cache";
const SUB_CACHE_MAX = 50;

function loadSubCache() {
  try { return JSON.parse(localStorage.getItem(SUB_CACHE_KEY) || "{}"); }
  catch { return {}; }
}
function saveSubCache(cache) {
  try { localStorage.setItem(SUB_CACHE_KEY, JSON.stringify(cache)); } catch {}
}
function getCachedSub(fileId) {
  const cache = loadSubCache();
  return cache[fileId] || null;
}
function setCachedSub(fileId, text, fileName) {
  const cache = loadSubCache();
  cache[fileId] = { text, fileName, savedAt: Date.now() };
  // evict oldest entries if over limit
  const keys = Object.keys(cache);
  if (keys.length > SUB_CACHE_MAX) {
    const sorted = keys.sort((a, b) => cache[a].savedAt - cache[b].savedAt);
    sorted.slice(0, keys.length - SUB_CACHE_MAX).forEach(k => delete cache[k]);
  }
  saveSubCache(cache);
}

const LANG_NAMES = {
  en: "English", ar: "Arabic", bn: "Bengali", zh: "Chinese", nl: "Dutch",
  fr: "French", de: "German", hi: "Hindi", id: "Indonesian", it: "Italian",
  ja: "Japanese", ko: "Korean", ms: "Malay", fa: "Persian", pt: "Portuguese",
  ru: "Russian", es: "Spanish", tr: "Turkish", ur: "Urdu", vi: "Vietnamese",
};
const LANG_FLAGS = {
  en: "🇬🇧", ar: "🇸🇦", bn: "🇧🇩", zh: "🇨🇳", nl: "🇳🇱",
  fr: "🇫🇷", de: "🇩🇪", hi: "🇮🇳", id: "🇮🇩", it: "🇮🇹",
  ja: "🇯🇵", ko: "🇰🇷", ms: "🇲🇾", fa: "🇮🇷", pt: "🇵🇹",
  ru: "🇷🇺", es: "🇪🇸", tr: "🇹🇷", ur: "🇵🇰", vi: "🇻🇳",
};

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

const WATCHED_AT = "dhakaflix_watched_at";

function saveProgress(src, time) {
  try {
    const all     = JSON.parse(localStorage.getItem(STORAGE)    || "{}");
    const watched = JSON.parse(localStorage.getItem(WATCHED_AT) || "{}");
    all[src]     = time;
    watched[src] = Date.now();
    localStorage.setItem(STORAGE,    JSON.stringify(all));
    localStorage.setItem(WATCHED_AT, JSON.stringify(watched));
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
export default function VideoPlayer({ src, title, subtitle, tmdbId, seasonNum, episodeNum, poster, onClose, onNext, onPrev, episodes, currentEpIdx, onJumpTo }) {
  const videoRef      = useRef(null);
  const thumbVideoRef = useRef(null);
  const wrapRef       = useRef(null);
  const hideTimer     = useRef(null);
  const seekRef       = useRef(null);
  const volRef        = useRef(null);
  const tapTimer      = useRef(null);
  const subRef        = useRef(null);
  const touchStartX   = useRef(null);
  const touchStartY   = useRef(null);
  const thumbTimer    = useRef(null);

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
  const [showSubPanel, setShowSubPanel] = useState(false);
  const [subResults,   setSubResults]   = useState([]);
  const [subLoading,   setSubLoading]   = useState(false);
  const [subError,     setSubError]     = useState("");
  const [subDownloading, setSubDownloading] = useState(null);
  const [subLangFilter,  setSubLangFilter]  = useState("en");
  const [osKey,          setOsKey]          = useState(OS_API_KEY);
  const [showKeyInput,   setShowKeyInput]   = useState(false); // unused with hardcoded key
  const [thumbDataUrl,   setThumbDataUrl]   = useState(null);
  const [skipRipple,     setSkipRipple]     = useState(null); // {dir, key}
  const [glowColor,      setGlowColor]      = useState("74,111,165");

  // ── ambient glow from poster ────────────────────────────────
  useEffect(() => {
    if (!poster) return;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 8; canvas.height = 8;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 8, 8);
        const d = ctx.getImageData(0, 0, 8, 8).data;
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; }
        const n = d.length / 4;
        const boost = 1.4;
        setGlowColor(`${Math.min(255,Math.round(r/n*boost))},${Math.min(255,Math.round(g/n*boost))},${Math.min(255,Math.round(b/n*boost))}`);
      } catch {}
    };
    img.src = poster;
  }, [poster]);

  // ── thumbnail seek preview ───────────────────────────────────
  function updateThumb(time) {
    const tv = thumbVideoRef.current;
    if (!tv || !src) return;
    if (!tv.src) { tv.src = src; tv.preload = "metadata"; }
    clearTimeout(thumbTimer.current);
    thumbTimer.current = setTimeout(() => {
      tv.currentTime = time;
    }, 80);
  }

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
          if (showSubPanel) { setShowSubPanel(false); return; }
          if (showEps)      { setShowEps(false);   return; }
          if (endOverlay)   { setEndOverlay(false); return; }
          if (showSpeed)    { setShowSpeed(false);  return; }
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
          setSkipRipple({ dir: "back", key: Date.now() }); setTimeout(() => setSkipRipple(null), 700);
          revealControls(); break;
        case "ArrowRight":
          e.preventDefault();
          v.currentTime = Math.min(v.duration || 0, v.currentTime + 10);
          setSkipRipple({ dir: "fwd", key: Date.now() }); setTimeout(() => setSkipRipple(null), 700);
          revealControls(); break;
        case "ArrowUp":   e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); persistVolume(v.volume); break;
        case "ArrowDown": e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); persistVolume(v.volume); break;
        case "n": case "N": if (onNext) onNext(); break;
        default: break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onNext, revealControls, endOverlay, showSpeed, showEps, showSubPanel]);

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
    const hoverTime = ratio * duration;
    setSeekTooltip({ x: e.clientX - rect.left, time: hoverTime });
    updateThumb(hoverTime);
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
    const dir = sec > 0 ? "fwd" : "back";
    const key = Date.now();
    setSkipFlash(null);
    setSkipRipple({ dir, key });
    setTimeout(() => setSkipRipple(null), 700);
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

  // ── online subtitle search ───────────────────────────────────
  function openSubPanel() {
    setShowSubPanel(true);
    if (subResults.length === 0 && !subLoading) doSubSearch();
  }
  async function doSubSearch(keyOverride) {
    const key = keyOverride ?? osKey;
    if (!title && !tmdbId) return;
    setSubLoading(true); setSubError(""); setSubResults([]);
    try {
      const results = await searchSubtitles({
        query: title,
        tmdbId: tmdbId || undefined,
        season: seasonNum || undefined,
        episode: episodeNum || undefined,
        apiKey: key,
      });
      setSubResults(results);
      if (results.length === 0) setSubError("No subtitles found for this title.");
    } catch (err) {
      setSubError("Search failed. Check your internet connection.");
    } finally {
      setSubLoading(false);
    }
  }
  async function downloadSub(item) {
    if (!item.fileId) { setSubError("No download link for this subtitle."); return; }
    setSubError("");

    // check cache first — no API call needed
    const cached = getCachedSub(item.fileId);
    if (cached) {
      const lname = (cached.fileName || "").toLowerCase();
      const parsed = lname.endsWith(".vtt") ? parseVTT(cached.text) : parseSRT(cached.text);
      if (parsed.length) { setSubs(parsed); setShowSubPanel(false); return; }
    }

    setSubDownloading(item.id);
    try {
      const { text, name } = await fetchSubtitleText(item.fileId, osKey);
      const lname = (name || "").toLowerCase();
      const parsed = lname.endsWith(".vtt") ? parseVTT(text) : parseSRT(text);
      if (!parsed.length) throw new Error("Could not parse subtitle");
      setCachedSub(item.fileId, text, name); // save to cache
      setSubs(parsed);
      setShowSubPanel(false);
    } catch {
      setSubError("Download failed. Try another subtitle.");
    } finally {
      setSubDownloading(null);
    }
  }

  const pct     = seekDrag !== null ? seekDrag * 100 : duration ? (current / duration) * 100 : 0;
  const bufPct  = duration ? (buffered / duration) * 100 : 0;
  const volPct  = muted ? 0 : volume * 100;
  const pipSupported = document.pictureInPictureEnabled;

  // chapter markers every 10 min, skip first and last
  const chapterMarkers = duration > 600
    ? Array.from({ length: Math.floor(duration / 600) - 1 }, (_, i) => ((i + 1) * 600 / duration) * 100)
    : [];

  // spinner ring progress — circumference for r=20 circle = ~125.6
  const spinCirc = 125.6;
  const spinDash = bufPct ? spinCirc * (bufPct / 100) : 0;

  // filtered subtitle results — sorted by downloads already
  const subCache = loadSubCache();
  const filteredSubs = (subLangFilter === "all" ? subResults : subResults.filter(r => r.lang === subLangFilter))
    .map(r => ({ ...r, cached: !!subCache[r.fileId] }))
    .sort((a, b) => (b.cached ? 1 : 0) - (a.cached ? 1 : 0) || b.downloads - a.downloads);
  // langs sorted by total downloads descending so most useful come first
  const subLangCounts = subResults.reduce((acc, r) => {
    acc[r.lang] = (acc[r.lang] || 0) + 1;
    return acc;
  }, {});
  const subLangs = Object.keys(subLangCounts).sort((a, b) => subLangCounts[b] - subLangCounts[a]);

  return (
    <>
      {/* cinematic page dim */}
      {cinematic && <div className="vp-cinematic-dim" onClick={onClose} />}

      {/* hidden thumbnail video — no crossOrigin, FTP has no CORS */}
      <video
        ref={thumbVideoRef}
        style={{ display: "none" }}
        preload="metadata"
        muted
        playsInline
        onSeeked={() => {
          const tv = thumbVideoRef.current;
          if (!tv) return;
          try {
            const c = document.createElement("canvas");
            c.width = 160; c.height = 90;
            c.getContext("2d").drawImage(tv, 0, 0, 160, 90);
            setThumbDataUrl(c.toDataURL("image/jpeg", 0.7));
          } catch { setThumbDataUrl(null); }
        }}
      />

      <div
        className={`vp-overlay${cinematic ? " vp-cinematic" : ""}`}
        style={{ "--glow": glowColor }}
      >
        <div className="vp-modal vp-modal--glow">

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
                <button className="vp-close" onClick={onClose} aria-label="Close">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
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

            {/* watermark */}
            <div className="vp-watermark">
              <div className="vp-watermark-icon">A</div>
              <span className="vp-watermark-name">Ariful</span>
            </div>

            {/* subtitle overlay */}
            {subLine && (
              <div className="vp-subtitle-overlay">
                {subLine.split("\n").map((line, i) => <span key={i}>{line}<br /></span>)}
              </div>
            )}

            {/* spinner with buffer arc */}
            {waiting && !endOverlay && (
              <div className="vp-spinner">
                <svg className="vp-spin-svg" viewBox="0 0 48 48">
                  <circle className="vp-spin-track" cx="24" cy="24" r="20" />
                  {bufPct > 0 && (
                    <circle
                      className="vp-spin-buf-arc"
                      cx="24" cy="24" r="20"
                      strokeDasharray={`${spinDash} ${spinCirc}`}
                      strokeDashoffset="0"
                    />
                  )}
                  <circle className="vp-spin-arc" cx="24" cy="24" r="20" />
                </svg>
              </div>
            )}

            {/* skip ripple */}
            {skipRipple && (
              <div key={skipRipple.key} className={`vp-ripple vp-ripple--${skipRipple.dir}`}>
                <div className="vp-ripple-ring" />
                <div className="vp-ripple-ring vp-ripple-ring--2" />
                <svg className="vp-ripple-icon" viewBox="0 0 24 24" fill="currentColor">
                  {skipRipple.dir === "fwd"
                    ? <path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
                    : <path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
                  }
                </svg>
                <span className="vp-ripple-label">{skipRipple.dir === "fwd" ? "+10s" : "-10s"}</span>
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
                  <button className="vp-ep-panel-close" onClick={() => setShowEps(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
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

            {/* ── SUBTITLE PANEL ── */}
            {showSubPanel && (
              <div className="vp-sub-panel" onClick={e => e.stopPropagation()}>
                <div className="vp-sub-panel-header">
                  <span className="vp-sub-panel-title">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>
                    Subtitles
                  </span>
                  <div className="vp-sub-panel-actions">
                    <label className="vp-sub-upload-btn" title="Upload subtitle file">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      Upload file
                      <input ref={subRef} type="file" accept=".srt,.vtt" onChange={e => { onSubFile(e); setShowSubPanel(false); }} style={{ display: "none" }} />
                    </label>
                    {subs.length > 0 && (
                      <button className="vp-sub-clear-btn" onClick={() => { setSubs([]); setSubLine(""); }} title="Clear subtitle">
                        Clear
                      </button>
                    )}
                    <button className="vp-ep-panel-close" onClick={() => setShowSubPanel(false)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </div>
                </div>

                {/* lang filter */}
                {subLangs.length > 0 && (
                  <div className="vp-sub-lang-bar">
                    <button
                      className={`vp-sub-lang-btn${subLangFilter === "all" ? " active" : ""}`}
                      onClick={() => setSubLangFilter("all")}
                    >All <span className="vp-sub-lang-count">{subResults.length}</span></button>
                    {subLangs.map(l => (
                      <button
                        key={l}
                        className={`vp-sub-lang-btn${subLangFilter === l ? " active" : ""}`}
                        onClick={() => setSubLangFilter(l)}
                      >
                        {LANG_FLAGS[l] || "🌐"} {LANG_NAMES[l] || l.toUpperCase()}
                        <span className="vp-sub-lang-count">{subLangCounts[l]}</span>
                      </button>
                    ))}
                  </div>
                )}

                <div className="vp-sub-list">
                  {subLoading && (
                    <div className="vp-sub-state">
                      <div className="vp-spin-ring" style={{ width: 28, height: 28 }} />
                      <span>Searching subtitles…</span>
                    </div>
                  )}
                  {!subLoading && subError && (
                    <div className="vp-sub-state vp-sub-error">
                      <span>{subError}</span>
                      <button className="vp-sub-retry" onClick={() => doSubSearch()}>Retry</button>
                    </div>
                  )}
                  {!subLoading && !subError && filteredSubs.length === 0 && subResults.length > 0 && (
                    <div className="vp-sub-state">
                      No {LANG_NAMES[subLangFilter] || subLangFilter} subtitles found.
                      <button className="vp-sub-retry" onClick={() => setSubLangFilter("all")}>Show all languages</button>
                    </div>
                  )}
                  {filteredSubs.map(item => (
                    <button
                      key={item.id}
                      className={`vp-sub-item${subDownloading === item.id ? " loading" : ""}${item.cached ? " cached" : ""}`}
                      onClick={() => downloadSub(item)}
                      disabled={subDownloading !== null}
                      title={item.cached ? "Cached — applies instantly" : "Click to download & apply"}
                    >
                      <span className="vp-sub-flag">{LANG_FLAGS[item.lang] || "🌐"}</span>
                      <div className="vp-sub-info">
                        <span className="vp-sub-name">
                          {item.releaseName}
                          {item.cached && <span className="vp-sub-cached-badge">⚡ cached</span>}
                        </span>
                        <span className="vp-sub-meta">
                          {LANG_NAMES[item.lang] || item.lang.toUpperCase()}
                          {item.hearingImpaired ? " · HI" : ""}
                          {item.fps ? ` · ${item.fps} fps` : ""}
                          {item.downloads > 0 ? ` · ↓ ${item.downloads.toLocaleString()}` : ""}
                        </span>
                      </div>
                      <span className="vp-sub-dl">
                        {subDownloading === item.id
                          ? <span className="vp-sub-spin" />
                          : item.cached
                          ? <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>
                          : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                        }
                      </span>
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
                    onMouseLeave={() => { setSeekTooltip(null); setThumbDataUrl(null); }}
                  >
                    {seekTooltip && (
                      <div className="vp-seek-tooltip" style={{ left: seekTooltip.x }}>
                        {thumbDataUrl && (
                          <img className="vp-thumb-preview" src={thumbDataUrl} alt="" />
                        )}
                        <span>{fmt(seekTooltip.time)}</span>
                      </div>
                    )}
                    <div className="vp-seek-buf"   style={{ width: `${bufPct}%` }} />
                    <div className="vp-seek-fill"  style={{ width: `${pct}%` }} />
                    <div className="vp-seek-thumb" style={{ left:  `${pct}%` }} />
                    {chapterMarkers.map(pos => (
                      <div key={pos} className="vp-chapter-mark" style={{ left: `${pos}%` }} />
                    ))}
                  </div>
                </div>

                {/* bottom bar */}
                <div className="vp-bar">
                  <div className="vp-bar-left">
                    {onPrev && (
                      <button className="vp-btn" onClick={onPrev} title="Previous episode">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
                      </button>
                    )}
                    <button className="vp-btn" onClick={() => skip(-10)} title="Rewind 10s (←)">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1L7 6l5 5V7c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/><text x="7" y="15" fontSize="5" fontWeight="bold" fill="currentColor">10</text></svg>
                    </button>
                    <button className="vp-btn vp-btn-play" onClick={togglePlay} title="Play / Pause (Space)">
                      {playing
                        ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                        : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                      }
                    </button>
                    <button className="vp-btn" onClick={() => skip(10)} title="Forward 10s (→)">
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 5V1l5 5-5 5V7c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/><text x="7" y="15" fontSize="5" fontWeight="bold" fill="currentColor">10</text></svg>
                    </button>
                    {onNext && (
                      <button className="vp-btn" onClick={onNext} title="Next episode (N)">
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zm2-8.14L11.03 12 8 14.14V9.86zM16 6h2v12h-2z"/></svg>
                      </button>
                    )}

                    <button className="vp-btn" onClick={toggleMute} title="Mute (M)">
                      {muted || volume === 0
                        ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3 3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06A8.99 8.99 0 0 0 17.73 18l2 2.03L21 18.76 5.24 3 4.27 3zM12 4 9.91 6.09 12 8.18V4z"/></svg>
                        : volume < 0.5
                        ? <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.5 12A4.5 4.5 0 0 0 16 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z"/></svg>
                        : <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                      }
                    </button>
                    <div ref={volRef} className="vp-vol-track" onMouseDown={onVolMouseDown} title="Volume">
                      <div className="vp-vol-fill"  style={{ width: `${volPct}%` }} />
                      <div className="vp-vol-thumb" style={{ left:  `${volPct}%` }} />
                    </div>

                    <span className="vp-time">{fmt(current)} / {fmt(duration)}</span>
                  </div>

                  <div className="vp-bar-right">
                    {episodes && (
                      <button
                        className={`vp-btn vp-btn-eps${showEps ? " active" : ""}`}
                        onClick={e => { e.stopPropagation(); setShowEps(v => !v); }}
                        title="Episodes (E)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
                      </button>
                    )}

                    <button
                      className={`vp-btn vp-btn-cc${showSubPanel ? " active" : ""}`}
                      onClick={e => { e.stopPropagation(); openSubPanel(); }}
                      title="Subtitles"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zM4 12h4v2H4v-2zm10 6H4v-2h10v2zm6 0h-4v-2h4v2zm0-4H10v-2h10v2z"/></svg>
                      {subs.length > 0 && <span className="vp-cc-dot" />}
                    </button>

                    <button
                      className={`vp-btn vp-btn-cinema${cinematic ? " active" : ""}`}
                      onClick={e => { e.stopPropagation(); setCinematic(v => !v); }}
                      title="Cinematic mode (C)"
                    >
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18 3v2h-2V3H8v2H6V3H4v18h2v-2h2v2h8v-2h2v2h2V3h-2zM8 17H6v-2h2v2zm0-4H6v-2h2v2zm0-4H6V7h2v2zm10 8h-2v-2h2v2zm0-4h-2v-2h2v2zm0-4h-2V7h2v2z"/></svg>
                    </button>

                    {pipSupported && (
                      <button
                        className={`vp-btn${pip ? " active" : ""}`}
                        onClick={e => { e.stopPropagation(); togglePip(); }}
                        title="Picture in Picture (P)"
                      >
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 11h-8v6h8v-6zm4 8V4.98C23 3.88 22.1 3 21 3H3c-1.1 0-2 .88-2 1.98V19c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2zm-2 .02H3V4.97h18v14.05z"/></svg>
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
