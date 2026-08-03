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

  const handleStatusChange = async (occurrenceId: number, status: "present" | "absent" | "cancelled" | "unmarked" | "holiday" | "medical_leave" | "other") => {
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
          subject_id: matched ? matched.subject_id : null
        };
      });

      await calendarService.save(semester.id, parsedEvents, calendarMergeMode);
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
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-6xl mx-auto w-full px-6 py-14 space-y-12">
        
        {/* Global Error */}
        {error && (
          <div className="rounded-2xl border border-red-500/15 bg-red-50/50 p-4.5 text-xs text-red-600 flex items-start space-x-3 animate-fade-in shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
            <p className="text-xs text-zinc-400 font-semibold">Loading workspace details...</p>
          </div>
        ) : !semester ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4 animate-scale-in">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
            <p className="text-xs text-zinc-400 font-semibold">Redirecting to onboarding guide...</p>
          </div>
        ) : (
          /* Active State */
          <div className="space-y-12">
            
            {/* Personalized Header Overview */}
            <div className="pt-2 pb-2 space-y-1.5">
              <h1 className="text-3xl font-black tracking-tight text-zinc-900 flex items-center gap-2">
                <span>{getGreeting()}, {user?.full_name?.split(" ")[0] || "Student"}</span>
                <span className="text-2xl animate-wave">👋</span>
              </h1>
              <p className="text-sm text-zinc-500 font-medium leading-relaxed max-w-xl">
                Here is your AttendWise status overview. Keep your planning on track!
              </p>
            </div>

            {/* 1. HERO BANNER ROW */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              
              {/* Term Statistics Card */}
              <div className="premium-card p-6 flex flex-col justify-between min-h-36">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">Semester Profile</span>
                <div className="mt-3">
                  <h2 className="text-base font-bold tracking-tight text-zinc-800 truncate">{semester.name}</h2>
                  <div className="flex items-center text-[11px] text-zinc-400 mt-1.5 space-x-2 font-medium">
                    <span>{semester.start_date}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-zinc-300" />
                    <span>{semester.end_date}</span>
                  </div>
                </div>
                <div className="text-[11px] text-zinc-400 font-bold border-t border-zinc-100 pt-3 flex items-center justify-between mt-4">
                  <span>Days remaining:</span>
                  <span className="font-extrabold text-zinc-850">{getDaysRemaining()} days</span>
                </div>
              </div>

              {/* Next Holiday Card */}
              <div className="premium-card p-6 flex flex-col justify-between min-h-36">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">Calendar Watch</span>
                <div className="mt-3">
                  <h2 className="text-xs font-bold tracking-tight text-zinc-400 uppercase">Next Break</h2>
                  <p className="text-sm font-extrabold text-zinc-800 mt-1 truncate">
                    {nextHoliday ? nextHoliday.description || "Holiday" : "None scheduled"}
                  </p>
                </div>
                <div className="text-[11px] text-zinc-400 font-bold border-t border-zinc-100 pt-3 flex items-center justify-between mt-4">
                  <span>Date:</span>
                  <span className="font-extrabold text-zinc-850">{nextHoliday ? nextHoliday.date : "N/A"}</span>
                </div>
              </div>

              {/* Attendance Status Card */}
              <div className="premium-card p-6 flex flex-col justify-between min-h-36">
                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block">Attendance Summary</span>
                {isUninitialized ? (
                  <div className="mt-3">
                    <h2 className="text-xs font-extrabold text-red-500 uppercase">Not Initialized</h2>
                    <p className="text-[10px] text-zinc-450 leading-normal mt-1">
                      Calculations are disabled until baseline values are entered.
                    </p>
                  </div>
                ) : (
                  <div className="mt-3 flex items-baseline justify-between">
                    <div>
                      <h2 className="text-[26px] font-black text-zinc-900 leading-none">
                        {subjects.length > 0 ? (subjects.reduce((sum, s) => sum + s.attendance_percent, 0) / subjects.length).toFixed(1) : "0.0"}%
                      </h2>
                      <p className="text-[10px] text-zinc-400 font-semibold mt-1">
                        Attendance Margin: {subjects.reduce((sum, s) => sum + Math.floor(s.safe_bunks / (s.units_per_class || 1)), 0)} classes
                      </p>
                    </div>
                  </div>
                )}
                <div className="border-t border-zinc-100 pt-3 flex items-center justify-between mt-4">
                  {isUninitialized ? (
                    <Link to="/initialize-attendance" className="text-[11px] font-bold text-zinc-700 hover:text-zinc-900 flex items-center gap-0.5">
                      Initialize Now <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    <Link to="/summary" className="text-[11px] font-bold text-zinc-700 hover:text-zinc-900 flex items-center gap-0.5">
                      View Detailed Metrics <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  )}
                </div>
              </div>

            </div>

            {/* 2. ATTENDANCE INITIALIZATION CALLOUT */}
            {isUninitialized && (
              <div className="rounded-2xl border border-red-500/10 bg-red-50/20 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-[0_1px_3px_rgba(15,23,42,0.01)] animate-fade-in">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-red-600">Setup Complete: Attendance Not Initialized</h4>
                  <p className="text-[12px] text-zinc-500 font-medium max-w-xl">
                    Enter the number of classes conducted and attended so far to activate tracking analytics.
                  </p>
                </div>
                <Link 
                  to="/initialize-attendance"
                  className="rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm transition-all shrink-0 text-center cursor-pointer"
                >
                  Initialize Attendance
                </Link>
              </div>
            )}

            {/* 3. WORKING WORKSPACE GRID */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
              
              {/* Left & Middle Column (Main Content) */}
              <div className="lg:col-span-2 space-y-10">
                
                {/* TODAY'S SCHEDULE CHECKLIST (Timeline Mode) */}
                <div className="space-y-6">
                  <div className="border-b border-zinc-100 pb-3.5 flex items-center justify-between">
                    <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                      Today's Timeline
                    </h3>
                    <span className="text-[11px] text-zinc-400 font-bold uppercase tracking-wider">
                      {new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                    </span>
                  </div>

                  {isUninitialized ? (
                    <div className="rounded-2xl border border-zinc-200/60 bg-white p-8 text-center text-xs text-zinc-400 italic">
                      Initialize attendance first to access today's checklist.
                    </div>
                  ) : todayExam ? (
                    <div className="premium-card p-6 text-center space-y-3">
                      <div className="mx-auto h-10 w-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-500">
                        <Brain className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-zinc-800">{todayExam.description || "Examination"}</h4>
                        <p className="text-[11px] text-zinc-400 font-medium">
                          {todayExam.start_time ? `${todayExam.start_time.slice(0, 5)} - ${todayExam.end_time?.slice(0, 5)}` : "All Day"}
                        </p>
                      </div>
                      <p className="text-xs text-amber-600 font-semibold">Good luck on your exam!</p>
                    </div>
                  ) : todayHoliday ? (
                    <div className="premium-card p-6 text-center space-y-2.5">
                      <div className="mx-auto h-10 w-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <h4 className="text-sm font-bold text-zinc-800">{todayHoliday.description || "Holiday"}</h4>
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block font-extrabold border border-emerald-100">
                        Enjoy your break!
                      </span>
                    </div>
                  ) : todayLectures.length === 0 ? (
                    <div className="premium-card p-8 text-center text-xs text-zinc-400 italic">
                      No classes scheduled today.
                    </div>
                  ) : (
                    /* Timeline display checklist nodes */
                    <div className="relative pl-6 space-y-6">
                      <div className="absolute left-[9px] top-2.5 bottom-2.5 w-px bg-zinc-200/80" />

                      {todayLectures.map((occ) => {
                        const isUpdating = updatingId === occ.id;
                        const status = occ.attendance_status;

                        let nodeColor = "bg-white border-zinc-200";
                        if (status === "present") nodeColor = "bg-emerald-500 border-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.3)]";
                        else if (status === "absent") nodeColor = "bg-red-500 border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.3)]";
                        else if (status === "cancelled") nodeColor = "bg-amber-500 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.3)]";

                        return (
                          <div key={occ.id} className="relative flex items-start gap-4">
                            {/* Line node dot */}
                            <div className={`absolute -left-[21px] top-1.5 h-4 w-4 rounded-full border-2 ${nodeColor} transition-all duration-200 z-10`} />

                            <div 
                              className={`flex-1 premium-card p-5 flex items-center justify-between gap-6 ${
                                isUpdating ? "opacity-60 pointer-events-none" : ""
                              }`}
                            >
                              <div className="min-w-0">
                                <div className="flex items-center space-x-2">
                                  <span className="text-sm font-bold text-zinc-800 truncate">{occ.subject.name}</span>
                                  {occ.subject.code && (
                                    <span className="text-[9px] bg-zinc-100 border border-zinc-200/60 text-zinc-555 px-1.5 py-0.2 rounded font-mono uppercase tracking-wide shrink-0">
                                      {occ.subject.code}
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center text-[11px] text-zinc-450 mt-1.5 space-x-1.5 font-semibold">
                                  <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                  <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                {["present", "absent", "cancelled"].map((statusOption) => {
                                  const isSelected = status === statusOption;
                                  let btnClass = "";
                                  if (isSelected) {
                                    if (statusOption === "present") btnClass = "bg-emerald-500 border-emerald-500 text-white shadow-sm";
                                    else if (statusOption === "absent") btnClass = "bg-red-500 border-red-500 text-white shadow-sm";
                                    else btnClass = "bg-amber-500 border-amber-500 text-white shadow-sm";
                                  } else {
                                    btnClass = "bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700";
                                  }

                                  return (
                                    <button
                                      key={statusOption}
                                      onClick={() => handleStatusChange(occ.id, status === statusOption ? "unmarked" : (statusOption as any))}
                                      className={`text-[9px] font-bold py-1.5 px-3 rounded-lg border transition-all cursor-pointer uppercase tracking-widest ${btnClass}`}
                                    >
                                      {statusOption}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* COURSE STANDINGS GRID */}
                <div className="space-y-6">
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-3.5">
                    Course Standings
                  </h3>

                  {isUninitialized ? (
                    <div className="rounded-2xl border border-zinc-200/60 bg-white p-8 text-center text-xs text-zinc-400 italic">
                      Initialize attendance to display standings.
                    </div>
                  ) : subjects.length === 0 ? (
                    <div className="rounded-2xl border border-zinc-200/60 bg-white p-8 text-center text-xs text-zinc-400 italic">
                      No subjects configured.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {subjects.map((subj) => {
                        const isBelow = subj.attendance_percent < subj.min_attendance_percent;
                        const isWarning = !isBelow && subj.safe_bunks === 0;
                        
                        let textClass = "text-emerald-600";
                        let barClass = "bg-emerald-500";
                        let badgeClass = "bg-emerald-50 border-emerald-100 text-emerald-700";
                        if (isBelow) {
                          textClass = "text-red-650";
                          barClass = "bg-red-500";
                          badgeClass = "bg-red-50 border-red-100 text-red-700";
                        } else if (isWarning) {
                          textClass = "text-amber-600";
                          barClass = "bg-amber-500";
                          badgeClass = "bg-amber-50 border-amber-100 text-amber-700";
                        }

                        const insight = isBelow 
                          ? `Attend next ${Math.ceil(subj.required_to_attend / (subj.units_per_class || 1))} classes`
                          : isWarning
                            ? "Cannot miss any class"
                            : `Can safely miss ${Math.floor(subj.safe_bunks / (subj.units_per_class || 1))} ${Math.floor(subj.safe_bunks / (subj.units_per_class || 1)) === 1 ? "class" : "classes"}`;

                        return (
                          <div 
                            key={subj.subject_id} 
                            className="premium-card p-5 flex flex-col justify-between gap-4"
                          >
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <h4 className="text-sm font-bold text-zinc-800 truncate">{subj.name}</h4>
                                {subj.code && (
                                  <span className="text-[9px] text-zinc-400 font-mono uppercase tracking-wide mt-0.5 block">
                                    {subj.code}
                                  </span>
                                )}
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-[20px] font-black leading-none block ${textClass}`}>
                                  {subj.attendance_percent.toFixed(1)}%
                                </span>
                                <span className="text-[9px] text-zinc-400 font-semibold mt-0.5 block">
                                  Target: {subj.min_attendance_percent}%
                                </span>
                              </div>
                            </div>

                            {/* 12px Progress bar visualization */}
                            <div className="space-y-1 pt-1">
                              <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full ${barClass} rounded-full transition-all duration-500`} 
                                  style={{ width: `${Math.min(100, subj.attendance_percent)}%` }} 
                                />
                              </div>
                              <div className="flex justify-between text-[8px] text-zinc-450 font-bold font-mono">
                                <span>0%</span>
                                <span>100%</span>
                              </div>
                            </div>

                            <div className="pt-3 border-t border-zinc-100 flex items-center justify-between text-[11px] font-semibold">
                              <span className="text-zinc-450 font-bold">Standing Status:</span>
                              <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${badgeClass}`}>
                                {insight}
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
              <div className="space-y-8">
                
                {/* QUICK ACTIONS */}
                <div className="premium-card p-6 space-y-4">
                  <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Quick Actions</h4>
                  
                  <div className="space-y-2">
                    <button
                      onClick={() => setActiveModal("replace_timetable")}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-500 hover:text-zinc-800 py-2.5 px-3 rounded-xl hover:bg-zinc-100/60 transition-all cursor-pointer border border-transparent"
                    >
                      <span className="flex items-center"><RefreshCw className="h-4 w-4 mr-2.5 text-zinc-400" /> Replace Timetable</span>
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    </button>

                    <button
                      onClick={() => setActiveModal("replace_calendar")}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-zinc-500 hover:text-zinc-800 py-2.5 px-3 rounded-xl hover:bg-zinc-100/60 transition-all cursor-pointer border border-transparent"
                    >
                      <span className="flex items-center"><CalendarDays className="h-4 w-4 mr-2.5 text-zinc-400" /> Replace Calendar</span>
                      <ChevronRight className="h-4 w-4 text-zinc-300" />
                    </button>

                    <button
                      onClick={() => setActiveModal("restart")}
                      className="w-full flex items-center justify-between text-left text-xs font-bold text-red-500/80 hover:text-red-600 py-2.5 px-3 rounded-xl hover:bg-red-50/40 transition-all cursor-pointer border border-transparent"
                    >
                      <span className="flex items-center"><Trash2 className="h-4 w-4 mr-2.5 text-red-400" /> Restart Setup</span>
                      <ChevronRight className="h-4 w-4 text-red-300" />
                    </button>
                  </div>
                </div>

                {/* UPCOMING ASSESSMENTS */}
                <div className="premium-card p-6 space-y-4">
                  <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Upcoming Assessments</h4>
                  
                  {upcomingAssessments.length === 0 ? (
                    <p className="text-[11px] text-zinc-400 italic">No assessments scheduled.</p>
                  ) : (
                    <div className="space-y-3">
                      {upcomingAssessments.map((a, idx) => (
                        <div key={idx} className="flex justify-between items-start text-xs border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                          <div className="min-w-0">
                            <span className="font-bold text-zinc-800 block truncate" title={a.description}>{a.description}</span>
                            <span className="text-[9px] text-zinc-400 mt-0.5 block font-bold font-mono">{a.date}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PLANNER SUGGESTIONS */}
                {!isUninitialized && (
                  <div className="premium-card p-6 space-y-4">
                    <h4 className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest">Leave Suggestions</h4>
                    
                    {plannerSuggestions.length === 0 ? (
                      <p className="text-[11px] text-zinc-400 italic">No leave suggestions found.</p>
                    ) : (
                      <div className="space-y-3">
                        {plannerSuggestions.map((s, idx) => (
                          <div key={idx} className="flex flex-col space-y-1.5 text-xs border-b border-zinc-100 pb-3 last:border-0 last:pb-0">
                            <span className="font-bold text-zinc-800 truncate">{s.label}</span>
                            <span className="text-[10px] text-zinc-450 font-semibold font-mono">
                              {s.start_date} to {s.end_date} ({s.missed_classes_count} classes)
                            </span>
                            <div>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                s.is_safe 
                                  ? "bg-emerald-50 border-emerald-100 text-emerald-700" 
                                  : "bg-red-50 border-red-100 text-red-700"
                              }`}>
                                {s.is_safe ? "✓ Safe Leave" : "⚠️ Drops below req"}
                              </span>
                            </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[3px] p-6">
          <div className="bg-white rounded-[28px] border border-zinc-200/50 max-w-md w-full p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-6 animate-scale-in">
            
            {/* Modal Headers */}
            {activeModal === "restart" && (
              <>
                <div className="space-y-2">
                  <h3 className="text-base font-black text-red-650 flex items-center">
                    <Trash2 className="h-5 w-5 mr-2 shrink-0" /> Restart Semester Setup
                  </h3>
                  <p className="text-[12px] text-zinc-500 leading-relaxed">
                    This action is permanent and will immediately delete all timetable slots, calendar exceptions, generated occurrences, and your marked attendance history.
                  </p>
                </div>
                <div className="flex items-center justify-end space-x-3 pt-2">
                  <button 
                    onClick={() => setActiveModal("none")} 
                    className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleRestartSetup} 
                    className="rounded-xl bg-red-600 text-white px-4 py-2.5 text-xs font-bold hover:bg-red-755 transition-all cursor-pointer shadow-sm"
                  >
                    Delete Everything
                  </button>
                </div>
              </>
            )}

            {activeModal === "replace_timetable" && (
              <>
                <div className="space-y-2">
                  <h3 className="text-base font-black text-zinc-800 flex items-center">
                    <RefreshCw className="h-5 w-5 mr-2 shrink-0 text-zinc-550" /> Replace Timetable
                  </h3>
                  <p className="text-[12px] text-zinc-550 leading-relaxed">
                    Upload an updated timetable PDF or image. Your past marked attendance records will be preserved, while future occurrences will be regenerated.
                  </p>
                </div>

                {!extractedData ? (
                  <div className="space-y-4">
                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center hover:border-zinc-400 transition-all relative bg-zinc-50/50">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-7 w-7 text-zinc-400 mx-auto mb-2" />
                      <span className="text-[12px] font-bold text-zinc-700 block">
                        {uploadFile ? uploadFile.name : "Select or drag updated timetable"}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1 block">PDF or Image up to 5MB</span>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button 
                        onClick={() => { setActiveModal("none"); setUploadFile(null); }} 
                        className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleReplaceTimetableUpload}
                        disabled={!uploadFile || extracting}
                        className="rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50 flex items-center shadow-sm"
                      >
                        {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-white/60" /> : null}
                        Extract Slots
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/50 max-h-52 overflow-y-auto space-y-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Extracted Slots Preview</span>
                      {extractedData.timetable_slots.map((slot: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] font-semibold border-b border-zinc-100 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-zinc-700">{slot.subject_name}</span>
                          <span className="text-zinc-500">{slot.start_time} - {slot.end_time}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => setExtractedData(null)} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-700">← Back</button>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => { setActiveModal("none"); setUploadFile(null); setExtractedData(null); }} 
                          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleConfirmReplaceTimetable}
                          disabled={savingReplace}
                          className="rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer flex items-center shadow-sm"
                        >
                          {savingReplace ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-white/60" /> : null}
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
                  <h3 className="text-base font-black text-zinc-850 flex items-center">
                    <CalendarDays className="h-5 w-5 mr-2 shrink-0 text-zinc-550" /> Replace Academic Calendar
                  </h3>
                  <p className="text-[12px] text-zinc-550 leading-relaxed">
                    Upload an updated academic calendar document. Choose whether to merge new exceptions or completely replace the existing calendar events.
                  </p>
                </div>

                {!extractedData ? (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2 rounded-xl border border-zinc-200 p-1 text-center text-[11px] bg-zinc-50/50">
                      <button 
                        onClick={() => setCalendarMergeMode("replace")}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          calendarMergeMode === "replace" ? "bg-white text-zinc-800 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:bg-zinc-100/50"
                        }`}
                      >
                        Replace Calendar
                      </button>
                      <button 
                        onClick={() => setCalendarMergeMode("merge")}
                        className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                          calendarMergeMode === "merge" ? "bg-white text-zinc-800 shadow-sm border border-zinc-200/50" : "text-zinc-500 hover:bg-zinc-100/50"
                        }`}
                      >
                        Merge Calendar
                      </button>
                    </div>

                    <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-8 text-center hover:border-zinc-400 transition-all relative bg-zinc-50/50">
                      <input 
                        type="file" 
                        accept="image/*,application/pdf"
                        onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <Upload className="h-7 w-7 text-zinc-400 mx-auto mb-2" />
                      <span className="text-[12px] font-bold text-zinc-700 block">
                        {uploadFile ? uploadFile.name : "Select or drag calendar file"}
                      </span>
                      <span className="text-[10px] text-zinc-400 mt-1 block">PDF or Image up to 5MB</span>
                    </div>

                    <div className="flex items-center justify-end space-x-3">
                      <button 
                        onClick={() => { setActiveModal("none"); setUploadFile(null); }} 
                        className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleReplaceCalendarUpload}
                        disabled={!uploadFile || extracting}
                        className="rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50 flex items-center shadow-sm"
                      >
                        {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-white/60" /> : null}
                        Extract Events
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/50 max-h-52 overflow-y-auto space-y-2">
                      <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-widest block mb-1">Extracted Events Preview ({calendarMergeMode})</span>
                      {extractedData.events.map((ev: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-center text-[11px] font-semibold border-b border-zinc-100 pb-1.5 last:border-0 last:pb-0">
                          <span className="text-zinc-700">{ev.title}</span>
                          <span className="text-zinc-500">{ev.date}</span>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <button onClick={() => setExtractedData(null)} className="text-[11px] font-bold text-zinc-400 hover:text-zinc-700">← Back</button>
                      <div className="flex items-center space-x-3">
                        <button 
                          onClick={() => { setActiveModal("none"); setUploadFile(null); setExtractedData(null); }} 
                          className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 transition-all cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button 
                          onClick={handleConfirmReplaceCalendar}
                          disabled={savingReplace}
                          className="rounded-xl bg-zinc-900 text-white px-4 py-2.5 text-xs font-bold hover:bg-zinc-800 transition-all cursor-pointer flex items-center shadow-sm"
                        >
                          {savingReplace ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-white/60" /> : null}
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
      <footer className="max-w-6xl mx-auto w-full px-6 border-t border-zinc-100 py-10 flex justify-between items-center text-[9px] text-zinc-400 tracking-widest font-bold">
        <span>ATTENDWISE</span>
        <span>2026 SEMESTER PLANNER</span>
      </footer>
    </div>
  );
};

export default Dashboard;
