import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { LectureOccurrence } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { 
  Clock, Loader2, ChevronLeft, ChevronRight, AlertCircle, Brain, Calendar as CalendarIcon
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

  const calendarDays = getCalendarDays();
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
        
        {/* Header */}
        <div className="border-b border-border/80 pb-4">
          <h1 className="text-xl font-bold tracking-tight">Daily Tracker & Calendar</h1>
          <p className="text-xs text-muted-foreground">Mark attendance checklist, schedule exceptions, or plan semester dates.</p>
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
                onClick={() => setCurrentMonth(new Date())}
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
              const isToday = new Date().toLocaleDateString("en-CA") === formatted;
              
              // Filter occurrences for this day to show small color indicators
              const dayOccs = monthOccurrences.filter(o => o.date === formatted);
              
              // Find calendar exceptions
              const dayEv = allEvents.find(e => e.date === formatted);
              const isHoliday = dayEv && ["holiday", "college_closure", "exam_break"].includes(dayEv.event_type);
              const isExam = dayEv && (dayEv.event_type === "exam_day" || dayEv.event_type === "exam");
              const isLeave = dayEv && dayEv.event_type === "leave";

              return (
                <button
                  key={formatted}
                  onClick={() => setSelectedDate(formatted)}
                  className={`aspect-square rounded-xl border flex flex-col justify-between p-2 text-left relative transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary border-primary text-primary-foreground shadow-sm"
                      : isToday
                      ? "border-primary bg-muted/20 text-foreground"
                      : "border-border/80 bg-background text-foreground hover:bg-muted/40 hover:border-foreground/10"
                  }`}
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
                      // Show dots for status
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

        {/* 2. DAILY DETAIL & CHECKLIST */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Checklist Left Panel (Today's Summary Details) */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 pb-2">
              Selected Date Summary
            </h3>
            
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm space-y-4">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Conducted Check</span>
                <h4 className="text-sm font-bold text-foreground leading-normal">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </h4>
              </div>

              {/* Adjust selected date buttons */}
              <div className="flex gap-2 pt-2">
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
            </div>
          </div>

          {/* Checklist Right Panel (Actual Lectures Checklist) */}
          <div className="md:col-span-2 space-y-4">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest border-b border-border/60 pb-2">
              Checklist & Lectures
            </h3>

            {loading ? (
              <div className="flex flex-col justify-center items-center py-16 space-y-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-[10px] text-muted-foreground">Loading day schedule...</p>
              </div>
            ) : dayExam ? (
              <div className="border border-border bg-card rounded-xl p-8 text-center space-y-4 shadow-sm animate-scale-in">
                <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                  <Brain className="h-6 w-6" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground">{dayExam.description || "Examination Session"}</h4>
                  <p className="text-xs text-muted-foreground">
                    {dayExam.start_time ? `${dayExam.start_time.slice(0, 5)} - ${dayExam.end_time?.slice(0, 5)}` : "All Day Session"}
                  </p>
                </div>
                <div className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider bg-amber-500/5 py-1 px-3 rounded-full inline-block">
                  Good luck for your exam
                </div>
              </div>
            ) : dayHoliday ? (
              <div className="border border-border bg-card rounded-xl p-8 text-center space-y-3 shadow-sm animate-scale-in">
                <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <CalendarIcon className="h-5 w-5" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">{dayHoliday.description || "Holiday"}</h4>
                <div className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider bg-emerald-500/5 py-1 px-3 rounded-full inline-block">
                  Enjoy your day off
                </div>
              </div>
            ) : isWeekend() && occurrences.length === 0 ? (
              <div className="border border-border bg-card rounded-xl p-8 text-center space-y-2 shadow-sm animate-scale-in">
                <h4 className="text-sm font-semibold text-foreground">Weekend</h4>
                <p className="text-xs text-muted-foreground">No lectures scheduled today.</p>
              </div>
            ) : occurrences.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-10 text-center text-xs text-muted-foreground italic">
                No classes scheduled for this date.
              </div>
            ) : (
              <div className="space-y-3 animate-scale-in">
                {occurrences.map((occ) => {
                  const isUpdating = updatingId === occ.id;
                  
                  return (
                    <div 
                      key={occ.id} 
                      className={`rounded-xl border border-border bg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-sm ${
                        isUpdating ? "opacity-60 pointer-events-none" : ""
                      }`}
                    >
                      {/* Lecture Metadata */}
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-xs font-bold text-foreground">{occ.subject.name}</h4>
                          {occ.subject.code && (
                            <span className="text-[9px] bg-muted border border-border/85 text-muted-foreground px-1.5 py-0.2 rounded font-mono uppercase">
                              {occ.subject.code}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center text-[10px] text-muted-foreground space-x-1.5">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                        </div>
                      </div>

                      {/* Attendance Selectors */}
                      <div className="flex flex-wrap items-center gap-1.5">
                        {["present", "absent", "cancelled"].map((status) => (
                          <button
                            key={status}
                            onClick={() => handleStatusChange(occ.id, occ.attendance_status === status ? "unmarked" : (status as any))}
                            className={`text-[10px] font-bold py-1.5 px-3 rounded-lg border transition-all cursor-pointer uppercase tracking-wider ${
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

      </main>
    </div>
  );
};

export default DailyTracker;
