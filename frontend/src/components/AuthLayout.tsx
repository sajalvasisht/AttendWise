import React, {
  useRef,
  useState,
  useEffect,
  useCallback,
} from "react";
import { Outlet, useLocation } from "react-router-dom";
import {
  Calendar,
  BarChart2,
  TrendingUp,
  Sparkles,
} from "lucide-react";
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  AnimatePresence,
} from "framer-motion";
import { AttendWiseLogo } from "./AttendWiseLogo";

// ─────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const SESSION_KEY = "attendwise_intro_seen";

function hasSeenIntro(): boolean {
  try { return sessionStorage.getItem(SESSION_KEY) === "true"; } catch { return false; }
}
function markIntroSeen(): void {
  try { sessionStorage.setItem(SESSION_KEY, "true"); } catch { /* noop */ }
}

// ─────────────────────────────────────────────────────────
// Timing (ms)
//   0       – logo only on white
//   0→150   – logo scales in
//   150→450 – bg + badge + footer
//   450→750 – headline line 1, line 2
//   750→950 – subtext
//   950→1350 – cards spring in (staggered)
//   1350→   – card micro-content (count-up, progress, draw)
//   1500    – form panel slides in
//   2000    – all done → idle float + parallax enabled
// ─────────────────────────────────────────────────────────

// Idle float config: very slow sinusoidal drift — calming, alive
const FLOAT_VARIANTS = [
  // [yAmp, xAmp, rotAmp, duration, xDuration, rotDuration]
  [3, 1.5, 0.3, 14, 18, 22],   // Card 1 — Today's Schedule
  [2.5, 2, 0.4, 16, 20, 25],   // Card 2 — Attendance Summary
  [2, 1, 0.25, 18, 15, 20],    // Card 3 — Academic Calendar
  [3.5, 1.5, 0.35, 12, 17, 23], // Card 4 — Forecast
  [2, 2.5, 0.3, 15, 19, 21],   // Card 5 — AI Assistant
] as const;

