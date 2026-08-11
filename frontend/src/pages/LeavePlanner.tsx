import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { plannerService } from "../services/planner";
import type { SimulationResponse } from "../services/planner";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { subjectService } from "../services/subject";
import {
  Plus, Trash2, Loader2, AlertCircle, CheckCircle2, AlertTriangle, ArrowRight, Compass
} from "lucide-react";

import Navbar from "../components/Navbar";
import { motion } from "framer-motion";


function inputStyle(focused: boolean, hovered: boolean): React.CSSProperties {
  return {
    border: `1px solid ${
      focused
        ? "rgba(15,23,42,0.3)"
        : hovered
        ? "rgba(15,23,42,0.15)"
        : "rgba(15,23,42,0.08)"
    }`,
    backgroundColor: focused ? "#ffffff" : "#fafafa",
    outline: "none",
    boxShadow: focused ? "0 4px 12px rgba(15,23,42,0.04)" : "none",
    transition: "all 0.2s ease-in-out"
  };
}

const LeavePlanner: React.FC = () => {
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [datesList, setDatesList] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [hasSubjects, setHasSubjects] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [dateFocused, setDateFocused] = useState(false);
  const [dateHovered, setDateHovered] = useState(false);

  // Load semester and data on mount
  useEffect(() => {
    const fetchSemester = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          navigate("/setup");
          return;
        }

        const activeSem = sems.find(s => s.is_active) || sems[0];
        setSemester(activeSem);

        // Fetch subjects and calendar exceptions in parallel
        const [subjsRes, eventsRes] = await Promise.allSettled([
          subjectService.list(activeSem.id),
          calendarService.list(activeSem.id),
        ]);


        if (subjsRes.status === "fulfilled") {
          setHasSubjects(subjsRes.value.length > 0);
        }

        if (eventsRes.status === "fulfilled") {
          setAllEvents(eventsRes.value);
        }
      } catch (err) {
        console.error("Failed to load semester data", err);
        setError("Could not load your semester data.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchSemester();
  }, [navigate]);


  // Add date to list

  const handleAddDate = () => {
    if (!selectedDate) return;
    if (datesList.includes(selectedDate)) {
      setError("This date is already added to the list.");
      return;
    }
    setError(null);
    setDatesList(prev => [...prev, selectedDate].sort());
    setSelectedDate("");
  };

  // Remove date from list
  const handleRemoveDate = (dateToRemove: string) => {
    setDatesList(prev => prev.filter(d => d !== dateToRemove));
  };

  // Trigger leave simulation
  const handleRunSimulation = async () => {
    if (!semester) return;
    
    if (datesList.length === 0) {
      setError("Please add at least one future date to simulate leave.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const result = await plannerService.simulate(semester.id, datesList);
      setSimulation(result);
    } catch (err) {
      console.error("Simulation failed", err);
      setError("Failed to run attendance simulation. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Group missed lectures by subject for explanation
  const getMissedLecturesBreakdown = () => {
    if (!simulation) return "";
    const counts: { [name: string]: number } = {};
    simulation.missed_lectures.forEach((l) => {
      counts[l.subject_name] = (counts[l.subject_name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => `${name} (${count})`)
      .join(", ");
  };

  // Check if simulation is safe
  const isSimulationSafe = () => {
    if (!simulation) return true;
    return !simulation.subjects.some(s => s.recovery_required);
  };

  // Determine overall status indicator
  const getOverallStatus = () => {
    if (!simulation) return { label: "Unknown", color: "text-zinc-400", bg: "bg-zinc-50/50", border: "border-zinc-200" };
    
    const anyBelow = simulation.subjects.some(s => s.recovery_required);
    if (anyBelow) {
      return {
        label: "Danger",
        color: "text-red-650",
        bg: "bg-red-50/15",
        border: "border-red-100",
        icon: <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
      };
    }

    const projSafeClasses = simulation.subjects.reduce((sum, s) => sum + Math.floor(s.projected_safe_bunks / (s.units_per_class || 1)), 0);
    if (simulation.warnings.length > 0 || projSafeClasses === 0) {
      return {
        label: "Warning",
        color: "text-amber-600",
        bg: "bg-amber-50/15",
        border: "border-amber-100",
        icon: <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
      };
    }

    return {
      label: "Safe",
      color: "text-emerald-650",
      bg: "bg-emerald-50/15",
      border: "border-emerald-100",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
    };
  };

  const status = getOverallStatus();

  if (!hasSubjects && !initialLoading) {
    return (
      <div className="min-h-screen bg-zinc-50/20 text-zinc-900 flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-14 flex flex-col justify-center items-center">
          <div className="premium-card p-10 text-center space-y-4 max-w-sm mx-auto shadow-sm animate-scale-in">
            <div className="h-10 w-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 mx-auto">
              <Compass className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-800">No Attendance Data Available</h4>
              <p className="text-[11px] text-zinc-550 leading-relaxed">
                No attendance data available to simulate leaves. Please add your subjects and schedule setup first.
              </p>
            </div>
            <Link
              to="/setup"
              className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-[11.5px] font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Configure Setup
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      {/* Main Container */}
      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-14 space-y-12">
        
        {/* Header */}
        <div className="border-b border-zinc-150/60 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Leave Planner Simulation</h1>
          <p className="text-xs text-zinc-500 font-semibold mt-1">Add dates below to forecast how absences affect your attendance requirements.</p>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-2xl border border-red-500/15 bg-red-50/50 p-4 text-xs text-red-650 flex items-start space-x-3">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        {initialLoading ? (
          <div className="flex flex-col justify-center items-center py-32 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
            <p className="text-xs text-zinc-400 font-semibold">Loading planner...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            
            {/* LEFT COLUMN: Date Picker & Selection List */}
            <div className="lg:col-span-1 space-y-6">
              
              <div className="premium-card p-6 space-y-5">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">
                  Select Leave Dates
                </h3>

                <div className="space-y-4">
                  <div className="flex space-x-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      onFocus={() => setDateFocused(true)}
                      onBlur={() => setDateFocused(false)}
                      onMouseEnter={() => setDateHovered(true)}
                      onMouseLeave={() => setDateHovered(false)}
                      style={inputStyle(dateFocused, dateHovered)}
                      className="flex-grow rounded-xl py-2 px-3 text-xs text-zinc-800 font-medium outline-none transition-all duration-150 cursor-pointer"
                    />
                    <button
                      onClick={handleAddDate}
                      className="p-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-55 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer shadow-sm flex items-center justify-center"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Selected Dates List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {datesList.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 italic text-center py-6">No dates added yet.</p>
                    ) : (
                      datesList.map(d => (
                        <div key={d} className="flex items-center justify-between bg-zinc-50 border border-zinc-200/60 px-3 py-2 rounded-xl text-xs font-semibold text-zinc-700 shadow-sm animate-scale-in">
                          <span>{new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                          <button
                            onClick={() => handleRemoveDate(d)}
                            className="text-zinc-400 hover:text-red-500 transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <motion.button
                  onClick={handleRunSimulation}
                  disabled={loading || datesList.length === 0}
                  whileHover={!(loading || datesList.length === 0) ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                  whileTap={!(loading || datesList.length === 0) ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                  transition={{ duration: 0.16 }}
                  className="w-full inline-flex items-center justify-center rounded-xl bg-zinc-900 h-10 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer select-none"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2 text-white/60" />
                      Simulating...
                    </>
                  ) : (
                    "Run Simulation"
                  )}
                </motion.button>
              </div>

            </div>

            {/* RIGHT COLUMN: Results Preview */}
            <div className="lg:col-span-2 space-y-8">
              
              {!simulation ? (
                <div className="rounded-[28px] border-2 border-zinc-200 border-dashed bg-white p-12 text-center text-xs text-zinc-400 space-y-4 animate-scale-in">
                  <div className="h-12 w-12 rounded-full bg-zinc-50 border border-zinc-200 flex items-center justify-center text-zinc-400 mx-auto">
                    <Compass className="h-6 w-6 animate-pulse" />
                  </div>
                  <div className="space-y-1.5 max-w-sm mx-auto">
                    <h4 className="text-xs font-bold text-zinc-800">Ready to Simulate Absences</h4>
                    <p className="text-[11px] text-zinc-550 leading-relaxed font-semibold">
                      Select target leave dates on the left panel, then run the simulator to project the attendance impact on your courses.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  
                  {/* NATURAL LANGUAGE PLANNER EXPLANATIONS CALLOUT */}
                  <div className={`border rounded-2xl p-5 space-y-3 ${
                    isSimulationSafe()
                      ? "bg-emerald-50 border-emerald-100 text-emerald-800"
                      : "bg-red-50 border-red-100 text-red-750"
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-widest flex items-center space-x-1.5">
                      {isSimulationSafe() ? (
                        <>
                          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600" />
                          <span>Safe to take leave</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4.5 w-4.5 shrink-0 text-red-650" />
                          <span>Simulation Warning</span>
                        </>
                      )}
                    </h4>

                    <div className="text-xs space-y-2 leading-relaxed font-semibold">
                      <div>
                        Leave Duration: <strong>{datesList.length} Days</strong>
                      </div>
                      <div>
                        Classes Missed:{" "}
                        <strong className="text-zinc-800">
                          {simulation.missed_lectures.length > 0
                            ? getMissedLecturesBreakdown()
                            : "None"}
                        </strong>
                      </div>
                      <div className="border-t border-current/10 pt-2 font-bold text-[11px]">
                        {isSimulationSafe() ? (
                          <span>All subjects remain above required attendance.</span>
                        ) : (
                          <div className="space-y-1">
                            {simulation.subjects
                              .filter((s) => s.recovery_required)
                              .map((s) => (
                                <p key={s.subject_id}>
                                  <strong>{s.name}</strong> will fall below required attendance. Attend the next{" "}
                                  <strong className="underline">{Math.ceil(s.required_to_attend / (s.units_per_class || 1))}</strong> lectures before taking this leave.
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LEAVE PLANNER VISUAL TIMELINE */}
                  <div className="premium-card p-6 space-y-5">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">
                      Leave Timeline Details
                    </h4>

                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-[9px] top-2 bottom-2 w-px bg-zinc-200/80" />

                      {datesList.map((dateStr, idx) => {
                        const dayEvent = allEvents.find(e => e.date === dateStr);
                        const isWeekendDay = () => {
                          if (!semester) return false;
                          const todayWeekday = new Date(dateStr + "T00:00:00").getDay();
                          const backendWeekdayMap = [6, 0, 1, 2, 3, 4, 5];
                          const targetIndex = backendWeekdayMap[todayWeekday];
                          const workingDaysSet = semester.working_days ? semester.working_days.split(",").map(Number) : [0, 1, 2, 3, 4];
                          return !workingDaysSet.includes(targetIndex);
                        };

                        let dayText = "";
                        let dayBadge = "";
                        let badgeClass = "";

                        if (dayEvent) {
                          if (["holiday", "college_closure", "exam_break"].includes(dayEvent.event_type)) {
                            dayText = dayEvent.description || "College Holiday";
                            dayBadge = "Holiday";
                            badgeClass = "bg-emerald-50 border-emerald-100 text-emerald-700";
                          } else if (dayEvent.event_type === "exam_day" || dayEvent.event_type === "exam") {
                            dayText = dayEvent.description || "Exam Day";
                            dayBadge = "Exam Day";
                            badgeClass = "bg-amber-50 border-amber-100 text-amber-700";
                          } else {
                            dayText = dayEvent.description || "Exception Event";
                            dayBadge = dayEvent.event_type.replace(/_/g, " ");
                            badgeClass = "bg-zinc-100 border border-zinc-200 text-zinc-700";
                          }
                        } else if (isWeekendDay()) {
                          dayText = "Weekend: No lectures scheduled today.";
                          dayBadge = "Weekend";
                          badgeClass = "bg-zinc-50 border border-zinc-200 text-zinc-500";
                        } else {
                          const matchingMissed = simulation.missed_lectures.filter(l => l.date === dateStr);
                          if (matchingMissed.length === 0) {
                            dayText = "No lectures scheduled today.";
                          } else {
                            const counts: { [name: string]: number } = {};
                            matchingMissed.forEach(l => {
                              counts[l.subject_name] = (counts[l.subject_name] || 0) + 1;
                            });
                            dayText = Object.entries(counts)
                              .map(([name, count]) => `${name}${count > 1 ? ` (${count})` : ""}`)
                              .join(", ");
                          }
                        }

                        const dateFormatted = new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          day: "numeric",
                          month: "short"
                        });

                        return (
                          <div key={idx} className="relative flex items-start text-xs font-semibold">
                            <div className="absolute -left-[21px] top-1.5 h-3.5 w-3.5 rounded-full border-2 border-zinc-900 bg-white z-10 shadow-sm" />
                            
                            <div className="space-y-1 w-full pl-2">
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-zinc-800">{dateFormatted}</span>
                                {dayBadge && (
                                  <span className={`text-[8.5px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border ${badgeClass}`}>
                                    {dayBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-zinc-500 font-medium text-[11px] leading-relaxed">{dayText}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Indicator Banner */}
                  <div className={`border rounded-2xl p-5 ${status.bg} ${status.border} flex items-start space-x-4`}>
                    {status.icon}
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-zinc-800 tracking-tight">
                        Projection Status: <span className={status.color}>{status.label}</span>
                      </h4>
                      <p className="text-xs text-zinc-450 font-semibold leading-relaxed">
                        Based on missing {datesList.length} scheduled leave date(s).
                      </p>
                    </div>
                  </div>

                  {/* Overall projection card */}
                  <div className="premium-card p-6 space-y-4">
                    <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3">
                      Overall Semester Projection
                    </h4>

                    <div className="grid grid-cols-2 gap-8 text-center">
                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-450 uppercase font-bold tracking-widest block">Average Attendance</span>
                        <div className="flex items-center justify-center space-x-2 text-base font-black pt-1">
                          <span className="text-zinc-400 line-through font-normal">{simulation.overall.current_percent}%</span>
                          <ArrowRight className="h-4 w-4 text-zinc-450" />
                          <span className="text-zinc-800">{simulation.overall.projected_percent}%</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] text-zinc-450 uppercase font-bold tracking-widest block">Safe Lectures Remaining</span>
                        <div className="flex items-center justify-center space-x-2 text-base font-black pt-1">
                          <div className="text-zinc-400 line-through font-normal">
                            {simulation.subjects.reduce((sum, s) => sum + Math.max(0, Math.floor(s.current_safe_bunks / (s.units_per_class || 1))), 0)} sessions
                            <span className="text-[10px] block text-zinc-400 font-normal">({simulation.subjects.reduce((sum, s) => Math.max(0, sum + s.current_safe_bunks), 0)} entries)</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-zinc-450" />
                          <div className="text-zinc-800">
                            {simulation.subjects.reduce((sum, s) => sum + Math.max(0, Math.floor(s.projected_safe_bunks / (s.units_per_class || 1))), 0)} sessions
                            <span className="text-[10px] text-zinc-400 font-semibold block">({simulation.subjects.reduce((sum, s) => Math.max(0, sum + s.projected_safe_bunks), 0)} entries)</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course comparison list */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest border-b border-zinc-100 pb-3">
                      Course-by-Course Analysis
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {simulation.subjects.map(subj => {
                        const droppedPercent = subj.projected_percent < subj.current_percent;
                        
                        return (
                          <div key={subj.subject_id} className={`premium-card p-5 space-y-4 ${
                            subj.recovery_required ? "border-red-200/80 bg-red-50/5" : ""
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <h5 className="text-sm font-bold text-zinc-800 leading-tight">{subj.name}</h5>
                                {subj.code && <span className="text-[9px] text-zinc-400 font-mono tracking-wide font-semibold block mt-0.5">{subj.code}</span>}
                              </div>
                              <span className={`text-[9px] font-extrabold uppercase tracking-widest px-2 py-0.5 rounded-full border ${
                                subj.recovery_required 
                                  ? "bg-red-50 border-red-100 text-red-700" 
                                  : "bg-emerald-50 border-emerald-100 text-emerald-700"
                              }`}>
                                 {subj.recovery_required ? "Warning" : "Safe"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs font-semibold border-t border-zinc-100 pt-3">
                              <span className="text-zinc-450">Percentage</span>
                              <div className="flex items-center space-x-1.5 font-extrabold">
                                <span className="text-zinc-400 font-normal">{subj.current_percent}%</span>
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                                <span className={droppedPercent ? "text-red-650" : "text-zinc-800"}>
                                  {subj.projected_percent}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-zinc-450">Safe Absences</span>
                              <div className="flex items-center space-x-1.5 font-extrabold text-right">
                                <div className="text-zinc-400 font-normal">
                                  {Math.max(0, Math.floor(subj.current_safe_bunks / (subj.units_per_class || 1)))} sessions
                                  <span className="text-[9.5px] block text-zinc-450 font-normal">({Math.max(0, subj.current_safe_bunks)} entries)</span>
                                </div>
                                <ArrowRight className="h-3 w-3 text-zinc-400" />
                                <div className={subj.projected_safe_bunks < subj.current_safe_bunks ? "text-red-650" : "text-zinc-800"}>
                                  {Math.max(0, Math.floor(subj.projected_safe_bunks / (subj.units_per_class || 1)))} sessions
                                  <span className="text-[9.5px] text-zinc-450 font-semibold block">({Math.max(0, subj.projected_safe_bunks)} entries)</span>
                                </div>
                              </div>
                            </div>

                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>
              )}

            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default LeavePlanner;
