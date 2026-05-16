"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── THEMES ───
const THEMES = {
  sepia: {
    key: "sepia",
    label: "Sépia",
    bg: "#F5F0E8",
    text: "#2C2418",
    textSoft: "rgba(44,36,24,0.5)",
    textMuted: "rgba(44,36,24,0.3)",
    accent: "#8B6914",
    accentGrad: "linear-gradient(135deg, #8B6914, #A67C00)",
    accentBg: "rgba(139,105,20,0.1)",
    accentBorder: "rgba(139,105,20,0.25)",
    surface: "rgba(44,36,24,0.04)",
    border: "rgba(44,36,24,0.08)",
    borderHover: "rgba(44,36,24,0.15)",
    controlBg: "rgba(44,36,24,0.05)",
    controlBorder: "rgba(44,36,24,0.1)",
    barBg: "rgba(245,240,232,0.94)",
    focusBand: "rgba(139,105,20,0.06)",
    focusBandEdge: "rgba(139,105,20,0.15)",
    btnText: "#F5F0E8",
    scrollThumb: "rgba(44,36,24,0.1)",
    rangeTrack: "rgba(44,36,24,0.1)",
  },
  light: {
    key: "light",
    label: "Clair",
    bg: "#FFFFFF",
    text: "#1A1A1A",
    textSoft: "rgba(26,26,26,0.5)",
    textMuted: "rgba(26,26,26,0.3)",
    accent: "#2563EB",
    accentGrad: "linear-gradient(135deg, #2563EB, #1D4ED8)",
    accentBg: "rgba(37,99,235,0.08)",
    accentBorder: "rgba(37,99,235,0.25)",
    surface: "rgba(0,0,0,0.03)",
    border: "rgba(0,0,0,0.08)",
    borderHover: "rgba(0,0,0,0.15)",
    controlBg: "rgba(0,0,0,0.04)",
    controlBorder: "rgba(0,0,0,0.1)",
    barBg: "rgba(255,255,255,0.94)",
    focusBand: "rgba(37,99,235,0.04)",
    focusBandEdge: "rgba(37,99,235,0.12)",
    btnText: "#FFFFFF",
    scrollThumb: "rgba(0,0,0,0.1)",
    rangeTrack: "rgba(0,0,0,0.1)",
  },
  dark: {
    key: "dark",
    label: "Sombre",
    bg: "#0C0C0E",
    text: "#E8E4DF",
    textSoft: "rgba(232,228,223,0.5)",
    textMuted: "rgba(232,228,223,0.25)",
    accent: "#C9A96E",
    accentGrad: "linear-gradient(135deg, #C9A96E, #A8863C)",
    accentBg: "rgba(201,169,110,0.12)",
    accentBorder: "rgba(201,169,110,0.25)",
    surface: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.06)",
    borderHover: "rgba(255,255,255,0.15)",
    controlBg: "rgba(255,255,255,0.06)",
    controlBorder: "rgba(255,255,255,0.1)",
    barBg: "rgba(12,12,14,0.92)",
    focusBand: "rgba(201,169,110,0.06)",
    focusBandEdge: "rgba(201,169,110,0.15)",
    btnText: "#0C0C0E",
    scrollThumb: "rgba(255,255,255,0.1)",
    rangeTrack: "rgba(255,255,255,0.1)",
  },
};

const SPEED_PRESETS = [
  { label: "Lent", value: 30 },
  { label: "Calme", value: 55 },
  { label: "Normal", value: 85 },
  { label: "Rapide", value: 130 },
  { label: "Turbo", value: 200 },
];

const MIN_SPEED = 10, MAX_SPEED = 300;
const MIN_FONT = 16, MAX_FONT = 64;
const MIN_WIDTH = 40, MAX_WIDTH = 100;

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const check = () => setM(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return m;
}