const AuthLayout: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  const [introSeen] = useState(hasSeenIntro);

  // 0=pre, 1=logo, 2=background, 3=hero, 4=cards, 5=content, 7=idle
  const [phase, setPhase] = useState<number>(introSeen ? 7 : 0);

  const [attendancePercent, setAttendancePercent] = useState(
    introSeen ? 82.6 : 0
  );
  const [typedText, setTypedText] = useState(
    introSeen ? "Ask a question..." : ""
  );
  const [showCursor, setShowCursor] = useState(false);

  // ── Mouse parallax (spring-based, only active in phase 7) ───────────
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springCfg = { damping: 32, stiffness: 80, mass: 0.8 };
  const smX = useSpring(mouseX, springCfg);
  const smY = useSpring(mouseY, springCfg);

  const parallaxActive = phase >= 7;

  // Layer depths — intentionally subtle (max ±6px for cards, ±2px for bg)
  const bgX    = useTransform(smX, [-0.5, 0.5], [-2, 2]);
  const bgY    = useTransform(smY, [-0.5, 0.5], [-2, 2]);
  const badgeX = useTransform(smX, [-0.5, 0.5], [-3, 3]);
  const badgeY = useTransform(smY, [-0.5, 0.5], [-2, 2]);
  const heroX  = useTransform(smX, [-0.5, 0.5], [-4, 4]);
  const heroY  = useTransform(smY, [-0.5, 0.5], [-3, 3]);

  // Cards — staggered depths for natural layering
  const c1X = useTransform(smX, [-0.5, 0.5], [-5, 5]);
  const c1Y = useTransform(smY, [-0.5, 0.5], [-4, 4]);
  const c1R = useTransform(smX, [-0.5, 0.5], [-0.3, 0.3]);

  const c2X = useTransform(smX, [-0.5, 0.5], [-7, 7]);
  const c2Y = useTransform(smY, [-0.5, 0.5], [-6, 6]);
  const c2R = useTransform(smX, [-0.5, 0.5], [-0.4, 0.4]);

  const c3X = useTransform(smX, [-0.5, 0.5], [-4, 4]);
  const c3Y = useTransform(smY, [-0.5, 0.5], [-3, 3]);
  const c3R = useTransform(smX, [-0.5, 0.5], [-0.2, 0.2]);

  const c4X = useTransform(smX, [-0.5, 0.5], [-6, 6]);
  const c4Y = useTransform(smY, [-0.5, 0.5], [-5, 5]);
  const c4R = useTransform(smX, [-0.5, 0.5], [-0.35, 0.35]);

  const c5X = useTransform(smX, [-0.5, 0.5], [-5, 5]);
  const c5Y = useTransform(smY, [-0.5, 0.5], [-4, 4]);
  const c5R = useTransform(smX, [-0.5, 0.5], [-0.3, 0.3]);

  // ── Intro sequence ─────────────────────────────────────────────────
  useEffect(() => {
    if (introSeen) return;

    const timers: ReturnType<typeof setTimeout>[] = [];
    const at = (ms: number, fn: () => void) =>
      timers.push(setTimeout(fn, ms));

    at(0,    () => setPhase(1));  // logo appears
    at(150,  () => setPhase(2));  // bg / badge / footer
    at(450,  () => setPhase(3));  // hero text
    at(950,  () => setPhase(4));  // cards spring in
    at(1350, () => setPhase(5));  // card micro-content

    // Count-up attendance 0 → 82.6%
    at(1400, () => {
      const target = 82.6;
      const dur = 700;
      const t0 = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = p * (2 - p); // ease-out quad
        setAttendancePercent(parseFloat((eased * target).toFixed(1)));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    // Typewriter
    at(1500, () => {
      const text = "Ask a question...";
      let i = 0;
      setShowCursor(true);
      const id = setInterval(() => {
        i++;
        setTypedText(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(id);
          setTimeout(() => setShowCursor(false), 1000);
        }
      }, 46);
      timers.push(id as unknown as ReturnType<typeof setTimeout>);
    });

    // Finalise → idle state
    at(2000, () => {
      setPhase(7);
      markIntroSeen();
    });

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Mouse handlers ─────────────────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!parallaxActive || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      mouseX.set((e.clientX - r.left) / r.width - 0.5);
      mouseY.set((e.clientY - r.top) / r.height - 0.5);
    },
    [parallaxActive, mouseX, mouseY]
  );

  const handleMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

  // ── Derived booleans ────────────────────────────────────────────────
  const isIntro       = phase < 7;
  const showLogo      = phase >= 1;
  const showBg        = phase >= 2;
  const showBadge     = phase >= 2;
  const showFooter    = phase >= 2;
  const showHero      = phase >= 3;
  const showCards     = phase >= 4;
  const showContent   = phase >= 5;
  const isIdle        = phase >= 7;

  // ── Idle float helper — each card gets its own sinusoidal drift ─────
  // Returns Framer Motion `animate` keyframes for subtle continuous float.
  // We don't use CSS animation to avoid fighting Framer's transform system.
  const idleFloat = (cardIdx: number) => {
    const [yA, xA, rA] = FLOAT_VARIANTS[cardIdx];
    return {
      y: isIdle ? [0, -yA, 0, yA, 0] : 0,
      x: isIdle ? [0, xA, 0, -xA, 0] : 0,
      rotate: isIdle
        ? [
            cardIdx === 0 ? -3 : cardIdx === 1 ? 1 : cardIdx === 2 ? 2 : cardIdx === 3 ? -1 : 2,
            cardIdx === 0 ? (-3 + rA) : cardIdx === 1 ? (1 + rA) : cardIdx === 2 ? (2 + rA) : cardIdx === 3 ? (-1 + rA) : (2 + rA),
            cardIdx === 0 ? -3 : cardIdx === 1 ? 1 : cardIdx === 2 ? 2 : cardIdx === 3 ? -1 : 2,
            cardIdx === 0 ? (-3 - rA) : cardIdx === 1 ? (1 - rA) : cardIdx === 2 ? (2 - rA) : cardIdx === 3 ? (-1 - rA) : (2 - rA),
            cardIdx === 0 ? -3 : cardIdx === 1 ? 1 : cardIdx === 2 ? 2 : cardIdx === 3 ? -1 : 2,
          ]
        : undefined,
    };
  };

  const idleTransition = (cardIdx: number) => {
    const [, , , dur, xDur, rDur] = FLOAT_VARIANTS[cardIdx] as unknown as [number, number, number, number, number, number];
    return {
      y: { duration: dur, repeat: Infinity, ease: "easeInOut" as const },
      x: { duration: xDur, repeat: Infinity, ease: "easeInOut" as const },
      rotate: { duration: rDur, repeat: Infinity, ease: "easeInOut" as const },
    };
  };

  // Base resting rotations per card
  const BASE_ROT = [-3, 1, 2, -1, 2];


  // ──────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#fcfdfd] text-[#0f172a] antialiased font-sans selection:bg-emerald-100 selection:text-emerald-950">

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* LEFT PANEL — Storytelling                                      */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex lg:col-span-7 flex-col justify-between px-10 pt-8 pb-7 relative overflow-hidden bg-[#f8fafc] border-r border-zinc-200/50"
      >

        {/* Dotted grid — moves slightly with mouse */}
        <motion.div
          style={{ x: parallaxActive ? bgX : 0, y: parallaxActive ? bgY : 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: showBg ? 0.4 : 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none"
        />

        {/* ── Brand header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between z-10 w-full">

          {/* Logo mark — first thing users see */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{
              opacity: showLogo ? 1 : 0,
              scale: showLogo ? 1 : 0.85,
            }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center space-x-3"
          >
            <AttendWiseLogo size={36} bg="#0f172a" color="#ffffff" />
            <motion.span
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: showLogo ? 1 : 0, x: showLogo ? 0 : -6 }}
              transition={{ delay: 0.1, duration: 0.4, ease: "easeOut" }}
              className="text-sm font-semibold tracking-tight text-zinc-800"
            >
              AttendWise
            </motion.span>
          </motion.div>

          {/* Badge — parallax layer 2 */}
          <motion.div
            style={{ x: parallaxActive ? badgeX : 0, y: parallaxActive ? badgeY : 0 }}
            initial={{ opacity: 0, filter: "blur(8px)", y: -4 }}
            animate={{
              opacity: showBadge ? 1 : 0,
              filter: showBadge ? "blur(0px)" : "blur(8px)",
              y: showBadge ? 0 : -4,
            }}
            transition={{ delay: 0.1, duration: 0.55, ease: "easeOut" }}
            className="flex items-center space-x-1.5 bg-white border border-zinc-200/60 px-3 py-1 rounded-full shadow-[0_1px_3px_rgba(0,0,0,0.03)] text-[10px] text-zinc-500 font-medium"
          >
            <span className="text-emerald-500 font-bold">✦</span>
            <span>Designed for clarity. Built for students.</span>
          </motion.div>
        </div>

        {/* ── Hero copy + ecosystem ─────────────────────────────────────── */}
        <motion.div
          style={{ x: parallaxActive ? heroX : 0, y: parallaxActive ? heroY : 0 }}
          className="my-auto w-full max-w-2xl z-10 space-y-6 pt-3"
        >
          {/* Headline */}
          <div className="space-y-4 max-w-lg">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-[1.1] font-sans overflow-hidden">
              <motion.span
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: showHero ? "0%" : "110%", opacity: showHero ? 1 : 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="block"
              >
                Stay on top of
              </motion.span>
              <motion.span
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: showHero ? "0%" : "110%", opacity: showHero ? 1 : 0 }}
                transition={{ delay: 0.1, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                className="block text-emerald-600"
              >
                your semester.
              </motion.span>
            </h1>
            <motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: showHero ? 1 : 0, y: showHero ? 0 : 8 }}
              transition={{ delay: 0.22, duration: 0.5, ease: "easeOut" }}
              className="text-[11px] text-zinc-500 leading-relaxed max-w-sm font-medium"
            >
              Know exactly how many classes you can safely miss, forecast future
              percentages, and plan absences confidently.
            </motion.p>
          </div>

          {/* ── Floating cards ecosystem ─────────────────────────────────── */}
          <div className="relative h-[380px] w-full select-none">

            {/* CARD 1 — Today's Schedule */}
            <motion.div
              style={parallaxActive ? { x: c1X, y: c1Y, rotate: c1R } : {}}
              initial={{ opacity: 0, x: -160, y: 160, rotate: -14 }}
              animate={
                showCards
                  ? {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      rotate: BASE_ROT[0],
                      ...(isIdle ? idleFloat(0) : {}),
                    }
                  : {}
              }
              transition={
                isIdle
                  ? idleTransition(0)
                  : { type: "spring", damping: 22, stiffness: 55, delay: 0 }
              }
              whileHover={
                isIdle
                  ? { scale: 1.016, zIndex: 30, boxShadow: "0 16px 40px rgba(0,0,0,0.07)", transition: { duration: 0.2 } }
                  : undefined
              }
              className="absolute top-8 left-2 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_4px_24px_rgba(9,9,11,0.04)] space-y-4 cursor-default transform-gpu will-change-transform"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2.5">
                <div className="h-6 w-6 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-500">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Today's Schedule</span>
              </div>
              <div className="space-y-3">
                {[
                  { time: "09:00 AM", title: "Data Structures", room: "Room 301" },
                  { time: "11:00 AM", title: "Operating Systems", room: "Lab 2" },
                  { time: "02:00 PM", title: "Database Systems", room: "Room 205" },
                ].map((item, idx) => (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: showContent ? 1 : 0, x: showContent ? 0 : -6 }}
                    transition={{ delay: idx * 0.1, duration: 0.3, ease: "easeOut" }}
                    className="flex items-start space-x-2 text-[10px]"
                  >
                    <span className="text-zinc-400 font-mono shrink-0 w-14 pt-0.5">{item.time}</span>
                    <div className="border-l-2 border-indigo-200 pl-2">
                      <span className="font-bold text-zinc-800 block">{item.title}</span>
                      <span className="text-[9px] text-zinc-400">{item.room}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl py-1.5 text-center">
                <span className="text-[9px] font-bold text-indigo-600">3 Classes Today</span>
              </div>
            </motion.div>

            {/* CARD 2 — Attendance Summary (foreground, highest parallax) */}
            <motion.div
              style={parallaxActive ? { x: c2X, y: c2Y, rotate: c2R } : {}}
              initial={{ opacity: 0, x: 160, y: -160, rotate: 10 }}
              animate={
                showCards
                  ? {
                      opacity: 1,
                      x: 0,
                      y: 0,
                      rotate: BASE_ROT[1],
                      ...(isIdle ? idleFloat(1) : {}),
                    }
                  : {}
              }
              transition={
                isIdle
                  ? idleTransition(1)
                  : { type: "spring", damping: 20, stiffness: 48, delay: 0.12 }
              }
              whileHover={
                isIdle
                  ? { scale: 1.016, zIndex: 30, boxShadow: "0 16px 40px rgba(0,0,0,0.07)", transition: { duration: 0.2 } }
                  : undefined
              }
              className="absolute top-0 left-52 w-[244px] bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_4px_24px_rgba(9,9,11,0.04)] space-y-4 z-10 cursor-default transform-gpu will-change-transform"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <BarChart2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Attendance Summary</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <div className="space-y-3.5">
                <div className="flex items-baseline justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-zinc-400 uppercase tracking-wider block font-mono">Overall Attendance</span>
                    <span className="text-[22px] font-bold tracking-tight text-zinc-800 tabular-nums">
                      {attendancePercent.toFixed(1)}%
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                    Above Target
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-[9px] text-zinc-400 font-mono">
                    <span>Required: 75%</span>
                    <span>Today: 82.6%</span>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: "0%" }}
                      animate={{ width: showContent ? "82.6%" : "0%" }}
                      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
                {/* Sparkline */}
                <div className="pt-1 flex items-end justify-between h-10 relative">
                  <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                    <motion.path
                      d="M 10 30 Q 40 20 70 25 T 130 14 T 190 18 T 220 8"
                      fill="none" stroke="#10b981" strokeWidth="1.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: showContent ? 1 : 0, opacity: showContent ? 1 : 0 }}
                      transition={{ duration: 0.9, ease: "easeOut", delay: 0.1 }}
                    />
                    <motion.circle
                      cx="220" cy="8" r="2.5" fill="#10b981"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0 }}
                      transition={{ delay: 0.85, duration: 0.3 }}
                    />
                  </svg>
                  {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                    <span key={d + i} className={`text-[8px] font-bold font-mono px-1 rounded ${i === 2 ? "text-white bg-emerald-500" : "text-zinc-400"}`}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* CARD 3 — Academic Calendar */}
            <motion.div
              style={parallaxActive ? { x: c3X, y: c3Y, rotate: c3R } : {}}
              initial={{ opacity: 0, x: 200, scale: 0.9, rotate: 8 }}
              animate={
                showCards
                  ? {
                      opacity: 1,
                      x: 0,
                      scale: 1,
                      rotate: BASE_ROT[2],
                      ...(isIdle ? idleFloat(2) : {}),
                    }
                  : {}
              }
              transition={
                isIdle
                  ? idleTransition(2)
                  : { type: "spring", damping: 22, stiffness: 42, delay: 0.22 }
              }
              whileHover={
                isIdle
                  ? { scale: 1.016, zIndex: 30, boxShadow: "0 16px 40px rgba(0,0,0,0.07)", transition: { duration: 0.2 } }
                  : undefined
              }
              className="absolute top-6 right-2 w-[210px] bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_4px_24px_rgba(9,9,11,0.04)] space-y-3 cursor-default transform-gpu will-change-transform"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Academic Calendar</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-zinc-700 px-0.5">
                <span>May 2024</span>
                <div className="flex space-x-1 text-zinc-400"><span>‹</span><span>›</span></div>
              </div>
              <div className="grid grid-cols-7 gap-y-1.5 text-center text-[9px] font-medium text-zinc-400 font-mono">
                {DAYS_OF_WEEK.map((d) => <span key={d}>{d[0]}</span>)}
                {[
                  { val: "29", muted: true }, { val: "30", muted: true },
                  { val: "1" }, { val: "2" }, { val: "3" }, { val: "4" }, { val: "5" },
                  { val: "6" }, { val: "7" }, { val: "8" }, { val: "9" }, { val: "10" }, { val: "11" }, { val: "12" },
                  { val: "13" }, { val: "14" }, { val: "15" }, { val: "16" }, { val: "17" }, { val: "18" }, { val: "19" },
                  { val: "20" }, { val: "21" }, { val: "22", active: true },
                  { val: "23" }, { val: "24" }, { val: "25" }, { val: "26" },
                  { val: "27" }, { val: "28" }, { val: "29" }, { val: "30" }, { val: "31" },
                ].map((day, idx) => (
                  <motion.span
                    key={day.val + idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: showContent ? 1 : 0 }}
                    transition={{ delay: Math.floor(idx / 7) * 0.065, duration: 0.2 }}
                    className={
                      (day as any).active
                        ? "bg-emerald-500 text-white font-bold rounded-full h-4 w-4 flex items-center justify-center mx-auto shadow-[0_1px_4px_rgba(16,185,129,0.3)]"
                        : (day as any).muted
                        ? "text-zinc-300"
                        : "text-zinc-400"
                    }
                  >
                    {day.val}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* CARD 4 — Attendance Forecast */}
            <motion.div
              style={parallaxActive ? { x: c4X, y: c4Y, rotate: c4R } : {}}
              initial={{ opacity: 0, y: 220, rotate: -8 }}
              animate={
                showCards
                  ? {
                      opacity: 1,
                      y: 0,
                      rotate: BASE_ROT[3],
                      ...(isIdle ? idleFloat(3) : {}),
                    }
                  : {}
              }
              transition={
                isIdle
                  ? idleTransition(3)
                  : { type: "spring", damping: 20, stiffness: 50, delay: 0.32 }
              }
              whileHover={
                isIdle
                  ? { scale: 1.016, zIndex: 30, boxShadow: "0 16px 40px rgba(0,0,0,0.07)", transition: { duration: 0.2 } }
                  : undefined
              }
              className="absolute bottom-2 left-24 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_4px_24px_rgba(9,9,11,0.04)] space-y-3 cursor-default transform-gpu will-change-transform"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Attendance Forecast</span>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] text-zinc-400 font-medium">If you attend all upcoming classes</p>
                <div className="flex items-baseline space-x-1">
                  <motion.span
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: showContent ? 1 : 0, y: showContent ? 0 : 4 }}
                    transition={{ delay: 0.15, duration: 0.4, ease: "easeOut" }}
                    className="text-xl font-bold text-purple-600 tabular-nums"
                  >
                    87.4%
                  </motion.span>
                  <span className="text-[9px] text-zinc-400">at semester end</span>
                </div>
                <div className="h-8 w-full relative">
                  <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                    <motion.path
                      d="M 5 28 Q 50 24 90 14 T 170 8"
                      fill="none" stroke="#8b5cf6" strokeWidth="1.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: showContent ? 1 : 0, opacity: showContent ? 1 : 0 }}
                      transition={{ duration: 0.75, ease: "easeOut", delay: 0.05 }}
                    />
                    <motion.circle
                      cx="170" cy="8" r="2.5" fill="#8b5cf6"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: showContent ? 1 : 0, scale: showContent ? 1 : 0 }}
                      transition={{ delay: 0.7, duration: 0.3 }}
                    />
                  </svg>
                </div>
              </div>
            </motion.div>

            {/* CARD 5 — AI Assistant */}
            <motion.div
              style={parallaxActive ? { x: c5X, y: c5Y, rotate: c5R } : {}}
              initial={{ opacity: 0, y: 100, x: 40, rotate: 8 }}
              animate={
                showCards
                  ? {
                      opacity: 1,
                      y: 0,
                      x: 0,
                      rotate: BASE_ROT[4],
                      ...(isIdle ? idleFloat(4) : {}),
                    }
                  : {}
              }
              transition={
                isIdle
                  ? idleTransition(4)
                  : { type: "spring", damping: 18, stiffness: 55, delay: 0.42 }
              }
              whileHover={
                isIdle
                  ? { scale: 1.016, zIndex: 30, boxShadow: "0 16px 40px rgba(0,0,0,0.07)", transition: { duration: 0.2 } }
                  : undefined
              }
              className="absolute bottom-3 right-10 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_4px_24px_rgba(9,9,11,0.04)] space-y-3 cursor-default transform-gpu will-change-transform"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">AI Assistant</span>
              </div>
              <p className="text-[9px] text-zinc-400 font-medium">Ask anything about your schedule or attendance.</p>
              <div className="bg-zinc-50/80 border border-zinc-100 rounded-xl p-2.5 flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-500">
                  {typedText}
                  {showCursor && (
                    <motion.span
                      animate={{ opacity: [1, 0, 1] }}
                      transition={{ duration: 0.65, repeat: Infinity }}
                      className="ml-px inline-block w-px h-2.5 bg-zinc-400 align-middle"
                    />
                  )}
                  {!showCursor && !typedText && (
                    <span className="text-zinc-300">Ask a question...</span>
                  )}
                </span>
                <span className="text-amber-500 font-bold shrink-0">➔</span>
              </div>
            </motion.div>

          </div>
        </motion.div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: showFooter ? 1 : 0 }}
          transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
          className="flex items-center justify-between text-[9px] text-zinc-400 z-10 w-full pt-4 border-t border-zinc-200/30"
        >
          <span>© 2026 AttendWise. All rights reserved.</span>
          <div className="flex space-x-3.5">
            <span className="hover:text-zinc-600 cursor-pointer transition-colors duration-200">Privacy Policy</span>
            <span className="hover:text-zinc-600 cursor-pointer transition-colors duration-200">Terms of Service</span>
          </div>
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════ */}
      {/* RIGHT PANEL — Auth form                                        */}
      {/* ══════════════════════════════════════════════════════════════ */}
      <motion.div
        initial={isIntro ? { opacity: 0, x: 36 } : { opacity: 1, x: 0 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: isIntro ? 1.25 : 0, duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
        className="lg:col-span-5 flex flex-col items-center justify-center px-6 py-6 lg:px-10 bg-[#ffffff] relative border-l border-zinc-200/30"
      >
        <div className="w-full max-w-[420px] flex flex-col gap-3">

          {/* ── Premium auth card ───────────────────────────────────── */}
          <div
            className="w-full bg-white rounded-[28px] px-10 py-8"
            style={{
              border: "1px solid rgba(15,23,42,0.05)",
              boxShadow: "0 16px 48px rgba(15,23,42,0.04), 0 2px 8px rgba(15,23,42,0.02)",
            }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className="w-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </motion.div>

    </div>
  );
};

export default AuthLayout;

