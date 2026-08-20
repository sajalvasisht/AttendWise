import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subjectService } from "../services/subject";
import type { Subject } from "../services/subject";
import { semesterService } from "../services/semester";
import { attendanceService } from "../services/attendance";

import { Loader2, BookOpen, Info, ShieldAlert, CheckCircle2 } from "lucide-react";
import Navbar from "../components/Navbar";
import { motion } from "framer-motion";
import { useWorkspace } from "../context/WorkspaceContext";

function inputStyle(focused: boolean, hovered: boolean): React.CSSProperties {
  return {
    border: `1px solid ${
      focused
        ? "rgba(15,23,42,0.3)"
        : hovered
        ? "rgba(15,23,42,0.14)"
        : "rgba(15,23,42,0.08)"
    }`,
    backgroundColor: focused ? "#ffffff" : hovered ? "#ffffff" : "#fafafa",
    boxShadow: focused
      ? "0 0 0 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.02)"
      : "none",
    transition:
      "border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
    outline: "none",
  };
}

const InitializeAttendance: React.FC = () => {
  const { refreshWorkspace } = useWorkspace();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  
  // Dynamic tracking mode selection:
  // modeA = Keep my existing attendance totals. Start detailed tracking from today.
  // modeB = Review historical classes and build complete attendance history.
  const [mode, setMode] = useState<"modeA" | "modeB">("modeA");
  
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const [hoveredInputs, setHoveredInputs] = useState<Record<string, boolean>>({});

  const [conductedValues, setConductedValues] = useState<Record<number, number | "">>({});
  const [attendedValues, setAttendedValues] = useState<Record<number, number | "">>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchSemesterAndSubjects = async () => {
    try {
      const res = await semesterService.list();
      if (res.length === 0) {
        navigate("/setup");
        return;
      }
      const sem = res.find(s => s.is_active) || res[0];
      setSemesterId(sem.id);
      
      const subList = await subjectService.list(sem.id, true);
      // Ensure unique subjects by ID defensively
      const uniqueSubList = Array.from(new Map(subList.map(s => [s.id, s])).values());
      setSubjects(uniqueSubList);
      
      const conducted: Record<number, number | ""> = {};
      const attended: Record<number, number | ""> = {};
      uniqueSubList.forEach((s: Subject) => {
        conducted[s.id] = 0;
        attended[s.id] = 0;
      });
      setConductedValues(conducted);
      setAttendedValues(attended);

    } catch (err: any) {
      console.error(err);
      setError("Failed to load subjects. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    fetchSemesterAndSubjects();
  }, []);

  const handleValChange = (subjectId: number, type: "conducted" | "attended", valStr: string) => {
    setError(null);
    const val = valStr === "" ? "" : Math.max(0, parseInt(valStr) || 0);
    if (type === "conducted") {
      setConductedValues((prev) => ({ ...prev, [subjectId]: val }));
    } else {
      setAttendedValues((prev) => ({ ...prev, [subjectId]: val }));
    }
  };

  const setInputFocus = (key: string, focused: boolean) => {
    setFocusedInputs(prev => ({ ...prev, [key]: focused }));
  };

  const setInputHover = (key: string, hovered: boolean) => {
    setHoveredInputs(prev => ({ ...prev, [key]: hovered }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterId || submitting) return;

    if (mode === "modeA") {
      // Validate: attended <= conducted for all subjects
      for (const sub of subjects) {
        const cond = conductedValues[sub.id] === "" ? 0 : (conductedValues[sub.id] as number) || 0;
        const att = attendedValues[sub.id] === "" ? 0 : (attendedValues[sub.id] as number) || 0;
        if (att > cond) {
          setError(`For subject "${sub.name}", classes attended cannot exceed classes conducted.`);
          return;
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = subjects.map((s) => ({
        subject_id: s.id,
        initial_conducted: mode === "modeA" ? (conductedValues[s.id] === "" ? 0 : (conductedValues[s.id] as number) || 0) : 0,
        initial_attended: mode === "modeA" ? (attendedValues[s.id] === "" ? 0 : (attendedValues[s.id] as number) || 0) : 0,
      }));
      await attendanceService.initializeAttendance(semesterId, payload);
      await refreshWorkspace(true);
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to initialize attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfdfd] text-[#0f172a] font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
        <p className="text-xs text-zinc-400 font-semibold mt-3">Loading subjects...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-2xl mx-auto w-full px-6 py-14 space-y-8">
        <div className="space-y-6">
          
          {/* Header */}
          <div className="border-b border-zinc-150/60 pb-5">
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Historical Attendance Import</h1>
            <p className="text-xs text-zinc-500 font-semibold mt-1">
              Tell AttendWise about your attendance history so far. This creates editable records in your calendar from your semester start date.
            </p>
          </div>

          {/* Guidance Banner */}
          <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 text-xs text-amber-900 flex items-start space-x-3.5 leading-normal shadow-sm">
            <Info className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-amber-950 block">Important Guidance</span>
              <p>
                When entering your current attendance, enter your <strong>TOTAL attendance up to the date provided by your college/teacher</strong>.
              </p>
              <p className="text-[11px] text-amber-800">
                The initial session date acts as your starting baseline. Timetable changes are expected over the semester and can be updated at any time in setup settings.
              </p>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-150 bg-red-50/20 p-4.5 text-xs text-red-650 flex items-start space-x-3 leading-normal font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.01)] animate-fade-in">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Reconciliation mode selector cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-scale-in">
            {/* Mode A card */}
            <div
              onClick={() => setMode("modeA")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer text-left select-none relative flex flex-col justify-between ${
                mode === "modeA"
                  ? "border-zinc-900 bg-zinc-50/20 shadow-sm"
                  : "border-zinc-150 bg-white hover:border-zinc-300"
              }`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-zinc-800">Enter My Totals</h3>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${mode === "modeA" ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-transparent"}`}>
                    {mode === "modeA" && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                  </div>
                </div>
                <p className="text-[10.5px] text-zinc-450 font-semibold leading-relaxed mt-2.5">
                  Enter total classes attended and missed so far. AttendWise creates the matching historical records automatically — editable in the Daily Tracker.
                </p>
              </div>
            </div>

            {/* Mode B card */}
            <div
              onClick={() => setMode("modeB")}
              className={`p-5 rounded-2xl border transition-all cursor-pointer text-left select-none relative flex flex-col justify-between ${
                mode === "modeB"
                  ? "border-zinc-900 bg-zinc-50/20 shadow-sm"
                  : "border-zinc-150 bg-white hover:border-zinc-300"
              }`}
            >
              <div>
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-zinc-800">Start From Scratch</h3>
                  <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${mode === "modeB" ? "border-zinc-900 bg-zinc-900" : "border-zinc-300 bg-transparent"}`}>
                    {mode === "modeB" && <CheckCircle2 className="h-2.5 w-2.5 text-white" />}
                  </div>
                </div>
                <p className="text-[10.5px] text-zinc-450 font-semibold leading-relaxed mt-2.5">
                  No prior history to import. All past classes will be generated as unrecorded — mark them yourself in the Daily Tracker.
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-8">
            {mode === "modeA" ? (
              <div className="space-y-6 animate-scale-in">
                {/* Alert banner */}
                <div className="rounded-2xl border border-blue-150 bg-blue-50/20 p-5 text-xs text-blue-800 flex items-start space-x-3.5 leading-normal font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
                  <Info className="h-5 w-5 shrink-0 text-blue-500" />
                  <div>
                    <span className="font-extrabold block mb-0.5">What does this do?</span>
                    AttendWise will create past attendance records (present/absent) matching your totals. You can review and adjust each record individually in the Daily Tracker.
                  </div>
                </div>

                <div className="premium-card overflow-hidden">
                  <div className="divide-y divide-zinc-100">
                    {subjects.map((sub) => {
                      const conductedKey = `${sub.id}-conducted`;
                      const attendedKey = `${sub.id}-attended`;

                      return (
                        <div key={sub.id} className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 transition-all">
                          <div className="flex items-center space-x-3.5 min-w-0">
                            <div className="h-9 w-9 rounded-xl border border-zinc-200 bg-white flex items-center justify-center shrink-0 shadow-sm">
                              <BookOpen className="h-4.5 w-4.5 text-zinc-500" />
                            </div>
                            <div className="min-w-0">
                              <h4 className="text-xs font-bold text-zinc-800 truncate">{sub.name}</h4>
                              {sub.code && (
                                <span className="text-[9px] text-zinc-400 font-bold uppercase font-mono tracking-widest mt-0.5 block">
                                  {sub.code}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-4">
                            {/* Conducted Input */}
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                Conducted
                              </label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={conductedValues[sub.id]}
                                onChange={(e) => handleValChange(sub.id, "conducted", e.target.value)}
                                onFocus={() => setInputFocus(conductedKey, true)}
                                onBlur={() => setInputFocus(conductedKey, false)}
                                onMouseEnter={() => setInputHover(conductedKey, true)}
                                onMouseLeave={() => setInputHover(conductedKey, false)}
                                style={inputStyle(!!focusedInputs[conductedKey], !!hoveredInputs[conductedKey])}
                                className="w-24 rounded-xl py-2 px-3 text-xs text-zinc-800 font-semibold"
                              />
                            </div>

                            {/* Attended Input */}
                            <div className="space-y-1">
                              <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                Attended
                              </label>
                              <input
                                type="number"
                                min="0"
                                required
                                value={attendedValues[sub.id]}
                                onChange={(e) => handleValChange(sub.id, "attended", e.target.value)}
                                onFocus={() => setInputFocus(attendedKey, true)}
                                onBlur={() => setInputFocus(attendedKey, false)}
                                onMouseEnter={() => setInputHover(attendedKey, true)}
                                onMouseLeave={() => setInputHover(attendedKey, false)}
                                style={inputStyle(!!focusedInputs[attendedKey], !!hoveredInputs[attendedKey])}
                                className="w-24 rounded-xl py-2 px-3 text-xs text-zinc-800 font-semibold"
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6 animate-scale-in">
                {/* Mode B Info */}
                <div className="rounded-2xl border border-emerald-150 bg-emerald-50/20 p-5 text-xs text-emerald-800 flex items-start space-x-3.5 leading-normal font-semibold shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
                  <Info className="h-5 w-5 shrink-0 text-emerald-600" />
                  <div>
                    <span className="font-extrabold block mb-0.5">Timeline Generation</span>
                    AttendWise will generate all classes starting from your semester launch date. We will initialize your baseline counters to 0, so you can review and log past classes manually in the tracker.
                  </div>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end">
              <motion.button
                type="submit"
                disabled={submitting}
                whileHover={!submitting ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                whileTap={!submitting ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                transition={{ duration: 0.16 }}
                className="rounded-xl bg-zinc-900 h-10 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 cursor-pointer flex items-center space-x-2 select-none"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>
                    {mode === "modeA" ? "Import History & Start Tracking" : "Generate Calendar & Start Tracking"}
                  </span>
                )}
              </motion.button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
};

export default InitializeAttendance;
