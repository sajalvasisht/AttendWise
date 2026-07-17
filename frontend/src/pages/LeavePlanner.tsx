import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { plannerService } from "../services/planner";
import type { SimulationResponse } from "../services/planner";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { 
  Calendar, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, AlertTriangle, ArrowRight
} from "lucide-react";
import Navbar from "../components/Navbar";

const LeavePlanner: React.FC = () => {
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [datesList, setDatesList] = useState<string[]>([]);
  const [simulation, setSimulation] = useState<SimulationResponse | null>(null);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load semester on mount
  useEffect(() => {
    const fetchSemester = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          navigate("/setup");
        } else {
          const activeSem = sems[0];
          setSemester(activeSem);
          fetchCalendarEvents(activeSem.id);
        }
      } catch (err) {
        console.error("Failed to load semesters", err);
        setError("Could not load your semester data.");
      } finally {
        setInitialLoading(false);
      }
    };
    fetchSemester();
  }, [navigate]);

  const fetchCalendarEvents = async (semId: number) => {
    try {
      const evs = await calendarService.list(semId);
      setAllEvents(evs);
    } catch (err) {
      console.error("Failed to load calendar events", err);
    }
  };

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
  const handleSimulate = async () => {
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
    if (!simulation) return { label: "Unknown", color: "text-muted-foreground", bg: "bg-muted/10", border: "border-border" };
    
    const anyBelow = simulation.subjects.some(s => s.recovery_required);
    if (anyBelow) {
      return {
        label: "Below threshold",
        color: "text-destructive",
        bg: "bg-destructive/5",
        border: "border-destructive/20",
        icon: <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
      };
    }

    if (simulation.warnings.length > 0 || simulation.overall.projected_safe_bunks === 0) {
      return {
        label: "Warning",
        color: "text-amber-600",
        bg: "bg-amber-500/5",
        border: "border-amber-500/20",
        icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
      };
    }

    return {
      label: "Safe",
      color: "text-emerald-600",
      bg: "bg-emerald-500/5",
      border: "border-emerald-500/20",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
    };
  };

  const status = getOverallStatus();

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      {/* Main Container */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {initialLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* LEFT COLUMN: Date Picker & Selection List */}
            <div className="md:col-span-1 space-y-6">
              
              <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-4">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border pb-2">
                  Select Leave Dates
                </h3>

                <div className="space-y-3">
                  <div className="flex space-x-2">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="flex-1 rounded-lg border border-border bg-background py-2 px-3 text-xs text-foreground font-medium outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    />
                    <button
                      onClick={handleAddDate}
                      className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-foreground transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Selected Dates List */}
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {datesList.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground italic text-center py-4">No dates added yet.</p>
                    ) : (
                      datesList.map(d => (
                        <div key={d} className="flex items-center justify-between bg-muted/40 border border-border/80 px-2.5 py-1.5 rounded-lg text-xs">
                          <span>{d}</span>
                          <button
                            onClick={() => handleRemoveDate(d)}
                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <button
                  onClick={handleSimulate}
                  disabled={loading || datesList.length === 0}
                  className="w-full inline-flex items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                      Simulating...
                    </>
                  ) : (
                    "Run Simulation"
                  )}
                </button>
              </div>

            </div>

            {/* RIGHT COLUMN: Results Preview */}
            <div className="md:col-span-2 space-y-6">
              
              {!simulation ? (
                <div className="rounded-xl border border-border border-dashed bg-card p-12 text-center text-xs text-muted-foreground space-y-3">
                  <Calendar className="h-8 w-8 text-muted-foreground/60 mx-auto" />
                  <p className="max-w-sm mx-auto leading-relaxed">
                    Select leave dates on the left panel, and run the simulator to project the attendance impact on your courses.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  
                  {/* NATURAL LANGUAGE PLANNER EXPLANATIONS CALLOUT */}
                  <div className={`border rounded-xl p-5 space-y-3 ${
                    isSimulationSafe()
                      ? "bg-emerald-500/5 border-emerald-500/15 text-emerald-800"
                      : "bg-destructive/5 border-destructive/15 text-destructive"
                  }`}>
                    <h4 className="text-xs font-bold uppercase tracking-wider flex items-center space-x-1.5">
                      {isSimulationSafe() ? (
                        <>
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                          <span>Safe to take leave</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
                          <span>Simulation Warning</span>
                        </>
                      )}
                    </h4>

                    <div className="text-xs space-y-2 leading-relaxed">
                      <div>
                        Leave Duration: <strong>{datesList.length} Days</strong>
                      </div>
                      <div>
                        Classes Missed:{" "}
                        <strong>
                          {simulation.missed_lectures.length > 0
                            ? getMissedLecturesBreakdown()
                            : "None"}
                        </strong>
                      </div>
                      <div className="border-t border-current/10 pt-2 font-medium">
                        {isSimulationSafe() ? (
                          <span>All subjects remain above required attendance.</span>
                        ) : (
                          <div className="space-y-1">
                            {simulation.subjects
                              .filter((s) => s.recovery_required)
                              .map((s) => (
                                <p key={s.subject_id}>
                                  <strong>{s.name}</strong> will fall below required attendance. Attend the next{" "}
                                  <strong>{s.required_to_attend}</strong> lectures before taking this leave.
                                </p>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* LEAVE PLANNER VISUAL TIMELINE */}
                  <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                      Leave Timeline Details
                    </h4>

                    <div className="space-y-4 relative pl-4 before:absolute before:left-[22px] before:top-2 before:bottom-2 before:w-0.5 before:bg-border/60">
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
                            badgeClass = "bg-emerald-500/5 text-emerald-600 border border-emerald-500/10";
                          } else if (dayEvent.event_type === "exam_day" || dayEvent.event_type === "exam") {
                            dayText = dayEvent.description || "Exam Day";
                            dayBadge = "Exam Day";
                            badgeClass = "bg-amber-500/5 text-amber-600 border border-amber-500/10";
                          } else {
                            dayText = dayEvent.description || "Exception Event";
                            dayBadge = dayEvent.event_type.replace(/_/g, " ");
                            badgeClass = "bg-primary/5 text-primary border border-primary/10";
                          }
                        } else if (isWeekendDay()) {
                          dayText = "Weekend: No lectures scheduled today.";
                          dayBadge = "Weekend";
                          badgeClass = "bg-muted text-muted-foreground border border-border/80";
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
                          <div key={idx} className="relative flex items-start space-x-4 text-xs">
                            <div className="absolute left-[3.5px] top-1 h-2.5 w-2.5 rounded-full border-2 border-primary bg-background shadow-sm" />
                            
                            <div className="pl-6 space-y-1 w-full">
                              <div className="flex items-center space-x-2">
                                <span className="font-semibold text-foreground">{dateFormatted}</span>
                                {dayBadge && (
                                  <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${badgeClass}`}>
                                    {dayBadge}
                                  </span>
                                )}
                              </div>
                              <p className="text-muted-foreground font-medium">{dayText}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status Indicator Banner */}
                  <div className={`border rounded-xl p-6 ${status.bg} ${status.border} flex items-start space-x-4`}>
                    {status.icon}
                    <div className="space-y-1">
                      <h4 className="text-sm font-semibold text-foreground tracking-tight">
                        Projection Status: <span className={status.color}>{status.label}</span>
                      </h4>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        Based on missing {datesList.length} scheduled leave date(s).
                      </p>
                    </div>
                  </div>

                  {/* Overall projection card */}
                  <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                      Overall Semester Projection
                    </h4>

                    <div className="grid grid-cols-2 gap-8 text-center">
                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Average Attendance</span>
                        <div className="flex items-center justify-center space-x-2 text-base font-bold">
                          <span className="text-muted-foreground line-through font-normal">{simulation.overall.current_percent}%</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">{simulation.overall.projected_percent}%</span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">Safe Bunk Budget</span>
                        <div className="flex items-center justify-center space-x-2 text-base font-bold">
                          <span className="text-muted-foreground line-through font-normal">{simulation.overall.current_safe_bunks}</span>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">{simulation.overall.projected_safe_bunks}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Course comparison list */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                      Course-by-Course Analysis
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {simulation.subjects.map(subj => {
                        const droppedPercent = subj.projected_percent < subj.current_percent;
                        
                        return (
                          <div key={subj.subject_id} className={`border rounded-xl p-4 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-3 ${
                            subj.recovery_required ? "border-destructive/20" : "border-border"
                          }`}>
                            <div className="flex justify-between items-start">
                              <div className="space-y-0.5">
                                <h5 className="text-xs font-semibold text-foreground">{subj.name}</h5>
                                {subj.code && <span className="text-[9px] text-muted-foreground">{subj.code}</span>}
                              </div>
                              <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                                subj.recovery_required 
                                  ? "bg-destructive/10 text-destructive border border-destructive/10" 
                                  : "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10"
                              }`}>
                                {subj.recovery_required ? "Bunk Danger" : "Safe"}
                              </span>
                            </div>

                            <div className="flex items-center justify-between text-xs border-t border-border/40 pt-2.5">
                              <span className="text-muted-foreground">Percentage</span>
                              <div className="flex items-center space-x-1.5 font-semibold">
                                <span>{subj.current_percent}%</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className={droppedPercent ? "text-destructive" : "text-foreground"}>
                                  {subj.projected_percent}%
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Safe Bunks</span>
                              <div className="flex items-center space-x-1.5 font-semibold">
                                <span>{subj.current_safe_bunks}</span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                                <span className={subj.projected_safe_bunks < subj.current_safe_bunks ? "text-destructive" : "text-foreground"}>
                                  {subj.projected_safe_bunks}
                                </span>
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
