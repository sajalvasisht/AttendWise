import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { LectureOccurrence } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { 
  Clock, Loader2, ChevronLeft, ChevronRight, AlertCircle, Brain, Calendar as CalendarIcon, X, Eye
} from "lucide-react";
import Navbar from "../components/Navbar";

const DailyTracker: React.FC = () => {
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA")
  );
  
  // States for month navigation and calendar grid
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthOccurrences, setMonthOccurrences] = useState<LectureOccurrence[]>([]);
  
  const [occurrences, setOccurrences] = useState<LectureOccurrence[]>([]);
  const [allEvents, setAllEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Side Drawer view state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  // Load active semester on mount
  useEffect(() => {
    const fetchSemester = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          navigate("/setup");
        } else {
          setSemester(sems.find(s => s.is_active) || sems[0]);
        }
      } catch (err) {
        console.error("Failed to load semesters", err);
        setError("Could not load your semester data.");
      }
    };
    fetchSemester();
  }, [navigate]);

  // Load calendar events
  useEffect(() => {
    if (!semester) return;
    const fetchEvents = async () => {
      try {
        const evs = await calendarService.list(semester.id);
        setAllEvents(evs);
      } catch (err) {
        console.error("Failed to load calendar exceptions", err);
      }
    };
    fetchEvents();
  }, [semester]);

  // Load month occurrences whenever viewing month or active semester changes
  useEffect(() => {
    if (!semester) return;
    const fetchMonthData = async () => {
      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, currentMonth.getMonth() + 1, 0).getDate();
      const startStr = `${year}-${month}-01`;
      const endStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;
      try {
        const data = await attendanceService.getByRange(semester.id, startStr, endStr);
        setMonthOccurrences(data);
      } catch (err) {
        console.error("Failed to load month range data:", err);
      }
    };
    fetchMonthData();
  }, [semester, currentMonth]);

  // Load occurrences whenever selected date or semester changes
  useEffect(() => {
    if (!semester) return;
    const fetchOccurrences = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await attendanceService.getByDate(semester.id, selectedDate);
        setOccurrences(data);
      } catch (err) {
        console.error("Failed to load lectures", err);
        setError("Error fetching class list for the selected date.");
      } finally {
        setLoading(false);
      }
    };
    fetchOccurrences();
  }, [semester, selectedDate]);

  // Quick navigation for dates (Prev Day / Next Day)
  const adjustDate = (days: number) => {
    const dateObj = new Date(selectedDate + "T00:00:00");
    dateObj.setDate(dateObj.getDate() + days);
    const newDateStr = dateObj.toLocaleDateString("en-CA");
    setSelectedDate(newDateStr);
    setCurrentMonth(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1));
    setIsDrawerOpen(true);
  };

  // Update Status handler
  const handleStatusChange = async (occurrenceId: number, status: "present" | "absent" | "cancelled" | "unmarked") => {
    if (!semester) return;
    setUpdatingId(occurrenceId);
    try {
      const updated = await attendanceService.updateStatus(semester.id, occurrenceId, status);
      // Immediately reflect status update in local state
      setOccurrences(prev => 
        prev.map(occ => occ.id === occurrenceId ? { ...occ, attendance_status: updated.attendance_status } : occ)
      );
      // Update month occurrences cache
      setMonthOccurrences(prev =>
        prev.map(occ => occ.id === occurrenceId ? { ...occ, attendance_status: updated.attendance_status } : occ)
      );
    } catch (err) {
      console.error("Failed to update status", err);
      setError("Failed to update attendance status. Try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Find if selected date matches any exam or holiday
  const dayEvent = allEvents.find(e => e.date === selectedDate);
  const dayExam = dayEvent && (dayEvent.event_type === "exam_day" || dayEvent.event_type === "exam") ? dayEvent : null;
  const dayHoliday = dayEvent && ["holiday", "college_closure", "exam_break"].includes(dayEvent.event_type) ? dayEvent : null;

  const isWeekend = () => {
    if (!semester) return false;
    const todayWeekday = new Date(selectedDate + "T00:00:00").getDay();
    const backendWeekdayMap = [6, 0, 1, 2, 3, 4, 5];
    const targetIndex = backendWeekdayMap[todayWeekday];
    const workingDaysSet = semester.working_days ? semester.working_days.split(",").map(Number) : [0, 1, 2, 3, 4];
    return !workingDaysSet.includes(targetIndex);
  };

  // Helper for generating monthly grid days
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    // Monday index offset (0=Mon, 6=Sun)
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    
    const cells: (Date | null)[] = [];
    
    // Empty padding cells
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
    
    // Days in month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(new Date(year, month, d));
    }
    
    return cells;
  };

  const adjustMonth = (offset: number) => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + offset, 1));
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsDrawerOpen(true);
  };

  const calendarDays = getCalendarDays();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const todayStr = new Date().toLocaleDateString("en-CA");

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8 relative">
        
        {/* Header */}
        <div className="border-b border-border/80 pb-4">
          <h1 className="text-xl font-bold tracking-tight">Daily Tracker & Calendar</h1>
          <p className="text-xs text-muted-foreground font-medium">Click any calendar cell to view timing details and log course attendance statuses.</p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* 1. MONTHLY CALENDAR GRID CARD */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-5">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between border-b border-border/60 pb-3">
            <h2 className="text-sm font-bold text-foreground uppercase tracking-wider flex items-center space-x-1.5">
              <CalendarIcon className="h-4.5 w-4.5 text-muted-foreground" />
              <span>
                {currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            </h2>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => adjustMonth(-1)}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today.toLocaleDateString("en-CA"));
                }}
                className="text-[10px] font-semibold px-2 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                onClick={() => adjustMonth(1)}
                className="p-1.5 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Week Day Titles */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {dayNames.map((name) => (
              <span key={name} className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest py-1.5">
                {name}
              </span>
            ))}
          </div>

          {/* Monthly Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />;
              }

              const formatted = day.toLocaleDateString("en-CA");
              const isSelected = selectedDate === formatted;
              const isToday = todayStr === formatted;
              
              // Filter occurrences for this day
              const dayOccs = monthOccurrences.filter(o => o.date === formatted);
              
              // Find calendar exceptions
              const dayEv = allEvents.find(e => e.date === formatted);
              const isHoliday = dayEv && ["holiday", "college_closure", "exam_break"].includes(dayEv.event_type);
              const isExam = dayEv && (dayEv.event_type === "exam_day" || dayEv.event_type === "exam");
              const isLeave = dayEv && dayEv.event_type === "leave";

              // Color-coding class evaluation
              let colorClass = "border-border/80 bg-background hover:bg-muted/40 hover:border-foreground/10";
              
              if (isSelected) {
                colorClass = "bg-primary border-primary text-primary-foreground shadow-md";
              } else if (isHoliday) {
                colorClass = "bg-emerald-500/5 border-emerald-500/20 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-500/10";
              } else if (isExam) {
                colorClass = "bg-amber-500/5 border-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/10";
              } else if (isLeave) {
                colorClass = "bg-blue-500/5 border-blue-500/20 text-blue-800 dark:text-blue-300 hover:bg-blue-500/10";
              } else if (dayOccs.length > 0) {
                const hasAbsent = dayOccs.some(occ => occ.attendance_status === "absent");
                const hasPresent = dayOccs.some(occ => occ.attendance_status === "present");
                const allCancelled = dayOccs.every(occ => occ.attendance_status === "cancelled");
                
                if (hasAbsent) {
                  colorClass = "bg-destructive/5 border-destructive/20 text-destructive dark:text-red-300 hover:bg-destructive/10";
                } else if (hasPresent) {
                  colorClass = "bg-emerald-500/5 border-emerald-500/25 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10";
                } else if (allCancelled) {
                  colorClass = "bg-amber-500/5 border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10";
                } else if (formatted > todayStr) {
                  // Future Lectures
                  colorClass = "border-dashed border-border/80 bg-muted/10 text-muted-foreground/80 hover:bg-muted/20";
                }
              } else if (formatted > todayStr) {
                // Future days with no schedule slots
                colorClass = "opacity-60 border-border/50 bg-background text-muted-foreground/70";
              }

              if (isToday && !isSelected) {
                colorClass += " ring-1 ring-primary/45 border-primary/50";
              }

              return (
                <button
                  key={formatted}
                  onClick={() => handleDayClick(formatted)}
                  className={`aspect-square rounded-xl border flex flex-col justify-between p-2 text-left relative transition-all cursor-pointer ${colorClass}`}
                >
                  <span className="text-xs font-bold leading-none">{day.getDate()}</span>

                  {/* Indicators / Badges */}
                  <div className="flex flex-wrap gap-0.5 justify-end w-full">
                    {isHoliday ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-emerald-500"}`} title="Holiday" />
                    ) : isExam ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-amber-500"}`} title="Exam" />
                    ) : isLeave ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-primary-foreground" : "bg-blue-500"}`} title="Leave" />
                    ) : dayOccs.length > 0 ? (
                      dayOccs.map(occ => {
                        let dotColor = "bg-muted-foreground/35";
                        if (occ.attendance_status === "present") dotColor = isSelected ? "bg-primary-foreground" : "bg-emerald-500";
                        else if (occ.attendance_status === "absent") dotColor = isSelected ? "bg-primary-foreground" : "bg-destructive";
                        else if (occ.attendance_status === "cancelled") dotColor = isSelected ? "bg-primary-foreground" : "bg-amber-400";
                        return (
                          <span
                            key={occ.id}
                            className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                            title={`${occ.subject.name}: ${occ.attendance_status}`}
                          />
                        );
                      })
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Informative helper banner in main viewport */}
        <div className="bg-muted/40 border border-border/80 rounded-xl p-4 flex items-center justify-between">
          <div className="flex items-center space-x-3 text-xs">
            <Eye className="h-4.5 w-4.5 text-muted-foreground/80" />
            <span className="text-muted-foreground font-medium">Click any calendar date to display and log status changes in a clean overlay drawer.</span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="text-[10px] font-bold text-primary border border-border bg-card px-2.5 py-1 rounded-lg hover:bg-muted transition-colors cursor-pointer"
          >
            Open Selected Date
          </button>
        </div>

        {/* 2. SIDE DRAWER WITH LECTURE DETAILS AND CHECKLIST EDITING */}
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm transition-opacity" 
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 z-50 h-full w-full sm:max-w-md border-l border-border bg-card shadow-2xl flex flex-col justify-between animate-scale-in text-foreground">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-border/60 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Checked Date</span>
                  <h3 className="text-sm font-bold text-foreground">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Body (Content) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Date Navigator Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => adjustDate(-1)}
                    className="flex-1 rounded-lg border border-border bg-background hover:bg-muted py-2 text-xs font-bold text-foreground cursor-pointer flex justify-center items-center space-x-1"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    <span>Previous Day</span>
                  </button>
                  <button
                    onClick={() => adjustDate(1)}
                    className="flex-1 rounded-lg border border-border bg-background hover:bg-muted py-2 text-xs font-bold text-foreground cursor-pointer flex justify-center items-center space-x-1"
                  >
                    <span>Next Day</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Day status warnings / banners */}
                {dayExam && (
                  <div className="border border-border bg-muted/40 rounded-xl p-5 text-center space-y-4 shadow-sm animate-scale-in">
                    <div className="mx-auto h-11 w-11 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                      <Brain className="h-5.5 w-5.5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-bold text-foreground">{dayExam.description || "Examination Session"}</h4>
                      <p className="text-[10px] text-muted-foreground">
                        {dayExam.start_time ? `${dayExam.start_time.slice(0, 5)} - ${dayExam.end_time?.slice(0, 5)}` : "All Day Session"}
                      </p>
                    </div>
                    <div className="text-[10px] text-amber-600 font-bold uppercase tracking-wider bg-amber-500/5 py-1 px-3 rounded-full inline-block">
                      Good luck for your exam
                    </div>
                  </div>
                )}

                {dayHoliday && (
                  <div className="border border-border bg-muted/40 rounded-xl p-5 text-center space-y-3 shadow-sm animate-scale-in">
                    <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                      <CalendarIcon className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-bold text-foreground">{dayHoliday.description || "Holiday Exception"}</h4>
                    <div className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-500/5 py-1 px-3 rounded-full inline-block">
                      Enjoy your day off
                    </div>
                  </div>
                )}

                {/* Checklist & Lecture Listings */}
                <div className="space-y-3">
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider block">Timetable Slots ({occurrences.length})</span>
                  
                  {loading ? (
                    <div className="flex flex-col justify-center items-center py-16 space-y-3">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
                      <p className="text-[10px] text-muted-foreground">Loading day schedule...</p>
                    </div>
                  ) : isWeekend() && occurrences.length === 0 ? (
                    <div className="border border-border bg-muted/20 rounded-xl p-6 text-center space-y-1.5 animate-scale-in text-muted-foreground">
                      <h4 className="text-xs font-semibold text-foreground">Weekend Exception</h4>
                      <p className="text-[10px]">No weekly lectures scheduled on weekends.</p>
                    </div>
                  ) : occurrences.length === 0 ? (
                    <div className="rounded-xl border border-border bg-muted/10 p-10 text-center text-xs text-muted-foreground italic">
                      No classes scheduled for this date.
                    </div>
                  ) : (
                    <div className="space-y-3.5 animate-scale-in">
                      {occurrences.map((occ) => {
                        const isUpdating = updatingId === occ.id;
                        
                        return (
                          <div 
                            key={occ.id} 
                            className={`rounded-xl border border-border bg-muted/20 p-4 flex flex-col justify-between gap-3.5 transition-all ${
                              isUpdating ? "opacity-60 pointer-events-none" : ""
                            }`}
                          >
                            {/* Lecture metadata */}
                            <div className="space-y-1.5">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-xs font-bold text-foreground">{occ.subject.name}</h4>
                                {occ.subject.code && (
                                  <span className="text-[9px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.2 rounded font-mono uppercase">
                                    {occ.subject.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-[10px] text-muted-foreground space-x-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                              </div>
                            </div>

                            {/* Status controls */}
                            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-border/40">
                              {["present", "absent", "cancelled"].map((status) => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(occ.id, occ.attendance_status === status ? "unmarked" : (status as any))}
                                  className={`text-[9px] font-bold py-1.5 px-3 rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
                                    occ.attendance_status === status
                                      ? status === "present"
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : status === "absent"
                                          ? "bg-destructive text-destructive-foreground border-destructive"
                                          : "bg-amber-500 text-white border-amber-500"
                                      : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                                  }`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-border/60 bg-muted/20 flex justify-end">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-lg bg-primary py-2 px-5 text-xs font-bold text-primary-foreground hover:bg-neutral-800 transition-colors cursor-pointer"
                >
                  Close Panel
                </button>
              </div>

            </div>
          </>
        )}

      </main>
    </div>
  );
};

export default DailyTracker;
