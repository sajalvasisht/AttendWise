import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  Loader2, AlertCircle, Clock, Calendar, Brain
} from "lucide-react";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { SubjectAttendanceStats, LectureOccurrence, UpcomingDaySchedule } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import Navbar from "../components/Navbar";

const Dashboard: React.FC = () => {
  const [semester, setSemester] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<SubjectAttendanceStats[]>([]);
  const [todayLectures, setTodayLectures] = useState<LectureOccurrence[]>([]);
  const [nextHoliday, setNextHoliday] = useState<CalendarEvent | null>(null);
  const [todayExam, setTodayExam] = useState<CalendarEvent | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<CalendarEvent | null>(null);
  const [upcomingDays, setUpcomingDays] = useState<UpcomingDaySchedule[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          setLoading(false);
          return;
        }

        const activeSem = sems[0];
        setSemester(activeSem);

        // Fetch subjects, today's schedule, calendar exceptions, and upcoming schedule
        const [subjsData, todayData, allEvents, upcomingData] = await Promise.all([
          attendanceService.getSubjectsAttendance(activeSem.id),
          attendanceService.getToday(activeSem.id),
          calendarService.list(activeSem.id),
          attendanceService.getUpcoming(activeSem.id)
        ]);

        // Find today's events (holiday/closure/exam)
        const todayStr = new Date().toLocaleDateString("en-CA");
        const todayEvs = allEvents.filter(e => e.date === todayStr);
        
        const examEv = todayEvs.find(e => e.event_type === "exam_day" || e.event_type === "exam");
        const holidayEv = todayEvs.find(e => ["holiday", "college_closure", "exam_break"].includes(e.event_type));
        
        setTodayExam(examEv || null);
        setTodayHoliday(holidayEv || null);

        // Find the next holiday exception in the future
        const upcomingHolidays = allEvents
          .filter(e => e.date >= todayStr && ["holiday", "college_closure", "exam_break"].includes(e.event_type))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        if (upcomingHolidays.length > 0) {
          setNextHoliday(upcomingHolidays[0]);
        }

        // Sort subject cards: 1. Below Threshold, 2. Warning, 3. Safe
        const sortedSubjects = [...subjsData].sort((a, b) => {
          const getPriority = (s: SubjectAttendanceStats) => {
            if (s.attendance_percent < s.min_attendance_percent) return 1;
            if (s.safe_bunks === 0) return 2;
            return 3;
          };
          return getPriority(a) - getPriority(b);
        });

        setSubjects(sortedSubjects);
        setTodayLectures(todayData);
        setUpcomingDays(upcomingData);
      } catch (err) {
        console.error("Error fetching dashboard statistics:", err);
        setError("Error loading workspace data.");
      } finally {
        setLoading(false);
      }
    };
    fetchDashboardData();
  }, []);

  const handleStatusChange = async (occurrenceId: number, status: "present" | "absent" | "cancelled" | "unmarked") => {
    if (!semester) return;
    setUpdatingId(occurrenceId);
    setError(null);

    try {
      const updated = await attendanceService.updateStatus(semester.id, occurrenceId, status);
      
      setTodayLectures(prev => 
        prev.map(occ => occ.id === occurrenceId ? { ...occ, attendance_status: updated.attendance_status } : occ)
      );

      const subjsData = await attendanceService.getSubjectsAttendance(semester.id);

      const sortedSubjects = [...subjsData].sort((a, b) => {
        const getPriority = (s: SubjectAttendanceStats) => {
          if (s.attendance_percent < s.min_attendance_percent) return 1;
          if (s.safe_bunks === 0) return 2;
          return 3;
        };
        return getPriority(a) - getPriority(b);
      });

      setSubjects(sortedSubjects);
    } catch (err) {
      console.error("Failed to update status", err);
      setError("Failed to record attendance. Please try again.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper calculations for Hero banner
  const getDaysRemaining = () => {
    if (!semester) return 0;
    const end = new Date(semester.end_date + "T00:00:00").getTime();
    const today = new Date(new Date().toLocaleDateString("en-CA") + "T00:00:00").getTime();
    return Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
  };

  const getNextHolidayString = () => {
    if (!nextHoliday) return "None scheduled";
    const dateObj = new Date(nextHoliday.date + "T00:00:00");
    const formattedDate = dateObj.toLocaleDateString(undefined, { day: "numeric", month: "short" });
    return `${formattedDate}${nextHoliday.description ? ` (${nextHoliday.description})` : ""}`;
  };

  const isWeekend = () => {
    if (!semester) return false;
    const todayStr = new Date().toLocaleDateString("en-CA");
    const todayWeekday = new Date(todayStr + "T00:00:00").getDay();
    const backendWeekdayMap = [6, 0, 1, 2, 3, 4, 5];
    const targetIndex = backendWeekdayMap[todayWeekday];
    const workingDaysSet = semester.working_days ? semester.working_days.split(",").map(Number) : [0, 1, 2, 3, 4];
    return !workingDaysSet.includes(targetIndex);
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !semester ? (
          /* Welcome state - No Semester yet */
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-center space-y-4">
            <h1 className="text-lg font-bold text-foreground">Semester not configured</h1>
            <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
              Complete Setup to generate your timetable and begin tracking leaves.
            </p>
            <Link 
              to="/setup"
              className="inline-flex items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800"
            >
              Configure Semester Setup
            </Link>
          </div>
        ) : (
          /* Active state - Real attendance calculations */
          <div className="space-y-10">
            
            {/* Subject-First Smart Hero Header */}
            <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
              <div className="space-y-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Semester Term</span>
                <span className="block text-base font-bold text-foreground truncate">{semester.name}</span>
              </div>
              <div className="space-y-1 border-l border-border/60 pl-0 md:pl-6">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Days Remaining</span>
                <span className="block text-lg font-bold text-foreground">{getDaysRemaining()} Days</span>
              </div>
              <div className="space-y-1 border-l border-border/60 pl-0 md:pl-6">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Today's Lectures</span>
                <span className="block text-lg font-bold text-foreground">
                  {todayExam ? "Exam Day" : `${todayLectures.length} Classes`}
                </span>
              </div>
              <div className="space-y-1 border-l border-border/60 pl-0 md:pl-6 col-span-2 md:col-span-1">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Next Holiday</span>
                <span className="block text-xs font-bold text-foreground truncate">{getNextHolidayString()}</span>
              </div>
            </div>

            {/* SUBJECT-FIRST STANDINGS GRID */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Course Standings
              </h3>

              {subjects.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground italic">
                  No courses added. Go to Setup to configure your subjects.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {subjects.map((subj) => {
                    const isBelow = subj.attendance_percent < subj.min_attendance_percent;
                    const isWarning = !isBelow && subj.safe_bunks === 0;
                    
                    let statusLabel = "";
                    let statusClass = "";
                    let bannerText = "";
                    
                    if (isBelow) {
                      statusLabel = "Below Threshold";
                      statusClass = "bg-destructive/10 text-destructive border border-destructive/10";
                      bannerText = `Attend the next ${subj.required_to_attend} lectures`;
                    } else if (isWarning) {
                      statusLabel = "Warning";
                      statusClass = "bg-amber-500/10 text-amber-600 border border-amber-500/10";
                      bannerText = "Cannot miss any more lectures";
                    } else {
                      statusLabel = "Safe";
                      statusClass = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/10";
                      bannerText = `Can miss ${subj.safe_bunks} more lectures`;
                    }

                    return (
                      <div 
                        key={subj.subject_id} 
                        className={`border rounded-xl p-5 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between space-y-4 hover:border-foreground/10 transition-all ${
                          isBelow ? "border-destructive/20" : isWarning ? "border-amber-500/20" : "border-border"
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="space-y-0.5">
                            <h4 className="text-xs font-semibold text-foreground leading-tight">{subj.name}</h4>
                            {subj.code && (
                              <span className="text-[9px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.2 rounded font-semibold uppercase">
                                {subj.code}
                              </span>
                            )}
                          </div>

                          <div className="text-right">
                            <span className={`text-sm font-bold ${isBelow ? "text-destructive" : isWarning ? "text-amber-600" : "text-foreground"}`}>
                              {subj.attendance_percent}%
                            </span>
                            <span className="block text-[8px] text-muted-foreground font-medium mt-0.5">
                              Req: {subj.min_attendance_percent}%
                            </span>
                          </div>
                        </div>

                        <div className="text-[11px] pt-1.5 border-t border-border/40 flex items-center justify-between">
                          <span className={`text-[8px] border font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${statusClass}`}>
                            {statusLabel}
                          </span>
                          <span className={`font-semibold ${isBelow ? "text-destructive" : isWarning ? "text-amber-600" : "text-emerald-600"}`}>
                            {bannerText}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* TODAY'S SCHEDULE CHECKLIST OR EXAM OVERRIDE */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Today's Schedule
              </h3>

              {todayExam ? (
                <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-center space-y-4">
                  <div className="mx-auto h-12 w-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                    <Brain className="h-6 w-6" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-foreground">{todayExam.description || "Examination Session"}</h4>
                    <p className="text-xs text-muted-foreground">
                      {todayExam.start_time ? `${todayExam.start_time.slice(0, 5)} - ${todayExam.end_time?.slice(0, 5)}` : "All Day Session"}
                    </p>
                    {todayExam.subject && (
                      <span className="inline-block text-[10px] bg-muted border border-border px-2 py-0.5 rounded mt-1 font-semibold text-muted-foreground uppercase">
                        {todayExam.subject.name}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-amber-600 font-semibold uppercase tracking-wider bg-amber-500/5 py-1 px-3 rounded-full inline-block">
                    Good luck for your exam
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">No regular lectures today.</p>
                </div>
              ) : todayHoliday ? (
                <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-center space-y-3">
                  <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                    <Calendar className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">{todayHoliday.description || "Holiday"}</h4>
                  <div className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider bg-emerald-500/5 py-1 px-3 rounded-full inline-block">
                    Enjoy your day off
                  </div>
                </div>
              ) : isWeekend() && todayLectures.length === 0 ? (
                <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-center space-y-3">
                  <h4 className="text-sm font-semibold text-foreground">Weekend</h4>
                  <p className="text-xs text-muted-foreground">No lectures scheduled today.</p>
                </div>
              ) : todayLectures.length === 0 ? (
                <div className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.01)] text-center text-xs text-muted-foreground italic">
                  No lectures scheduled today.
                </div>
              ) : (
                <div className="space-y-3">
                  {todayLectures.map((occ) => {
                    const isUpdating = updatingId === occ.id;
                    
                    return (
                      <div 
                        key={occ.id} 
                        className={`rounded-xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                          isUpdating ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-semibold text-foreground">{occ.subject.name}</span>
                            {occ.subject.code && (
                              <span className="text-[9px] bg-muted border border-border/80 text-muted-foreground px-1 py-0.2 rounded font-semibold uppercase">
                                {occ.subject.code}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center text-[10px] text-muted-foreground space-x-1.5">
                            <Clock className="h-3 w-3" />
                            <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleStatusChange(occ.id, occ.attendance_status === "present" ? "unmarked" : "present")}
                            className={`text-[10px] py-1 px-2.5 rounded-md border font-medium transition-all cursor-pointer ${
                              occ.attendance_status === "present"
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Present
                          </button>
                          <button
                            onClick={() => handleStatusChange(occ.id, occ.attendance_status === "absent" ? "unmarked" : "absent")}
                            className={`text-[10px] py-1 px-2.5 rounded-md border font-medium transition-all cursor-pointer ${
                              occ.attendance_status === "absent"
                                ? "bg-destructive text-destructive-foreground border-destructive"
                                : "bg-background border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            Absent
                          </button>
                          <button
                            onClick={() => handleStatusChange(occ.id, occ.attendance_status === "cancelled" ? "unmarked" : "cancelled")}
                            className={`text-[10px] py-1 px-2.5 rounded-md border font-medium transition-all cursor-pointer ${
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

            {/* UPCOMING SCHEDULE PREVIEW */}
            <div className="space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Upcoming Schedule
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {upcomingDays.map((day, idx) => {
                  let exceptionLabel = "";
                  let exceptionClass = "";
                  
                  if (day.event_type) {
                    if (["holiday", "college_closure", "exam_break"].includes(day.event_type)) {
                      exceptionLabel = day.description || "Holiday";
                      exceptionClass = "bg-emerald-500/5 text-emerald-600 border border-emerald-500/10";
                    } else if (day.event_type === "exam_day" || day.event_type === "exam") {
                      exceptionLabel = day.description || "Exam Day";
                      exceptionClass = "bg-amber-500/5 text-amber-600 border border-amber-500/10";
                    } else if (day.event_type === "weekend") {
                      exceptionLabel = "Weekend";
                      exceptionClass = "bg-muted text-muted-foreground border border-border/80";
                    }
                  }

                  return (
                    <div key={idx} className="border border-border bg-card rounded-xl p-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between space-y-3 min-h-28">
                      <div>
                        <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">
                          {day.day_label}
                        </span>
                        <span className="text-[9px] text-muted-foreground font-medium block">
                          {day.date}
                        </span>
                      </div>

                      {day.event_type ? (
                        <span className={`text-[10px] font-semibold text-center p-2 rounded-lg ${exceptionClass}`}>
                          {exceptionLabel}
                        </span>
                      ) : day.occurrences.length === 0 ? (
                        <span className="text-[10px] text-muted-foreground italic text-center p-2 border border-border/40 rounded-lg">
                          No classes
                        </span>
                      ) : (
                        <div className="space-y-1.5 pr-1 max-h-16 overflow-y-auto">
                          {day.occurrences.map((occ, oIdx) => (
                            <div key={oIdx} className="flex items-center justify-between text-[10px] font-medium border-b border-border/40 pb-1 last:border-b-0">
                              <span className="text-foreground truncate max-w-[100px]" title={occ.subject.name}>
                                {occ.subject.name}
                              </span>
                              <span className="text-muted-foreground text-[9px] font-normal shrink-0">
                                {occ.start_time.slice(0, 5)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="max-w-4xl mx-auto w-full px-6 border-t border-border/40 py-8 flex justify-between items-center text-[10px] text-muted-foreground tracking-wide font-medium">
        <span>ATTENDWISE MVP</span>
        <span>2026 SEMESTER PLANNER</span>
      </footer>
    </div>
  );
};

export default Dashboard;
