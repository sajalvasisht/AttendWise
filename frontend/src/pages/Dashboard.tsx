import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Loader2, AlertCircle, Clock, Brain, Trash2, 
  Upload, CalendarDays, RefreshCw, ChevronRight
} from "lucide-react";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { SubjectAttendanceStats, LectureOccurrence } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { aiService } from "../services/ai";
import { timetableService } from "../services/timetable";
import Navbar from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [semester, setSemester] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<SubjectAttendanceStats[]>([]);
  const [todayLectures, setTodayLectures] = useState<LectureOccurrence[]>([]);
  const [nextHoliday, setNextHoliday] = useState<CalendarEvent | null>(null);
  const [todayExam, setTodayExam] = useState<CalendarEvent | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<CalendarEvent | null>(null);
  const [upcomingAssessments, setUpcomingAssessments] = useState<CalendarEvent[]>([]);
  const [plannerSuggestions, setPlannerSuggestions] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Quick Action Modal states
  const [activeModal, setActiveModal] = useState<"none" | "restart" | "replace_timetable" | "replace_calendar">("none");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [savingReplace, setSavingReplace] = useState(false);
  const [calendarMergeMode, setCalendarMergeMode] = useState<"merge" | "replace">("replace");

  const navigate = useNavigate();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  };

  const fetchDashboardData = async () => {
    try {
      const sems = await semesterService.list();
      if (sems.length === 0) {
        setLoading(false);
        navigate("/welcome");
        return;
      }

      const activeSem = sems.find(s => s.is_active) || sems[0];
      setSemester(activeSem);

      // Fetch stats, schedules and suggestions
      const [subjsData, todayData, allEvents] = await Promise.all([
        attendanceService.getSubjectsAttendance(activeSem.id),
        attendanceService.getToday(activeSem.id),
        calendarService.list(activeSem.id)
      ]);

      const todayStr = new Date().toLocaleDateString("en-CA");
      const todayEvs = allEvents.filter(e => e.date === todayStr);
      
      const examEv = todayEvs.find(e => e.event_type === "exam_day" || e.event_type === "exam");
      const holidayEv = todayEvs.find(e => ["holiday", "college_closure", "exam_break"].includes(e.event_type));
      
      setTodayExam(examEv || null);
      setTodayHoliday(holidayEv || null);

      // Next Holiday
      const upcomingHolidays = allEvents
        .filter(e => e.date >= todayStr && ["holiday", "college_closure", "exam_break"].includes(e.event_type))
        .sort((a, b) => a.date.localeCompare(b.date));
      
      if (upcomingHolidays.length > 0) {
        setNextHoliday(upcomingHolidays[0]);
      }

      // Assessments
      const assessments = allEvents
        .filter(e => e.date >= todayStr && ["exam_day", "exam", "assessment"].includes(e.event_type.toLowerCase()))
        .sort((a, b) => a.date.localeCompare(b.date));
      setUpcomingAssessments(assessments.slice(0, 3));

      // Planner Suggestions
      try {
        const suggestions = await import("../services/planner").then((m) => m.plannerService.getSuggestions(activeSem.id));
        setPlannerSuggestions(suggestions.slice(0, 2));
      } catch (e) {
        console.error("Planner suggestions error", e);
      }

      // Sort subject cards
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
    } catch (err) {
      console.error("Error fetching dashboard statistics:", err);
      setError("Error loading workspace data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const handleRestartSetup = async () => {
    if (!semester) return;
    setLoading(true);
    try {
      await semesterService.delete(semester.id);
      localStorage.removeItem("setup_step");
      localStorage.removeItem("setup_method");
      setSemester(null);
      navigate("/setup");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to restart setup.");
    } finally {
      setLoading(false);
      setActiveModal("none");
    }
  };

  const handleReplaceTimetableUpload = async () => {
    if (!uploadFile || !semester) return;
    setExtracting(true);
    setError(null);
    try {
      const response = await aiService.extractTimetable(uploadFile);
      setExtractedData(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Timetable extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmReplaceTimetable = async () => {
    if (!semester || !extractedData) return;
    setSavingReplace(true);
    try {
      // Map extracted slot subject names to database subject IDs
      const slotsToSave = extractedData.timetable_slots.map((slot: any) => {
        const matched = subjects.find(s => 
          s.name.toLowerCase() === slot.subject_name.toLowerCase() ||
          (slot.subject_code && s.code && s.code.toLowerCase() === slot.subject_code.toLowerCase())
        );
        return {
          subject_id: matched ? matched.subject_id : subjects[0]?.subject_id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time
        };
      });

      await timetableService.save(semester.id, slotsToSave);
      setActiveModal("none");
      setUploadFile(null);
      setExtractedData(null);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to replace timetable.");
    } finally {
      setSavingReplace(false);
    }
  };

  const handleReplaceCalendarUpload = async () => {
    if (!uploadFile || !semester) return;
    setExtracting(true);
    setError(null);
    try {
      const response = await aiService.extractCalendar(uploadFile);
      setExtractedData(response);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Calendar extraction failed.");
    } finally {
      setExtracting(false);
    }
  };

  const handleConfirmReplaceCalendar = async () => {
    if (!semester || !extractedData) return;
    setSavingReplace(true);
    try {
      const parsedEvents = extractedData.events.map((ev: any) => {
        let mappedType = "holiday";
        const cat = ev.category.toLowerCase();
        if (cat.includes("holiday")) mappedType = "holiday";
        else if (cat.includes("closure") || cat.includes("closed")) mappedType = "college_closure";
        else if (cat.includes("override")) mappedType = "working_day_override";
        else if (cat.includes("assessment")) mappedType = "exam_day";
        else if (cat.includes("break")) mappedType = "exam_break";

        const matched = subjects.find(s => 
          (ev.subject_name && s.name.toLowerCase() === ev.subject_name.toLowerCase()) ||
          (ev.subject_code && s.code && s.code.toLowerCase() === ev.subject_code.toLowerCase())
        );

        return {
          date: ev.date,
          event_type: mappedType,
          description: ev.description || ev.title,
          timetable_day_override: ev.timetable_day_override !== undefined ? ev.timetable_day_override : undefined,
          subject_id: matched ? matched.subject_id : undefined,
          start_time: ev.start_time || undefined,
          end_time: ev.end_time || undefined
        };
      });

      let finalEvents = parsedEvents;
      if (calendarMergeMode === "merge") {
        const currentEventsResponse = await calendarService.list(semester.id);
        const existingEvents = currentEventsResponse.map((e: any) => ({
          date: e.date,
          event_type: e.event_type,
          description: e.description,
          timetable_day_override: e.timetable_day_override,
          subject_id: e.subject_id,
          start_time: e.start_time,
          end_time: e.end_time
        }));
        // Merge without duplicate dates
        const newDates = new Set(parsedEvents.map((e: any) => e.date));
        const filteredExisting = existingEvents.filter((e: any) => !newDates.has(e.date));
        finalEvents = [...filteredExisting, ...parsedEvents];
      }

      await calendarService.save(semester.id, finalEvents);
      setActiveModal("none");
      setUploadFile(null);
      setExtractedData(null);
      fetchDashboardData();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to replace calendar.");
    } finally {
      setSavingReplace(false);
    }
  };

  const getDaysRemaining = () => {
    if (!semester) return 0;
    const end = new Date(semester.end_date + "T00:00:00").getTime();
    const today = new Date(new Date().toLocaleDateString("en-CA") + "T00:00:00").getTime();
    return Math.max(0, Math.ceil((end - today) / (1000 * 60 * 60 * 24)));
  };

  const isUninitialized = subjects.length > 0 && !subjects[0].is_initialized;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 space-y-8">
        
        {/* Global Error */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3 animate-fade-in shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/80" />
            <p className="text-xs text-muted-foreground">Loading workspace details...</p>
          </div>
        ) : !semester ? (
          <div className="flex flex-col items-center justify-center py-24 space-y-4 animate-scale-in">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Redirecting to onboarding guide...</p>
          </div>
        ) : (
          /* Active State */
          <div className="space-y-6">
            {/* Welcoming Header */}
            <div className="space-y-1">
              <h1 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-1.5">
                <span>{getGreeting()}, {user?.full_name || "Student"}!</span>
                <span className="text-base">👋</span>
              </h1>
              <p className="text-xs text-muted-foreground">
                Here is your AttendWise status overview. Keep your planning on track!
              </p>
            </div>

            {/* 1. HERO BANNER ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Term Statistics Card */}
              <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-32">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Semester Profile</span>
                <div>
                  <h2 className="text-sm font-semibold tracking-tight text-foreground truncate">{semester.name}</h2>
                  <div className="flex items-center text-[10px] text-muted-foreground mt-1 space-x-2">
                    <span>{semester.start_date}</span>
                    <ChevronRight className="h-3 w-3" />
                    <span>{semester.end_date}</span>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-medium border-t border-border/50 pt-2 flex items-center justify-between">
                  <span>Days remaining:</span>
                  <span className="font-semibold text-foreground">{getDaysRemaining()} days</span>
                </div>
              </div>

              {/* Next Holiday Card */}
              <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-32">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Calendar Watch</span>
                <div>
                  <h2 className="text-xs font-semibold tracking-tight text-foreground">Next Scheduled Break</h2>
                  <p className="text-sm font-bold text-foreground mt-1 truncate">
                    {nextHoliday ? nextHoliday.description || "Holiday" : "None scheduled"}
                  </p>
                </div>
                <div className="text-[10px] text-muted-foreground font-medium border-t border-border/50 pt-2 flex items-center justify-between">
                  <span>Date:</span>
                  <span className="font-semibold text-foreground">{nextHoliday ? nextHoliday.date : "N/A"}</span>
                </div>
              </div>

              {/* Attendance Status Card */}
              <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] flex flex-col justify-between min-h-32">
                <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Attendance Summary</span>
                {isUninitialized ? (
                  <div>
                    <h2 className="text-xs font-semibold text-destructive">Not Initialized</h2>
                    <p className="text-[10px] text-muted-foreground leading-normal mt-1">
                      Calculations are disabled until baseline values are entered.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h2 className="text-sm font-bold text-foreground">
                      {subjects.length > 0 ? (subjects.reduce((sum, s) => sum + s.attendance_percent, 0) / subjects.length).toFixed(1) : "0.0"}%
                    </h2>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Safe Bunks Budget: {subjects.reduce((sum, s) => sum + s.safe_bunks, 0)} classes
                    </p>
                  </div>
                )}
                <div className="border-t border-border/50 pt-2">
                  {isUninitialized ? (
                    <Link to="/initialize-attendance" className="text-[10px] font-semibold text-primary hover:underline flex items-center">
                      Initialize Now <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  ) : (
                    <Link to="/summary" className="text-[10px] font-semibold text-primary hover:underline flex items-center">
                      View Detailed Metrics <ChevronRight className="h-3 w-3 ml-0.5" />
                    </Link>
                  )}
                </div>
              </div>

            </div>

            {/* 2. ATTENDANCE INITIALIZATION CALLOUT */}
            {isUninitialized && (
              <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] animate-fade-in">
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-destructive">Setup Complete: Attendance Not Initialized</h4>
                  <p className="text-[11px] text-muted-foreground leading-relaxed max-w-xl">
                    Enter the number of classes conducted and attended so far to activate tracking analytics.
                  </p>
                </div>
                <Link 
                  to="/initialize-attendance"
                  className="rounded-lg bg-primary py-1.5 px-3.5 text-xs font-semibold text-primary-foreground hover:bg-neutral-800 shadow-sm transition-all shrink-0 text-center cursor-pointer"
                >
                  Initialize Attendance
                </Link>
              </div>
            )}

            {/* 3. WORKING WORKSPACE GRID */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Left & Middle Column (Main Content) */}
              <div className="md:col-span-2 space-y-8">
                
                {/* TODAY'S SCHEDULE CHECKLIST */}
                <div className="space-y-4">
                  <div className="border-b border-border/60 pb-2 flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Today's Schedule
                    </h3>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {isUninitialized ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground italic">
                      Initialize attendance first to access today's checklist.
                    </div>
                  ) : todayExam ? (
                    <div className="border border-border bg-card rounded-xl p-6 text-center space-y-3">
                      <div className="mx-auto h-9 w-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
                        <Brain className="h-4.5 w-4.5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold">{todayExam.description || "Examination"}</h4>
                        <p className="text-[10px] text-muted-foreground">
                          {todayExam.start_time ? `${todayExam.start_time.slice(0, 5)} - ${todayExam.end_time?.slice(0, 5)}` : "All Day"}
                        </p>
                      </div>
                      <p className="text-[10px] text-amber-600 font-medium">Good luck on your exam!</p>
                    </div>
                  ) : todayHoliday ? (
                    <div className="border border-border bg-card rounded-xl p-6 text-center space-y-2">
                      <div className="mx-auto h-9 w-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                        <CalendarDays className="h-4.5 w-4.5" />
                      </div>
                      <h4 className="text-xs font-bold">{todayHoliday.description || "Holiday"}</h4>
                      <span className="text-[9px] text-emerald-600 bg-emerald-500/5 px-2 py-0.5 rounded-full inline-block font-semibold">
                        Enjoy your break!
                      </span>
                    </div>
                  ) : todayLectures.length === 0 ? (
                    <div className="border border-border bg-card rounded-xl p-6 text-center text-xs text-muted-foreground italic">
                      No classes scheduled today.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {todayLectures.map((occ) => {
                        const isUpdating = updatingId === occ.id;
                        return (
                          <div 
                            key={occ.id} 
                            className={`rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.01)] hover:border-foreground/5 ${
                              isUpdating ? "opacity-60 pointer-events-none" : ""
                            }`}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center space-x-2">
                                <span className="text-xs font-semibold text-foreground truncate">{occ.subject.name}</span>
                                {occ.subject.code && (
                                  <span className="text-[9px] bg-muted border border-border px-1.5 py-0.2 rounded font-mono uppercase shrink-0">
                                    {occ.subject.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-[10px] text-muted-foreground mt-1 space-x-1.5">
                                <Clock className="h-3 w-3" />
                                <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              {["present", "absent", "cancelled"].map((status) => (
                                <button
                                  key={status}
                                  onClick={() => handleStatusChange(occ.id, occ.attendance_status === status ? "unmarked" : (status as any))}
                                  className={`text-[9px] font-semibold py-1 px-2.5 rounded-md border transition-all cursor-pointer uppercase tracking-wider ${
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

                {/* COURSE STANDINGS GRID */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/60 pb-2">
                    Course Standings
                  </h3>

                  {isUninitialized ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground italic">
                      Initialize attendance to display standings.
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground italic">
                      No subjects configured.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {subjects.map((subj) => {
                        const isBelow = subj.attendance_percent < subj.min_attendance_percent;
                        const isWarning = !isBelow && subj.safe_bunks === 0;
                        
                        let statusColor = "text-emerald-600";
                        let statusBorder = "border-border hover:border-emerald-600/20";
                        if (isBelow) {
                          statusColor = "text-destructive";
                          statusBorder = "border-destructive/20";
                        } else if (isWarning) {
                          statusColor = "text-amber-600";
                          statusBorder = "border-amber-500/20";
                        }

                        return (
                          <div 
                            key={subj.subject_id} 
                            className={`border rounded-xl p-4 bg-card shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between space-y-4 hover:shadow-[0_2px_6px_rgba(0,0,0,0.02)] transition-all ${statusBorder}`}
                          >
                            <div className="flex justify-between items-start gap-2">
                              <div className="min-w-0">
                                <h4 className="text-xs font-semibold text-foreground truncate">{subj.name}</h4>
                                {subj.code && (
                                  <span className="text-[9px] text-muted-foreground font-mono uppercase">
                                    {subj.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-xs font-bold ${statusColor}`}>{subj.attendance_percent}%</span>
                                <span className="block text-[8px] text-muted-foreground font-medium">Req: {subj.min_attendance_percent}%</span>
                              </div>
                            </div>

                            <div className="text-[10px] pt-2 border-t border-border/50 flex items-center justify-between font-medium">
                              <span className="text-muted-foreground">Status:</span>
                              <span className={`font-semibold ${statusColor}`}>
                                {isBelow 
                                  ? `Attend next ${subj.required_to_attend} classes`
                                  : isWarning
                                    ? "Cannot miss any class"
                                    : `Can bunk ${subj.safe_bunks} classes`
                                }
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column (Sidebars & Actions) */}
              <div className="space-y-6">
                
                {/* QUICK ACTIONS */}
                <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-4">
                  <h4 className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quick Actions</h4>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveModal("replace_timetable")}
                      className="w-full flex items-center justify-between text-left text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-3 rounded-lg hover:bg-muted/60 transition-all cursor-pointer"
                    >
                      <span className="flex items-center"><RefreshCw className="h-3.5 w-3.5 mr-2 shrink-0" /> Replace Timetable</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/45" />
                    </button>

                    <button
                      onClick={() => setActiveModal("replace_calendar")}
                      className="w-full flex items-center justify-between text-left text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-3 rounded-lg hover:bg-muted/60 transition-all cursor-pointer"
                    >
                      <span className="flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-2 shrink-0" /> Replace Calendar</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/45" />
                    </button>

                    <button
                      onClick={() => setActiveModal("restart")}
                      className="w-full flex items-center justify-between text-left text-xs font-semibold text-destructive/80 hover:text-destructive py-2 px-3 rounded-lg hover:bg-destructive/5 transition-all cursor-pointer"
                    >
                      <span className="flex items-center"><Trash2 className="h-3.5 w-3.5 mr-2 shrink-0" /> Restart Setup</span>
                      <ChevronRight className="h-3.5 w-3.5 text-destructive/30" />
                    </button>
                  </div>
                </div>

                {/* UPCOMING ASSESSMENTS */}
                <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-4">
                  <h4 className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Upcoming Assessments</h4>
                  
                  {upcomingAssessments.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">No assessments scheduled.</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAssessments.map((a, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground block truncate" title={a.description}>{a.description}</span>
                            <span className="text-[9px] text-muted-foreground mt-0.5 block">{a.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PLANNER SUGGESTIONS */}
                {!isUninitialized && (
                  <div className="border border-border bg-card rounded-xl p-5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] space-y-4">
                    <h4 className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Planner Suggestions</h4>
                    
                    {plannerSuggestions.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground italic">No leave suggestions found.</p>
                    ) : (
                      <div className="space-y-3">
                        {plannerSuggestions.map((s, idx) => (
                          <div key={idx} className="flex flex-col space-y-1 text-xs border-b border-border/40 pb-2.5 last:border-0 last:pb-0">
                            <span className="font-semibold text-foreground truncate">{s.label}</span>
                            <span className="text-[9px] text-muted-foreground">
                              {s.start_date} to {s.end_date} ({s.missed_classes_count} classes)
                            </span>
                            <span className={`text-[9px] font-semibold mt-0.5 inline-block ${s.is_safe ? "text-emerald-600" : "text-destructive"}`}>
                              {s.is_safe ? "✓ Safe Leave" : "⚠️ Drops below requirement"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

              </div>

            </div>

          </div>
        )}

      </main>

      {/* 4. MODALS & POPUPS */}
      {activeModal !== "none" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6">
          <div className="border border-border bg-card rounded-xl max-w-md w-full p-6 shadow-xl space-y-5 animate-scale-in">
            
            {/* Modal Headers */}
            {activeModal === "restart" && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-destructive flex items-center">
                    <Trash2 className="h-4.5 w-4.5 mr-2 shrink-0" /> Restart Semester Setup
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    This action is permanent and will immediately delete all timetable slots, calendar exceptions, generated occurrences, and your marked attendance history.
                  </p>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button onClick={() => setActiveModal("none")} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-all cursor-pointer">Cancel</button>
                  <button onClick={handleRestartSetup} className="rounded-lg bg-destructive text-destructive-foreground px-3.5 py-2 text-xs font-semibold hover:bg-red-700 transition-all cursor-pointer">Delete Everything</button>
                </div>
              </>
            )}

            {activeModal === "replace_timetable" && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center">
                    <RefreshCw className="h-4.5 w-4.5 mr-2 shrink-0 text-primary" /> Replace Timetable
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload an updated timetable PDF or image. Your past marked attendance records will be preserved, while future occurrences will be regenerated.
                  </p>
                </div>

                {!extractedData ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:border-foreground/15 transition-all relative">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
                      <span className="text-[11px] font-semibold text-foreground block">
                        {uploadFile ? uploadFile.name : "Select or drag updated timetable"}
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-1 block">PDF or Image up to 5MB</span>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button onClick={() => { setActiveModal("none"); setUploadFile(null); }} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-all cursor-pointer">Cancel</button>
                      <button 
                        onClick={handleReplaceTimetableUpload}
                        disabled={!uploadFile || extracting}
                        className="rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50 flex items-center"
                      >
                        {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        Extract Slots
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border p-4 bg-muted/40 max-h-52 overflow-y-auto space-y-2">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Extracted Slots Preview</span>
                      {extractedData.timetable_slots.map((slot: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-medium border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-foreground">{slot.subject_name}</span>
                          <span className="text-muted-foreground">{slot.start_time} - {slot.end_time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => setExtractedData(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground">← Back</button>
                      <div className="flex items-center space-x-3">
                        <button onClick={() => { setActiveModal("none"); setUploadFile(null); setExtractedData(null); }} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-all cursor-pointer">Cancel</button>
                        <button 
                          onClick={handleConfirmReplaceTimetable}
                          disabled={savingReplace}
                          className="rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer flex items-center"
                        >
                          {savingReplace ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                          Replace & Save
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {activeModal === "replace_calendar" && (
              <>
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center">
                    <CalendarDays className="h-4.5 w-4.5 mr-2 shrink-0 text-primary" /> Replace Academic Calendar
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Upload an updated academic calendar document. Choose whether to merge new exceptions or completely replace the existing calendar events.
                  </p>
                </div>

                {!extractedData ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3 rounded-lg border border-border/80 p-2 text-center text-xs">
                      <button 
                        onClick={() => setCalendarMergeMode("replace")}
                        className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                          calendarMergeMode === "replace" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        Replace Calendar
                      </button>
                      <button 
                        onClick={() => setCalendarMergeMode("merge")}
                        className={`flex-1 py-1.5 rounded font-semibold transition-all cursor-pointer ${
                          calendarMergeMode === "merge" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/40"
                        }`}
                      >
                        Merge Calendar
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-border/80 rounded-xl p-6 text-center hover:border-foreground/15 transition-all relative">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-6 w-6 text-muted-foreground/60 mx-auto mb-2" />
                      <span className="text-[11px] font-semibold text-foreground block">
                        {uploadFile ? uploadFile.name : "Select or drag calendar file"}
                      </span>
                      <span className="text-[9px] text-muted-foreground mt-1 block">PDF or Image up to 5MB</span>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button onClick={() => { setActiveModal("none"); setUploadFile(null); }} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-all cursor-pointer">Cancel</button>
                      <button 
                        onClick={handleReplaceCalendarUpload}
                        disabled={!uploadFile || extracting}
                        className="rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50 flex items-center"
                      >
                        {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                        Extract Events
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border p-4 bg-muted/40 max-h-52 overflow-y-auto space-y-2">
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider block">Extracted Events Preview ({calendarMergeMode})</span>
                      {extractedData.events.map((ev: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[10px] font-medium border-b border-border/40 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-foreground">{ev.title}</span>
                          <span className="text-muted-foreground">{ev.date}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => setExtractedData(null)} className="text-[10px] font-semibold text-muted-foreground hover:text-foreground">← Back</button>
                      <div className="flex items-center space-x-3">
                        <button onClick={() => { setActiveModal("none"); setUploadFile(null); setExtractedData(null); }} className="rounded-lg border border-border px-3.5 py-2 text-xs font-semibold hover:bg-muted transition-all cursor-pointer">Cancel</button>
                        <button 
                          onClick={handleConfirmReplaceCalendar}
                          disabled={savingReplace}
                          className="rounded-lg bg-primary text-primary-foreground px-3.5 py-2 text-xs font-semibold hover:bg-neutral-800 transition-all cursor-pointer flex items-center"
                        >
                          {savingReplace ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="max-w-5xl mx-auto w-full px-6 border-t border-border/40 py-8 flex justify-between items-center text-[9px] text-muted-foreground tracking-wide font-medium">
        <span>ATTENDWISE</span>
        <span>2026 SEMESTER PLANNER</span>
      </footer>
    </div>
  );
};

export default Dashboard;