function loadFromStorage(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem("prompteur_" + key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function saveToStorage(key, value) {
  try { localStorage.setItem("prompteur_" + key, JSON.stringify(value)); } catch {}
}

export default function Prompteur() {
  const [rawText, setRawText] = useState("");
  const [view, setView] = useState("input");
  const [speed, setSpeed] = useState(85);
  const [fontSize, setFontSize] = useState(32);
  const [textWidth, setTextWidth] = useState(70);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [mirrorMode, setMirrorMode] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [themeKey, setThemeKey] = useState("sepia");
  const [showFocusBand, setShowFocusBand] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Voice / TTS state
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [voicePaused, setVoicePaused] = useState(false);
  const [voiceRate, setVoiceRate] = useState(1);
  const [voicePitch, setVoicePitch] = useState(1);
  const [voiceURI, setVoiceURI] = useState("");
  const [voices, setVoices] = useState([]);
  const [currentSentence, setCurrentSentence] = useState(-1);

  const isMobile = useIsMobile();
  const t = THEMES[themeKey] || THEMES.sepia;

  const scrollRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const speedRef = useRef(speed);
  const playingRef = useRef(false);
  const controlsTimerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0, t: 0 });
  const touchMoved = useRef(false);
  const sentenceIdxRef = useRef(0);
  const voiceEnabledRef = useRef(false);

  // Load saved prefs
  useEffect(() => {
    setThemeKey(loadFromStorage("theme", "sepia"));
    setSpeed(loadFromStorage("speed", 85));
    setFontSize(loadFromStorage("fontSize", 32));
    setTextWidth(loadFromStorage("textWidth", 70));
    setRawText(loadFromStorage("text", ""));
    setVoiceRate(loadFromStorage("voiceRate", 1));
    setVoicePitch(loadFromStorage("voicePitch", 1));
    setVoiceURI(loadFromStorage("voiceURI", ""));
    setMounted(true);
  }, []);

  // Save prefs
  useEffect(() => { if (mounted) saveToStorage("theme", themeKey); }, [themeKey, mounted]);
  useEffect(() => { if (mounted) saveToStorage("speed", speed); }, [speed, mounted]);
  useEffect(() => { if (mounted) saveToStorage("fontSize", fontSize); }, [fontSize, mounted]);
  useEffect(() => { if (mounted) saveToStorage("textWidth", textWidth); }, [textWidth, mounted]);
  useEffect(() => {
    if (!mounted) return;
    const debounce = setTimeout(() => saveToStorage("text", rawText), 1000);
    return () => clearTimeout(debounce);
  }, [rawText, mounted]);
  useEffect(() => { if (mounted) saveToStorage("voiceRate", voiceRate); }, [voiceRate, mounted]);
  useEffect(() => { if (mounted) saveToStorage("voicePitch", voicePitch); }, [voicePitch, mounted]);
  useEffect(() => { if (mounted) saveToStorage("voiceURI", voiceURI); }, [voiceURI, mounted]);

  // Register SW
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    if (isMobile && mounted) {
      setFontSize(f => Math.max(f, 24));
      if (textWidth < 85) setTextWidth(92);
    }
  }, [isMobile, mounted]);

  const paragraphs = rawText.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  const wordCount = rawText.split(/\s+/).filter(w => w.length > 0).length;
  const estMinutes = wordCount > 0 ? Math.ceil(wordCount / (speed * 2.8)) : 0;

  // Découpe le texte en phrases globales (avec index par paragraphe)
  const sentenceData = useMemo(() => {
    const all = [];
    const byParagraph = paragraphs.map((para) => {
      const parts = para.match(/[^.!?…]+[.!?…]+|[^.!?…]+$/g) || [para];
      return parts
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((text) => {
          const idx = all.length;
          all.push(text);
          return { text, idx };
        });
    });
    return { byParagraph, all };
  }, [rawText]);

  // Charge la liste des voix disponibles (Web Speech API)
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const load = () => {
      const list = window.speechSynthesis.getVoices();
      const fr = list.filter((v) => v.lang && v.lang.toLowerCase().startsWith("fr"));
      setVoices(fr.length > 0 ? fr : list);
    };
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { if (window.speechSynthesis) window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  useEffect(() => { voiceEnabledRef.current = voiceEnabled; }, [voiceEnabled]);

  // Animation
  const animate = useCallback((ts) => {
    if (!playingRef.current) return;
    if (!lastTimeRef.current) lastTimeRef.current = ts;
    const dt = ts - lastTimeRef.current;
    lastTimeRef.current = ts;
    if (scrollRef.current) {
      scrollRef.current.scrollTop += (speedRef.current * dt) / 1000;
      const el = scrollRef.current;
      if (el.scrollTop >= el.scrollHeight - el.clientHeight - 2) {
        playingRef.current = false;
        setIsPlaying(false);
        return;
      }
    }
    rafRef.current = requestAnimationFrame(animate);
  }, []);

  const play = useCallback(() => {
    if (!scrollRef.current) return;
    playingRef.current = true;
    setIsPlaying(true);
    lastTimeRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
  }, [animate]);

  const pause = useCallback(() => {
    playingRef.current = false;
    setIsPlaying(false);
    lastTimeRef.current = null;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }, []);

  const togglePlay = useCallback(() => {
    if (playingRef.current) pause(); else play();
  }, [play, pause]);

  // ─── VOICE / TTS ───
  const scrollToSentence = useCallback((idx) => {
    if (!scrollRef.current) return;
    const el = scrollRef.current.querySelector(`[data-sentence="${idx}"]`);
    if (!el) return;
    const container = scrollRef.current;
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const targetTop = container.scrollTop + (elRect.top - containerRect.top) - containerRect.height * 0.38;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, []);

  const speakSentence = useCallback((idx) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (!voiceEnabledRef.current) return;
    const list = sentenceData.all;
    if (idx >= list.length) {
      voiceEnabledRef.current = false;
      setVoiceEnabled(false);
      setVoicePaused(false);
      setCurrentSentence(-1);
      return;
    }
    const u = new SpeechSynthesisUtterance(list[idx]);
    u.lang = "fr-FR";
    u.rate = voiceRate;
    u.pitch = voicePitch;
    if (voiceURI) {
      const v = window.speechSynthesis.getVoices().find((vv) => vv.voiceURI === voiceURI);
      if (v) u.voice = v;
    }
    u.onstart = () => {
      setCurrentSentence(idx);
      scrollToSentence(idx);
    };
    u.onend = () => {
      if (!voiceEnabledRef.current) return;
      sentenceIdxRef.current = idx + 1;
      speakSentence(idx + 1);
    };
    u.onerror = () => {
      if (!voiceEnabledRef.current) return;
      sentenceIdxRef.current = idx + 1;
      speakSentence(idx + 1);
    };
    window.speechSynthesis.speak(u);
  }, [sentenceData, voiceRate, voicePitch, voiceURI, scrollToSentence]);

  const stopVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    voiceEnabledRef.current = false;
    window.speechSynthesis.cancel();
    setVoiceEnabled(false);
    setVoicePaused(false);
    setCurrentSentence(-1);
  }, []);

  const startVoice = useCallback((fromIdx = 0) => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (sentenceData.all.length === 0) return;
    pause(); // stop le scroll automatique
    window.speechSynthesis.cancel();
    voiceEnabledRef.current = true;
    setVoiceEnabled(true);
    setVoicePaused(false);
    sentenceIdxRef.current = fromIdx;
    speakSentence(fromIdx);
  }, [pause, sentenceData, speakSentence]);

  const toggleVoicePause = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setVoicePaused(false);
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setVoicePaused(true);
    }
  }, []);

  const toggleVoice = useCallback(() => {
    if (voiceEnabledRef.current) stopVoice();
    else startVoice(Math.max(0, sentenceIdxRef.current));
  }, [startVoice, stopVoice]);

  // Stop la voix au démontage et quand on quitte le mode reader
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const resetScroll = useCallback(() => {
    pause();
    stopVoice();
    sentenceIdxRef.current = 0;
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [pause, stopVoice]);

  const cleanText = (mode) => {
    let txt = rawText;
    if (mode === "pdf") {
      txt = txt
        .replace(/\r\n/g, "\n")
        .replace(/(\S)-\n(\S)/g, "$1$2")
        .replace(/([^\n])\n([^\n\s])/g, "$1 $2")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/ {2,}/g, " ")
        .trim();
    } else if (mode === "spaces") {
      txt = txt.replace(/ {2,}/g, " ").replace(/\t/g, " ").trim();
    } else if (mode === "lines") {
      txt = txt.replace(/\n{3,}/g, "\n\n").trim();
    } else if (mode === "trim") {
      txt = txt.split("\n").map(l => l.trim()).join("\n").trim();
    }
    setRawText(txt);
  };

  const startReading = () => {
    if (wordCount === 0) return;
    setView("reader");
    setIsPlaying(false);
    playingRef.current = false;
    setShowSettings(false);
  };

  const backToInput = () => { pause(); stopVoice(); setView("input"); };

  // Toggle unifié : si voix active → pause/resume vocal, sinon → play/pause visuel
  const togglePlayOrVoice = useCallback(() => {
    if (voiceEnabledRef.current) toggleVoicePause();
    else togglePlay();
  }, [togglePlay, toggleVoicePause]);

  const flashControls = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    controlsTimerRef.current = setTimeout(() => {
      if (playingRef.current) setShowControls(false);
    }, 3500);
  }, []);

  // Keyboard
  useEffect(() => {
    if (view !== "reader") return;
    const handler = (e) => {
      flashControls();
      if (e.code === "Space") { e.preventDefault(); togglePlayOrVoice(); }
      if (e.code === "KeyV") { e.preventDefault(); toggleVoice(); }
      if (e.code === "ArrowUp") { e.preventDefault(); setSpeed(s => Math.min(MAX_SPEED, s + 10)); }
      if (e.code === "ArrowDown") { e.preventDefault(); setSpeed(s => Math.max(MIN_SPEED, s - 10)); }
      if (e.code === "ArrowLeft") { e.preventDefault(); pause(); if (scrollRef.current) scrollRef.current.scrollTop -= 200; }
      if (e.code === "ArrowRight") { e.preventDefault(); pause(); if (scrollRef.current) scrollRef.current.scrollTop += 200; }
      if (e.code === "KeyR") resetScroll();
      if (e.code === "Escape") backToInput();
      if (e.code === "Equal" || e.code === "BracketRight") { e.preventDefault(); setFontSize(f => Math.min(MAX_FONT, f + 2)); }
      if (e.code === "Minus" || e.code === "BracketLeft") { e.preventDefault(); setFontSize(f => Math.max(MIN_FONT, f - 2)); }
      if (e.code === "KeyM") setMirrorMode(m => !m);
      if (e.code === "KeyT") setThemeKey(k => k === "sepia" ? "light" : k === "light" ? "dark" : "sepia");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [view, togglePlay, togglePlayOrVoice, toggleVoice, flashControls, pause, resetScroll]);

  useEffect(() => { if (view === "reader") flashControls(); }, [view, flashControls]);
  useEffect(() => {
    if (view !== "reader" || isMobile) return;
    const h = () => flashControls();
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, [view, isMobile, flashControls]);

  // Touch
  const onTouchStart = (e) => {
    touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
    touchMoved.current = false;
    flashControls();
  };
  const onTouchMove = () => { touchMoved.current = true; };
  const onTouchEnd = (e) => {
    if (showSettings) return;
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x;
    const dy = e.changedTouches[0].clientY - touchStartRef.current.y;
    const dt = Date.now() - touchStartRef.current.t;
    if (!touchMoved.current || (Math.abs(dx) < 15 && Math.abs(dy) < 15)) {
      togglePlayOrVoice(); return;
    }
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 60 && dt < 400) {
      if (dx > 0) setSpeed(s => Math.max(MIN_SPEED, s - 15));
      else setSpeed(s => Math.min(MAX_SPEED, s + 15));
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (controlsTimerRef.current) clearTimeout(controlsTimerRef.current);
    };
  }, []);

  const [progress, setProgress] = useState(0);
  const getProgress = () => {
    if (!scrollRef.current) return 0;
    const el = scrollRef.current;
    const max = el.scrollHeight - el.clientHeight;
    return max <= 0 ? 0 : (el.scrollTop / max) * 100;
  };
  useEffect(() => {
    if (view !== "reader") return;
    const iv = setInterval(() => setProgress(getProgress()), 200);
    return () => clearInterval(iv);
  }, [view]);

  if (!mounted) return null;

  // ─── Shared button styles ───
  const touchBtn = {
    background: t.controlBg,
    border: `1px solid ${t.controlBorder}`,
    color: t.textSoft,
    minWidth: "44px", height: "44px",
    borderRadius: "10px",
    fontSize: "16px", fontWeight: 600,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'DM Sans', sans-serif",
    padding: "0 10px",
  };
  const smBtn = {
    ...touchBtn,
    minWidth: "28px", height: "28px",
    borderRadius: "6px", fontSize: "12px",
    padding: "0",
  };
  const btn = isMobile ? touchBtn : smBtn;

  // ─── INPUT VIEW ───
  if (view === "input") {
    return (
      <div style={{ background: t.bg, color: t.text, minHeight: "100vh", touchAction: "manipulation" }}>
        <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
          {/* Header */}
          <div style={{
            padding: isMobile ? "16px 16px 12px" : "20px 28px 16px",
            borderBottom: `1px solid ${t.border}`,
            display: "flex",
            alignItems: isMobile ? "flex-start" : "center",
            justifyContent: "space-between",
            flexDirection: isMobile ? "column" : "row",
            gap: isMobile ? "8px" : "0",
            flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <h1 style={{
                fontFamily: "'Literata', Georgia, serif",
                fontSize: isMobile ? "20px" : "22px",
                fontWeight: 700, margin: 0, letterSpacing: "-0.02em",
              }}>Prompteur</h1>
              <span style={{ fontSize: "12px", color: t.textMuted, fontWeight: 500 }}>lecture fluide</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {wordCount > 0 && (
                <span style={{ fontSize: "12px", color: t.textSoft }}>
                  {wordCount.toLocaleString()} mots · ~{estMinutes} min
                </span>
              )}
              {/* Theme switcher */}
              <div style={{ display: "flex", gap: "3px" }}>
                {Object.values(THEMES).map(th => (
                  <button key={th.key} onClick={() => setThemeKey(th.key)} style={{
                    width: isMobile ? "36px" : "28px", height: isMobile ? "36px" : "28px",
                    borderRadius: "8px",
                    background: th.bg,
                    border: `2px solid ${themeKey === th.key ? th.accent : th.border}`,
                    cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "10px", color: th.text, fontWeight: 600,
                  }} title={th.label}>
                    {th.label[0]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Textarea */}
          <div style={{ flex: 1, padding: isMobile ? "12px" : "20px 28px", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={"Collez votre texte ici...\n\nUn chapitre, un article, un essai.\nLe texte défilera comme un prompteur."}
              style={{
                flex: 1, width: "100%",
                background: t.surface,
                border: `1px solid ${t.border}`,
                borderRadius: "12px",
                color: t.text,
                fontFamily: "'Literata', Georgia, serif",
                fontSize: isMobile ? "15px" : "16px",
                lineHeight: 1.8,
                padding: isMobile ? "16px" : "24px",
                resize: "none", outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = t.borderHover}
              onBlur={(e) => e.target.style.borderColor = t.border}
            />
            {/* Text cleanup toolbar */}
            {wordCount > 0 && (
              <div style={{
                display: "flex", gap: isMobile ? "6px" : "6px", flexWrap: "wrap",
                paddingTop: "8px", alignItems: "center",
              }}>
                <span style={{ ...labelStyle(t), marginRight: "2px" }}>Nettoyer</span>
                {[
                  { id: "pdf", label: "PDF (auto)", tip: "Corrige les retours a la ligne du copier-coller PDF" },
                  { id: "spaces", label: "Espaces", tip: "Supprime les espaces en double" },
                  { id: "lines", label: "Lignes vides", tip: "Fusionne les lignes vides en exces" },
                  { id: "trim", label: "Trim", tip: "Supprime les espaces en debut/fin de ligne" },
                ].map(c => (
                  <button key={c.id} onClick={() => cleanText(c.id)} title={c.tip} style={{
                    background: t.controlBg, border: `1px solid ${t.controlBorder}`,
                    color: t.textSoft, padding: isMobile ? "8px 12px" : "4px 10px",
                    borderRadius: isMobile ? "8px" : "6px",
                    fontSize: isMobile ? "13px" : "11px", fontWeight: 600, cursor: "pointer",
                  }}>{c.label}</button>
                ))}
                <button onClick={() => setRawText("")} style={{
                  background: "transparent", border: `1px solid ${t.controlBorder}`,
                  color: t.textMuted, padding: isMobile ? "8px 12px" : "4px 10px",
                  borderRadius: isMobile ? "8px" : "6px",
                  fontSize: isMobile ? "13px" : "11px", fontWeight: 600, cursor: "pointer",
                  marginLeft: "auto",
                }}>Effacer tout</button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div style={{
            padding: isMobile ? "12px" : "16px 28px",
            borderTop: `1px solid ${t.border}`,
            display: "flex", flexDirection: "column", gap: "12px", flexShrink: 0,
          }}>
            {/* Speed presets */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <label style={labelStyle(t)}>Vitesse</label>
              <div style={{ display: "flex", gap: isMobile ? "6px" : "4px", flexWrap: "wrap" }}>
                {SPEED_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setSpeed(p.value)} style={{
                    background: speed === p.value ? t.accentBg : "transparent",
                    border: `1px solid ${speed === p.value ? t.accentBorder : t.controlBorder}`,
                    color: speed === p.value ? t.accent : t.textSoft,
                    padding: isMobile ? "10px 14px" : "5px 10px",
                    borderRadius: isMobile ? "10px" : "6px",
                    fontSize: isMobile ? "14px" : "11px",
                    fontWeight: 600, cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}>{p.label}</button>
                ))}
              </div>
              <span style={{ fontSize: "13px", fontWeight: 700, color: t.accent }}>{speed} px/s</span>
            </div>

            {/* Size slider */}
            <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <label style={labelStyle(t)}>Taille</label>
                <input type="range" min={MIN_FONT} max={MAX_FONT} value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={{ width: isMobile ? "100px" : "80px", accentColor: t.accent, background: t.rangeTrack }} />
                <span style={{ fontSize: "12px", color: t.textSoft }}>{fontSize}px</span>
              </div>
              {!isMobile && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={labelStyle(t)}>Largeur</label>
                  <input type="range" min={MIN_WIDTH} max={MAX_WIDTH} value={textWidth}
                    onChange={(e) => setTextWidth(Number(e.target.value))}
                    style={{ width: "70px", accentColor: t.accent, background: t.rangeTrack }} />
                  <span style={{ fontSize: "12px", color: t.textSoft }}>{textWidth}%</span>
                </div>
              )}
            </div>

            <button onClick={startReading} disabled={wordCount === 0} style={{
              width: "100%",
              padding: isMobile ? "16px" : "12px 32px",
              borderRadius: isMobile ? "12px" : "8px",
              fontSize: isMobile ? "16px" : "14px",
              fontWeight: 700, letterSpacing: "0.03em",
              border: "none",
              background: wordCount > 0 ? t.accentGrad : t.controlBg,
              color: wordCount > 0 ? t.btnText : t.textMuted,
              cursor: wordCount > 0 ? "pointer" : "default",
              fontFamily: "'DM Sans', sans-serif",
              transition: "all 0.2s",
            }}>Lancer la lecture ▸</button>
          </div>
        </div>
      </div>
    );
  }

  // ─── READER VIEW ───
  const mfs = isMobile ? Math.max(fontSize, 22) : fontSize;
  const mtw = isMobile ? Math.max(textWidth, 88) : textWidth;

  return (
    <div style={{ background: t.bg, color: t.text, minHeight: "100vh", touchAction: "manipulation" }}>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", position: "relative", overflow: "hidden" }}>

        {/* Focus band */}
        {showFocusBand && <div style={{
          position: "absolute",
          top: isMobile ? "28%" : "38%",
          left: "50%", transform: "translateX(-50%)",
          width: `${mtw + 4}%`, maxWidth: "920px",
          height: `${mfs * 1.9}px`,
          background: `linear-gradient(180deg, transparent 0%, ${t.focusBand} 25%, ${t.focusBand} 75%, transparent 100%)`,
          borderLeft: `2px solid ${t.focusBandEdge}`,
          borderRight: `2px solid ${t.focusBandEdge}`,
          pointerEvents: "none", zIndex: 2,
        }} />}

        {/* Top bar */}
        <div style={{
          padding: isMobile ? "10px 12px" : "10px 20px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0, zIndex: 10,
          background: t.barBg, backdropFilter: "blur(12px)",
          opacity: showControls ? 1 : 0,
          transform: showControls ? "translateY(0)" : "translateY(-100%)",
          transition: "opacity 0.4s, transform 0.4s",
          minHeight: isMobile ? "52px" : "auto",
        }}>
          <button onClick={backToInput} style={{
            background: "none", border: "none",
            color: t.textSoft, cursor: "pointer", fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: isMobile ? "15px" : "13px",
            padding: isMobile ? "10px 14px" : "4px 8px",
            minHeight: isMobile ? "44px" : "auto",
          }}>← Texte</button>

          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "12px" }}>
            {/* Speed */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <button onClick={() => setSpeed(s => Math.max(MIN_SPEED, s - 10))} style={btn}>−</button>
              <span style={{ fontSize: isMobile ? "15px" : "13px", fontWeight: 700, color: t.accent, minWidth: "35px", textAlign: "center" }}>{speed}</span>
              <button onClick={() => setSpeed(s => Math.min(MAX_SPEED, s + 10))} style={btn}>+</button>
            </div>
            <div style={{ width: "1px", height: "16px", background: t.border }} />
            {/* Theme toggle quick */}
            <div style={{ display: "flex", gap: "2px" }}>
              {Object.values(THEMES).map(th => (
                <button key={th.key} onClick={() => setThemeKey(th.key)} style={{
                  width: isMobile ? "32px" : "24px",
                  height: isMobile ? "32px" : "24px",
                  borderRadius: "6px",
                  background: th.bg,
                  border: `2px solid ${themeKey === th.key ? th.accent : "transparent"}`,
                  cursor: "pointer",
                }} />
              ))}
            </div>
            <div style={{ width: "1px", height: "16px", background: t.border }} />
            <button onClick={toggleVoice} title="Lecture à haute voix (V)" style={{
              ...btn,
              background: voiceEnabled ? t.accentBg : t.controlBg,
              color: voiceEnabled ? t.accent : t.textSoft,
              fontSize: isMobile ? "18px" : "14px",
            }}>🔊</button>
            <button onClick={() => setShowSettings(p => !p)} style={{
              ...btn,
              background: showSettings ? t.accentBg : t.controlBg,
              color: showSettings ? t.accent : t.textSoft,
              fontSize: isMobile ? "18px" : "14px",
            }}>⚙</button>
          </div>
        </div>

        {/* Settings drawer */}
        {showSettings && showControls && (
          <div style={{
            padding: isMobile ? "16px" : "12px 24px",
            borderBottom: `1px solid ${t.border}`,
            background: t.barBg, backdropFilter: "blur(12px)",
            zIndex: 9, display: "flex", flexDirection: "column",
            gap: isMobile ? "18px" : "14px", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Vitesse</span>
              <input type="range" min={MIN_SPEED} max={MAX_SPEED} step={5} value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                style={{ flex: 1, maxWidth: "300px", accentColor: t.accent, background: t.rangeTrack }} />
              <span style={{ fontSize: "14px", fontWeight: 700, color: t.accent }}>{speed} px/s</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Taille</span>
              <button onClick={() => setFontSize(f => Math.max(MIN_FONT, f - 2))} style={btn}>A−</button>
              <input type="range" min={MIN_FONT} max={MAX_FONT} value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{ flex: 1, maxWidth: "250px", accentColor: t.accent, background: t.rangeTrack }} />
              <button onClick={() => setFontSize(f => Math.min(MAX_FONT, f + 2))} style={btn}>A+</button>
              <span style={{ fontSize: "12px", color: t.textSoft }}>{fontSize}px</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Largeur</span>
              <input type="range" min={MIN_WIDTH} max={MAX_WIDTH} value={textWidth}
                onChange={(e) => setTextWidth(Number(e.target.value))}
                style={{ flex: 1, maxWidth: "250px", accentColor: t.accent, background: t.rangeTrack }} />
              <span style={{ fontSize: "12px", color: t.textSoft }}>{textWidth}%</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Miroir</span>
              <button onClick={() => setMirrorMode(m => !m)} style={{
                ...btn, width: "auto", padding: isMobile ? "10px 20px" : "6px 14px",
                background: mirrorMode ? t.accentBg : t.controlBg,
                color: mirrorMode ? t.accent : t.textSoft,
              }}>{mirrorMode ? "ON" : "OFF"}</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Repère</span>
              <button onClick={() => setShowFocusBand(b => !b)} style={{
                ...btn, width: "auto", padding: isMobile ? "10px 20px" : "6px 14px",
                background: showFocusBand ? t.accentBg : t.controlBg,
                color: showFocusBand ? t.accent : t.textSoft,
              }}>{showFocusBand ? "ON" : "OFF"}</button>
            </div>

            {/* ─── Lecture vocale ─── */}
            <div style={{ height: "1px", background: t.border, margin: "4px 0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Voix</span>
              <button onClick={toggleVoice} style={{
                ...btn, width: "auto", padding: isMobile ? "10px 20px" : "6px 14px",
                background: voiceEnabled ? t.accentGrad : t.controlBg,
                color: voiceEnabled ? t.btnText : t.textSoft,
                border: voiceEnabled ? "none" : `1px solid ${t.controlBorder}`,
              }}>{voiceEnabled ? "🔊 Lire" : "🔇 Off"}</button>
              {voiceEnabled && (
                <button onClick={toggleVoicePause} style={{
                  ...btn, width: "auto", padding: isMobile ? "10px 20px" : "6px 14px",
                  background: t.controlBg, color: t.textSoft,
                }}>{voicePaused ? "▶ Reprendre" : "⏸ Pause"}</button>
              )}
            </div>
            {voices.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ ...labelStyle(t), minWidth: "55px" }}>Timbre</span>
                <select value={voiceURI} onChange={(e) => setVoiceURI(e.target.value)} style={{
                  flex: 1, maxWidth: "300px",
                  background: t.controlBg, border: `1px solid ${t.controlBorder}`,
                  color: t.text, borderRadius: "8px",
                  padding: isMobile ? "10px 12px" : "6px 10px",
                  fontSize: isMobile ? "14px" : "12px",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  <option value="">Auto (système)</option>
                  {voices.map((v) => (
                    <option key={v.voiceURI} value={v.voiceURI}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Débit</span>
              <input type="range" min={0.5} max={2} step={0.05} value={voiceRate}
                onChange={(e) => setVoiceRate(Number(e.target.value))}
                style={{ flex: 1, maxWidth: "250px", accentColor: t.accent, background: t.rangeTrack }} />
              <span style={{ fontSize: "12px", color: t.textSoft, minWidth: "36px" }}>{voiceRate.toFixed(2)}×</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ ...labelStyle(t), minWidth: "55px" }}>Hauteur</span>
              <input type="range" min={0.5} max={1.5} step={0.05} value={voicePitch}
                onChange={(e) => setVoicePitch(Number(e.target.value))}
                style={{ flex: 1, maxWidth: "250px", accentColor: t.accent, background: t.rangeTrack }} />
              <span style={{ fontSize: "12px", color: t.textSoft, minWidth: "36px" }}>{voicePitch.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Progress */}
        <div style={{ height: isMobile ? "4px" : "2px", background: t.border, flexShrink: 0, zIndex: 5 }}>
          <div style={{
            height: "100%", width: `${progress}%`,
            background: t.accentGrad, transition: "width 0.3s linear",
          }} />
        </div>

        {/* Scrollable text */}
        <div
          ref={scrollRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={!isMobile ? togglePlayOrVoice : undefined}
          onScroll={() => { if (!playingRef.current) setProgress(getProgress()); }}
          style={{ flex: 1, overflowY: "auto", cursor: "pointer", WebkitOverflowScrolling: "touch" }}
        >
          <div style={{ height: isMobile ? "28vh" : "38vh" }} />
          <div style={{
            width: `${mtw}%`, maxWidth: "880px", margin: "0 auto",
            padding: isMobile ? "0 16px" : "0 24px",
            transform: mirrorMode ? "scaleX(-1)" : "none",
          }}>
            {sentenceData.byParagraph.map((paraSentences, i) => (
              <p key={i} style={{
                fontFamily: "'Literata', Georgia, serif",
                fontSize: `${mfs}px`, fontWeight: 400,
                lineHeight: 1.85, color: t.text,
                marginBottom: `${mfs * 1.2}px`,
                textAlign: isMobile ? "left" : "justify",
                hyphens: "auto", letterSpacing: "-0.01em",
                wordBreak: "break-word",
              }}>
                {paraSentences.map((s, k) => {
                  const active = voiceEnabled && currentSentence === s.idx;
                  return (
                    <span
                      key={s.idx}
                      data-sentence={s.idx}
                      onClick={(e) => {
                        if (!voiceEnabled) return;
                        e.stopPropagation();
                        sentenceIdxRef.current = s.idx;
                        if (typeof window !== "undefined" && "speechSynthesis" in window) {
                          window.speechSynthesis.cancel();
                        }
                        speakSentence(s.idx);
                      }}
                      style={{
                        background: active ? t.accentBg : "transparent",
                        color: active ? t.accent : t.text,
                        borderRadius: "4px",
                        padding: active ? "2px 4px" : "0",
                        margin: active ? "-2px -4px" : "0",
                        transition: "background 0.25s, color 0.25s",
                        cursor: voiceEnabled ? "pointer" : "inherit",
                      }}
                    >{s.text}{k < paraSentences.length - 1 ? " " : ""}</span>
                  );
                })}
              </p>
            ))}
          </div>
          <div style={{ height: "75vh" }} />
        </div>

        {/* Bottom controls */}
        <div style={{
          padding: isMobile ? "10px 10px 6px" : "12px 24px 8px",
          borderTop: `1px solid ${t.border}`,
          flexShrink: 0, zIndex: 10,
          background: t.barBg, backdropFilter: "blur(12px)",
          opacity: showControls ? 1 : 0,
          transform: showControls ? "translateY(0)" : "translateY(100%)",
          transition: "opacity 0.4s, transform 0.4s",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: isMobile ? "6px" : "12px" }}>
            <CircleBtn t={t} isMobile={isMobile} onClick={resetScroll} title="Reset">
              <svg width={isMobile ? "18" : "15"} height={isMobile ? "18" : "15"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </CircleBtn>

            <CircleBtn t={t} isMobile={isMobile} onClick={() => { pause(); if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, scrollRef.current.scrollTop - 400); }}>
              <svg width={isMobile ? "18" : "15"} height={isMobile ? "18" : "15"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="19,20 9,12 19,4" /><line x1="5" y1="19" x2="5" y2="5" />
              </svg>
            </CircleBtn>

            <button onClick={togglePlayOrVoice} style={{
              background: t.accentGrad, border: "none", color: t.btnText,
              width: isMobile ? "60px" : "48px", height: isMobile ? "60px" : "48px",
              borderRadius: "50%", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {(voiceEnabled ? !voicePaused : isPlaying) ? (
                <svg width={isMobile ? "22" : "20"} height={isMobile ? "22" : "20"} viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width={isMobile ? "22" : "20"} height={isMobile ? "22" : "20"} viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6,4 20,12 6,20" />
                </svg>
              )}
            </button>

            <CircleBtn t={t} isMobile={isMobile} onClick={() => { pause(); if (scrollRef.current) scrollRef.current.scrollTop += 400; }}>
              <svg width={isMobile ? "18" : "15"} height={isMobile ? "18" : "15"} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5,4 15,12 5,20" /><line x1="19" y1="5" x2="19" y2="19" />
              </svg>
            </CircleBtn>

            <span style={{ fontSize: isMobile ? "13px" : "12px", color: t.textMuted, fontWeight: 500, minWidth: "28px", textAlign: "center" }}>
              {Math.round(progress)}%
            </span>

            <div
              style={{
                width: isMobile ? "80px" : "180px", height: isMobile ? "10px" : "6px",
                background: t.controlBg, borderRadius: "5px",
                cursor: "pointer", position: "relative",
              }}
              onClick={(e) => { e.stopPropagation(); jumpProgress(e.clientX, e.currentTarget); }}
              onTouchEnd={(e) => { e.stopPropagation(); if (e.changedTouches[0]) jumpProgress(e.changedTouches[0].clientX, e.currentTarget); }}
            >
              <div style={{
                position: "absolute", left: 0, top: 0, height: "100%",
                width: `${progress}%`, background: t.accent, borderRadius: "5px",
                transition: "width 0.3s",
              }} />
            </div>
          </div>

          {!isMobile && (
            <div style={{ display: "flex", justifyContent: "center", gap: "14px", paddingTop: "8px", paddingBottom: "4px" }}>
              {[["Espace", "lecture"], ["←→", "naviguer"], ["↑↓", "vitesse"], ["V", "voix"], ["T", "thème"], ["M", "miroir"], ["R", "reset"], ["Esc", "retour"]].map(([k, l]) => (
                <span key={k} style={{ fontSize: "10px", color: t.textMuted }}>
                  <kbd style={{ background: t.controlBg, padding: "1px 5px", borderRadius: "3px", fontSize: "10px", fontFamily: "'DM Sans'" }}>{k}</kbd> {l}
                </span>
              ))}
            </div>
          )}

          {isMobile && (
            <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
              <span style={{ fontSize: "11px", color: t.textMuted }}>
                Tap = pause · Swipe ← accélérer · Swipe → ralentir
              </span>
            </div>
          )}
        </div>

        {!isPlaying && (
          <div style={{
            position: "absolute", bottom: isMobile ? "130px" : "140px",
            left: "50%", transform: "translateX(-50%)",
            fontSize: isMobile ? "15px" : "13px", color: t.textMuted,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
            pointerEvents: "none", opacity: showControls ? 1 : 0,
            transition: "opacity 0.3s", textAlign: "center", padding: "0 24px", width: "100%",
          }}>
            {progress < 1 ? (isMobile ? "Appuyez pour commencer" : "Cliquez ou Espace pour commencer") :
              progress >= 99 ? "Fin." : "Pause"}
          </div>
        )}
      </div>
    </div>
  );

  function jumpProgress(clientX, el) {
    if (!scrollRef.current) return;
    const rect = el.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    pause();
    scrollRef.current.scrollTop = pct * (scrollRef.current.scrollHeight - scrollRef.current.clientHeight);
  }
}

function CircleBtn({ t, isMobile, onClick, children, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: "none",
      border: `1px solid ${t.controlBorder}`,
      color: t.textSoft,
      width: isMobile ? "50px" : "38px",
      height: isMobile ? "50px" : "38px",
      borderRadius: "50%", cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>{children}</button>
  );
}

function labelStyle(t) {
  return {
    fontSize: "11px", color: t.textSoft, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.06em", flexShrink: 0,
  };
}
