import React, { useRef, useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Calendar, BarChart2, TrendingUp, Sparkles, ShieldCheck } from "lucide-react";
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from "framer-motion";

const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const AuthLayout: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  // Intro animation visibility state - plays once per browser session
  const [isIntroActive, setIsIntroActive] = useState(() => {
    const flag = sessionStorage.getItem("attendwise_intro_seen");
    return flag !== "true";
  });

  // Track state for completion of Stages to enable interactive mouse parallax
  const [animationCompleted, setAnimationCompleted] = useState(() => {
    const flag = sessionStorage.getItem("attendwise_intro_seen");
    return flag === "true";
  });

  // Numeric count-up value for overall attendance card
  const [attendancePercent, setAttendancePercent] = useState(() => {
    const flag = sessionStorage.getItem("attendwise_intro_seen");
    return flag === "true" ? 82.6 : 0;
  });

  // AI assistant typed text placeholder state
  const [typedText, setTypedText] = useState("");

  // Mouse coordinate motion values for 3D parallax tilt
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springConfig = { damping: 28, stiffness: 90, mass: 0.7 };
  const smoothMouseX = useSpring(mouseX, springConfig);
  const smoothMouseY = useSpring(mouseY, springConfig);

  // Parallax translation mapping per card depth level (foreground, middle, background)
  // Foreground: Attendance Summary (~12px)
  const foregroundX = useTransform(smoothMouseX, [-0.5, 0.5], [-12, 12]);
  const foregroundY = useTransform(smoothMouseY, [-0.5, 0.5], [-12, 12]);
  const foregroundRotate = useTransform(smoothMouseX, [-0.5, 0.5], [-1, 3]);

  // Middle: Today's Schedule & Attendance Forecast (~8px)
  const middleX1 = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);
  const middleY1 = useTransform(smoothMouseY, [-0.5, 0.5], [-8, 8]);
  const middleRotate1 = useTransform(smoothMouseX, [-0.5, 0.5], [-5, -1]);

  const middleX2 = useTransform(smoothMouseX, [-0.5, 0.5], [-8, 8]);
  const middleY2 = useTransform(smoothMouseY, [-0.5, 0.5], [-8, 8]);
  const middleRotate2 = useTransform(smoothMouseX, [-0.5, 0.5], [-3, 1]);

  // Background: Academic Calendar (~5px)
  const backgroundX = useTransform(smoothMouseX, [-0.5, 0.5], [-5, 5]);
  const backgroundY = useTransform(smoothMouseY, [-0.5, 0.5], [-5, 5]);
  const backgroundRotate = useTransform(smoothMouseX, [-0.5, 0.5], [1, 5]);

  // Decorative element / AI Assistant (~2px)
  const assistantX = useTransform(smoothMouseX, [-0.5, 0.5], [-3, 3]);
  const assistantY = useTransform(smoothMouseY, [-0.5, 0.5], [-3, 3]);
  const assistantRotate = useTransform(smoothMouseX, [-0.5, 0.5], [0, 4]);

  useEffect(() => {
    if (!isIntroActive) return;

    // Trigger count-up animation for Stage 5 at 1.8s
    const countTimeout = setTimeout(() => {
      const target = 82.6;
      const duration = 800; // ms
      const startTime = performance.now();

      const updateCount = (now: number) => {
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Ease out quadratic
        const currentVal = progress * (2 - progress) * target;
        setAttendancePercent(parseFloat(currentVal.toFixed(1)));

        if (progress < 1) {
          requestAnimationFrame(updateCount);
        }
      };
      requestAnimationFrame(updateCount);
    }, 1800);

    // Trigger typewriter animation for Stage 5 AI Assistant at 1.8s
    const textToType = "Ask a question...";
    let charIndex = 0;
    const textTimeout = setTimeout(() => {
      const typeInterval = setInterval(() => {
        if (charIndex < textToType.length) {
          setTypedText(prev => prev + textToType.charAt(charIndex));
          charIndex++;
        } else {
          clearInterval(typeInterval);
        }
      }, 50);
      return () => clearInterval(typeInterval);
    }, 1900);

    // Conclude cinematic animation sequence at 2.2s
    const endTimeout = setTimeout(() => {
      setIsIntroActive(false);
      setAnimationCompleted(true);
      sessionStorage.setItem("attendwise_intro_seen", "true");
    }, 2200);

    return () => {
      clearTimeout(countTimeout);
      clearTimeout(textTimeout);
      clearTimeout(endTimeout);
    };
  }, [isIntroActive]);

  // Fallback for returning users to instantly populate static content
  useEffect(() => {
    if (!isIntroActive) {
      setAttendancePercent(82.6);
      setTypedText("Ask a question...");
    }
  }, [isIntroActive]);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!animationCompleted || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate normalized coordinate offset relative to center (-0.5 to 0.5)
    const x = (e.clientX - rect.left) / width - 0.5;
    const y = (e.clientY - rect.top) / height - 0.5;
    
    mouseX.set(x);
    mouseY.set(y);
  };

  const handleMouseLeave = () => {
    mouseX.set(0);
    mouseY.set(0);
  };

  // framer motion entrance transition variants (typed as any to bypass strict literal type checks)
  const stage1Brand: any = {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } }
  };

  const stage2Grid: any = {
    initial: { opacity: 0 },
    animate: { 
      opacity: 0.4, 
      transition: { delay: 0.3, duration: 0.4, ease: "easeOut" } 
    }
  };

  const stage2Badge: any = {
    initial: { opacity: 0, filter: "blur(6px)" },
    animate: { 
      opacity: 1, 
      filter: "blur(0px)", 
      transition: { delay: 0.3, duration: 0.4, ease: "easeOut" } 
    }
  };

  const stage2Footer: any = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { delay: 0.4, duration: 0.4 } }
  };

  const textLines: any = {
    initial: { opacity: 0, y: 12 },
    animate: (delay: number) => ({
      opacity: 1,
      y: 0,
      transition: { delay, duration: 0.45, ease: "easeOut" }
    })
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-[#fcfdfd] text-[#0f172a] antialiased font-sans selection:bg-emerald-100 selection:text-emerald-950">
      
      {/* LEFT STORYTELLING PANEL (7 columns) */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="hidden lg:flex lg:col-span-7 flex-col justify-between p-16 relative overflow-hidden bg-[#f8fafc] border-r border-zinc-200/50"
      >
        {/* Subtle grid pattern background */}
        <motion.div 
          variants={stage2Grid}
          initial={isIntroActive ? "initial" : "animate"}
          animate="animate"
          className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none" 
        />

        {/* Brand Header */}
        <div className="flex items-center justify-between z-10 w-full">
          <motion.div 
            variants={stage1Brand}
            initial={isIntroActive ? "initial" : "animate"}
            animate="animate"
            className="flex items-center space-x-3 group"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-950 shadow-sm text-white font-bold text-lg select-none">
              A
            </div>
            <span className="text-sm font-semibold tracking-tight text-zinc-800">AttendWise</span>
          </motion.div>

          <motion.div 
            variants={stage2Badge}
            initial={isIntroActive ? "initial" : "animate"}
            animate="animate"
            className="flex items-center space-x-1.5 bg-white border border-zinc-200/60 px-3 py-1 rounded-full shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[10px] text-zinc-500 font-medium"
          >
            <span className="text-emerald-500 font-bold">✦</span>
            <span>Designed for clarity. Built for students.</span>
          </motion.div>
        </div>

        {/* Typographic Copy */}
        <div className="my-auto w-full max-w-2xl z-10 space-y-12 pt-8">
          <div className="space-y-4 max-w-lg">
            <h1 className="text-4xl font-bold tracking-tight text-zinc-900 leading-[1.12] font-sans">
              <motion.span 
                variants={textLines}
                custom={isIntroActive ? 0.7 : 0}
                initial="initial"
                animate="animate"
                className="block"
              >
                Stay on top of
              </motion.span>
              <motion.span 
                variants={textLines}
                custom={isIntroActive ? 0.85 : 0}
                initial="initial"
                animate="animate"
                className="block text-emerald-600"
              >
                your semester.
              </motion.span>
            </h1>
            <motion.p 
              variants={textLines}
              custom={isIntroActive ? 1.0 : 0}
              initial="initial"
              animate="animate"
              className="text-xs text-zinc-500 leading-relaxed max-w-sm"
            >
              Know exactly how many classes you can safely miss, forecast future percentages, and plan absences confidently.
            </motion.p>
          </div>

          {/* Living Attendance Ecosystem Cards */}
          <div className="relative h-[440px] w-full mt-4 select-none">
            
            {/* Card 1: Today's Schedule */}
            <motion.div
              style={{ 
                x: animationCompleted ? middleX1 : 0, 
                y: animationCompleted ? middleY1 : 0, 
                rotate: animationCompleted ? middleRotate1 : -3 
              }}
              initial={isIntroActive ? { opacity: 0, x: -160, y: 160, rotate: -15 } : { opacity: 1 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: -3 }}
              transition={{ delay: isIntroActive ? 1.1 : 0, type: "spring", damping: 18, stiffness: 60 }}
              whileHover={animationCompleted ? { scale: 1.015, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" } : undefined}
              className="absolute top-16 left-2 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4.5 shadow-[0_8px_30px_rgba(9,9,11,0.02)] space-y-4 cursor-default transform-gpu"
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
                  { time: "02:00 PM", title: "Database Systems", room: "Room 205" }
                ].map((item, idx) => (
                  <motion.div 
                    key={item.title}
                    initial={isIntroActive ? { opacity: 0, y: 8 } : { opacity: 1, y: 0 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: isIntroActive ? 1.8 + idx * 0.12 : 0, duration: 0.3 }}
                    className="flex items-start space-x-2 text-[10px]"
                  >
                    <span className="text-zinc-400 font-mono shrink-0 w-12 pt-0.5">{item.time}</span>
                    <div className="border-l-2 border-indigo-200 pl-2">
                      <span className="font-bold text-zinc-800 block">{item.title}</span>
                      <span className="text-[9px] text-zinc-450">{item.room}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <div className="bg-indigo-50/50 border border-indigo-100/50 rounded-xl py-1.5 text-center">
                <span className="text-[9px] font-bold text-indigo-600">3 Classes Today</span>
              </div>
            </motion.div>

            {/* Card 2: Attendance Summary */}
            <motion.div
              style={{ 
                x: animationCompleted ? foregroundX : 0, 
                y: animationCompleted ? foregroundY : 0, 
                rotate: animationCompleted ? foregroundRotate : 1 
              }}
              initial={isIntroActive ? { opacity: 0, x: 160, y: -160, rotate: 10 } : { opacity: 1 }}
              animate={{ opacity: 1, x: 0, y: 0, rotate: 1 }}
              transition={{ delay: isIntroActive ? 1.25 : 0, type: "spring", damping: 16, stiffness: 50 }}
              whileHover={animationCompleted ? { scale: 1.015, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" } : undefined}
              className="absolute top-2 left-60 w-[240px] bg-white border border-zinc-200/60 rounded-2xl p-4.5 shadow-[0_8px_30px_rgba(9,9,11,0.02)] space-y-4 z-10 cursor-default transform-gpu"
            >
              <div className="flex items-center justify-between border-b border-zinc-100 pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="h-6 w-6 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <BarChart2 className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Attendance Summary</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-zinc-300" />
              </div>
              <div className="space-y-3.5">
                <div className="flex items-baseline justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[8px] text-zinc-400 uppercase tracking-wider block font-mono">Overall Attendance</span>
                    <span className="text-2xl font-bold tracking-tight text-zinc-800">{attendancePercent}%</span>
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
                  <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden relative">
                    <motion.div 
                      initial={{ width: "0%" }}
                      animate={{ width: "82.6%" }}
                      transition={{ delay: isIntroActive ? 1.8 : 0, duration: 0.85, ease: "easeOut" }}
                      className="h-full bg-emerald-500 rounded-full" 
                    />
                  </div>
                </div>

                {/* Mock progression graph path */}
                <div className="pt-2 flex items-end justify-between h-10 relative">
                  <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                    <motion.path 
                      d="M 10 30 Q 40 20 70 25 T 130 14 T 190 18 T 220 8" 
                      fill="none" 
                      stroke="#10b981" 
                      strokeWidth="1.5"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: isIntroActive ? 1.8 : 0, duration: 0.8, ease: "easeOut" }}
                    />
                    <motion.circle 
                      cx="220" 
                      cy="8" 
                      r="2.5" 
                      fill="#10b981" 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: isIntroActive ? 2.5 : 0 }}
                    />
                  </svg>
                  {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                    <span 
                      key={day + i} 
                      className={`text-[8px] font-bold font-mono px-1 rounded ${
                        i === 2 ? 'text-white bg-emerald-500' : 'text-zinc-400'
                      }`}
                    >
                      {day}
                    </span>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Card 3: Academic Calendar */}
            <motion.div
              style={{ 
                x: animationCompleted ? backgroundX : 0, 
                y: animationCompleted ? backgroundY : 0, 
                rotate: animationCompleted ? backgroundRotate : 2 
              }}
              initial={isIntroActive ? { opacity: 0, x: 180, y: 0, scale: 0.85, rotate: 10 } : { opacity: 1 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotate: 2 }}
              transition={{ delay: isIntroActive ? 1.4 : 0, type: "spring", damping: 20, stiffness: 45 }}
              whileHover={animationCompleted ? { scale: 1.015, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" } : undefined}
              className="absolute top-12 right-2 w-54 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_8px_30px_rgba(9,9,11,0.02)] space-y-3 cursor-default transform-gpu"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                  <Calendar className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Academic Calendar</span>
              </div>
              <div className="flex justify-between items-center text-[9px] font-bold text-zinc-700 px-0.5">
                <span>May 2024</span>
                <div className="flex space-x-1 text-zinc-450">
                  <span>‹</span>
                  <span>›</span>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-y-1.5 text-center text-[9px] font-medium text-zinc-400 font-mono">
                {DAYS_OF_WEEK.map(d => <span key={d}>{d[0]}</span>)}
                
                {/* Calendar Days */}
                {[
                  { val: "29", muted: true }, { val: "30", muted: true },
                  { val: "1" }, { val: "2" }, { val: "3" }, { val: "4" }, { val: "5" },
                  { val: "6" }, { val: "7" }, { val: "8" }, { val: "9" }, { val: "10" }, { val: "11" }, { val: "12" },
                  { val: "13" }, { val: "14" }, { val: "15" }, { val: "16" }, { val: "17" }, { val: "18" }, { val: "19" },
                  { val: "20" }, { val: "21" }, { val: "22", active: true },
                  { val: "23" }, { val: "24" }, { val: "25" }, { val: "26" },
                  { val: "27" }, { val: "28" }, { val: "29" }, { val: "30" }, { val: "31" }
                ].map((day, idx) => (
                  <motion.span 
                    key={day.val + idx}
                    initial={isIntroActive ? { opacity: 0 } : { opacity: 1 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: isIntroActive ? 1.8 + Math.floor(idx / 7) * 0.08 : 0 }}
                    className={
                      day.active 
                        ? "bg-emerald-500 text-white font-bold rounded-full h-4 w-4 flex items-center justify-center mx-auto scale-105 shadow-[0_1px_4px_rgba(16,185,129,0.25)]" 
                        : day.muted 
                          ? "text-zinc-250" 
                          : "text-zinc-400"
                    }
                  >
                    {day.val}
                  </motion.span>
                ))}
              </div>
            </motion.div>

            {/* Card 4: Attendance Forecast */}
            <motion.div
              style={{ 
                x: animationCompleted ? middleX2 : 0, 
                y: animationCompleted ? middleY2 : 0, 
                rotate: animationCompleted ? middleRotate2 : -1 
              }}
              initial={isIntroActive ? { opacity: 0, y: 200, rotate: -8 } : { opacity: 1 }}
              animate={{ opacity: 1, y: 0, rotate: -1 }}
              transition={{ delay: isIntroActive ? 1.55 : 0, type: "spring", damping: 18, stiffness: 55 }}
              whileHover={animationCompleted ? { scale: 1.015, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" } : undefined}
              className="absolute bottom-6 left-28 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_8px_30px_rgba(9,9,11,0.02)] space-y-3 cursor-default transform-gpu"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500">
                  <TrendingUp className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">Attendance Forecast</span>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] text-zinc-450 font-medium">If you attend all upcoming classes</p>
                <div className="flex items-baseline space-x-1">
                  <motion.span 
                    initial={isIntroActive ? { opacity: 0 } : { opacity: 1 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: isIntroActive ? 2.3 : 0 }}
                    className="text-xl font-bold text-purple-600"
                  >
                    87.4%
                  </motion.span>
                  <span className="text-[9px] text-zinc-400">at semester end</span>
                </div>
                <div className="h-8 w-full relative">
                  <svg className="absolute inset-0 h-full w-full overflow-visible" preserveAspectRatio="none">
                    <motion.path 
                      d="M 5 28 Q 50 24 90 14 T 170 8" 
                      fill="none" 
                      stroke="#8b5cf6" 
                      strokeWidth="1.5" 
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: isIntroActive ? 1.9 : 0, duration: 0.7, ease: "easeOut" }}
                    />
                    <motion.circle 
                      cx="170" 
                      cy="8" 
                      r="2" 
                      fill="#8b5cf6" 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: isIntroActive ? 2.5 : 0 }}
                    />
                  </svg>
                </div>
              </div>
            </motion.div>

            {/* Card 5: AI Assistant */}
            <motion.div
              style={{ 
                x: animationCompleted ? assistantX : 0, 
                y: animationCompleted ? assistantY : 0, 
                rotate: animationCompleted ? assistantRotate : 2 
              }}
              initial={isIntroActive ? { opacity: 0, y: 120, rotate: 6 } : { opacity: 1 }}
              animate={{ opacity: 1, y: 0, rotate: 2 }}
              transition={{ delay: isIntroActive ? 1.7 : 0, type: "spring", damping: 16, stiffness: 60 }}
              whileHover={animationCompleted ? { scale: 1.015, zIndex: 30, boxShadow: "0 20px 40px rgba(0,0,0,0.05)" } : undefined}
              className="absolute bottom-8 right-16 w-56 bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-[0_8px_30px_rgba(9,9,11,0.02)] space-y-3 cursor-default transform-gpu"
            >
              <div className="flex items-center space-x-2 border-b border-zinc-100 pb-2">
                <div className="h-6 w-6 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-[10px] font-bold text-zinc-700 tracking-tight">AI Assistant</span>
              </div>
              <p className="text-[9px] text-zinc-450 font-medium">Ask anything about your schedule or attendance forecasts.</p>
              
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-2.5 flex justify-between items-center text-[9px] font-mono">
                <span className="text-zinc-600">
                  {typedText}
                  {isIntroActive && (
                    <motion.span 
                      animate={{ opacity: [1, 0, 1] }} 
                      transition={{ duration: 0.8, repeat: Infinity }} 
                      className="ml-0.5 border-r border-zinc-400 font-bold"
                    >
                      &nbsp;
                    </motion.span>
                  )}
                </span>
                <span className="text-amber-500 font-bold">➔</span>
              </div>
            </motion.div>

          </div>
        </div>

        {/* Footer info block */}
        <motion.div 
          variants={stage2Footer}
          initial={isIntroActive ? "initial" : "animate"}
          animate="animate"
          className="flex items-center justify-between text-[9px] text-zinc-450 z-10 w-full pt-4 border-t border-zinc-200/30"
        >
          <span>© 2026 AttendWise. All rights reserved.</span>
          <div className="flex space-x-3.5">
            <span className="hover:text-zinc-700 cursor-pointer">Privacy Policy</span>
            <span className="hover:text-zinc-700 cursor-pointer">Terms of Service</span>
          </div>
        </motion.div>
      </div>

      {/* RIGHT AUTH FORM SIDEBAR */}
      <div className="lg:col-span-5 flex flex-col items-center justify-center px-6 py-14 lg:px-16 bg-[#ffffff] relative border-l border-zinc-200/30">
        <div className="w-full max-w-sm space-y-9">
          
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.35, ease: "easeInOut" }}
              className="space-y-9 w-full"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>

          {/* Secure footnote */}
          <motion.div 
            initial={isIntroActive ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: isIntroActive ? 1.6 : 0, duration: 0.4 }}
            className="bg-zinc-50/50 border border-zinc-200/40 rounded-xl p-3.5 flex items-start space-x-3 text-[10px] text-zinc-500"
          >
            <ShieldCheck className="h-4.5 w-4.5 shrink-0 text-emerald-500 mt-0.5" />
            <div className="leading-relaxed">
              <span className="font-bold text-zinc-700 block mb-0.5">Your data is private and secure.</span>
              We never share your academic information.
            </div>
          </motion.div>

        </div>
      </div>
      
    </div>
  );
};

export default AuthLayout;
