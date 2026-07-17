import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { LectureOccurrence } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { 
  Clock, Loader2, ChevronLeft, ChevronRight, AlertCircle, Brain, Calendar
} from "lucide-react";
import Navbar from "../components/Navbar";

const DailyTracker: React.FC = () => {
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // "YYYY-MM-DD" local format
  );
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
          setSemester(sems[0]);
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
    setSelectedDate(dateObj.toLocaleDateString("en-CA"));
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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      {/* Main Workspace */}
      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12 space-y-8">
        
        {/* Date Selector Banner */}
        <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => adjustDate(-1)}
              className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold tracking-tight text-foreground">
              {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </span>
            <button
              onClick={() => adjustDate(1)}
              className="p-2 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Date Picker Input */}
          <div className="relative">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
              className="block rounded-lg border border-border bg-background py-2 px-3 text-xs text-foreground font-medium outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
            />
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* Lectures List */}
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
            Scheduled Events
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : dayExam ? (
            /* EXAM DAY DETAILED BANNER */
            <div className="border border-border bg-card rounded-xl p-8 text-center space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
              <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                <Brain className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-foreground">{dayExam.description || "Examination Session"}</h4>
                <p className="text-xs text-muted-foreground">
                  {dayExam.start_time ? `${dayExam.start_time.slice(0, 5)} - ${dayExam.end_time?.slice(0, 5)}` : "All Day Session"}
                </p>
                {dayExam.subject && (
                  <span className="inline-block text-[10px] bg-muted border border-border px-2 py-0.5 rounded mt-1 font-semibold text-muted-foreground uppercase">
                    {dayExam.subject.name}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider bg-amber-500/5 py-1 px-3 rounded-full inline-block">
                Good luck for your exam
              </div>
              <p className="text-[10px] text-muted-foreground italic">No regular lectures today.</p>
            </div>
          ) : dayHoliday ? (
            /* HOLIDAY SMART EMPTY STATE */
            <div className="border border-border bg-card rounded-xl p-8 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
              <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <Calendar className="h-5 w-5" />
              </div>
              <h4 className="text-sm font-semibold text-foreground">{dayHoliday.description || "Holiday"}</h4>
              <div className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider bg-emerald-500/5 py-1 px-3 rounded-full inline-block">
                Enjoy your day off
              </div>
            </div>
          ) : isWeekend() && occurrences.length === 0 ? (
            /* WEEKEND SMART EMPTY STATE */
            <div className="border border-border bg-card rounded-xl p-8 text-center space-y-3 shadow-[0_1px_3px_rgba(0,0,0,0.01)]">
              <h4 className="text-sm font-semibold text-foreground">Weekend</h4>
              <p className="text-xs text-muted-foreground">No lectures scheduled today.</p>
            </div>
          ) : occurrences.length === 0 ? (
            /* REGULAR EMPTY STATE */
            <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground italic">
              No classes scheduled for this date.
            </div>
          ) : (
            <div className="space-y-4">
              {occurrences.map((occ) => {
                const isUpdating = updatingId === occ.id;
                
                return (
                  <div 
                    key={occ.id} 
                    className={`rounded-xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all ${
                      isUpdating ? "opacity-60 pointer-events-none" : ""
                    }`}
                  >
                    {/* Class metadata */}
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-semibold text-foreground">{occ.subject.name}</h4>
                        {occ.subject.code && (
                          <span className="text-[10px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.5 rounded">
                            {occ.subject.code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center text-xs text-muted-foreground space-x-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                      </div>
                    </div>

                    {/* Attendance status selection control */}
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Present Button */}
                      <button
                        onClick={() => handleStatusChange(occ.id, occ.attendance_status === "present" ? "unmarked" : "present")}
                        className={`text-xs py-2 px-3.5 rounded-lg border font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all cursor-pointer ${
                          occ.attendance_status === "present"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Present
                      </button>

                      {/* Absent Button */}
                      <button
                        onClick={() => handleStatusChange(occ.id, occ.attendance_status === "absent" ? "unmarked" : "absent")}
                        className={`text-xs py-2 px-3.5 rounded-lg border font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all cursor-pointer ${
                          occ.attendance_status === "absent"
                            ? "bg-destructive text-destructive-foreground border-destructive"
                            : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Absent
                      </button>

                      {/* Cancelled Button */}
                      <button
                        onClick={() => handleStatusChange(occ.id, occ.attendance_status === "cancelled" ? "unmarked" : "cancelled")}
                        className={`text-xs py-2 px-3.5 rounded-lg border font-medium shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all cursor-pointer ${
                          occ.attendance_status === "cancelled"
                            ? "bg-accent border-border/80 text-foreground"
                            : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        Cancelled
                      </button>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default DailyTracker;
