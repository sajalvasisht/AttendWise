import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { attendanceService } from "../services/attendance";
import type { LectureOccurrence, SubjectAttendanceStats } from "../services/attendance";
import type { CalendarEvent } from "../services/calendar";
import { 
  Clock, ChevronLeft, ChevronRight, AlertCircle, Brain, Calendar as CalendarIcon, X, Eye, CalendarDays
} from "lucide-react";
import Navbar from "../components/Navbar";
import { useWorkspace } from "../context/WorkspaceContext";

const DailyTracker: React.FC = () => {
  const navigate = useNavigate();
  const { semester, subjects: subjectStats, calendarEvents: allEvents, isNoSemester, refreshWorkspace, refreshStats } = useWorkspace();
  const mutatingIdsRef = React.useRef<Set<number>>(new Set());

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA")
  );
  
  // States for month navigation and calendar grid
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [monthOccurrences, setMonthOccurrences] = useState<LectureOccurrence[]>([]);
  
  const [occurrences, setOccurrences] = useState<LectureOccurrence[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Side Drawer view state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (isNoSemester) {
      navigate("/setup");
    }
  }, [isNoSemester, navigate]);

  useEffect(() => {
    refreshWorkspace();
  }, []);



  // Load month occurrences (single request per month change)
  useEffect(() => {
    if (!semester) return;
    const fetchMonthData = async () => {
      setLoading(true);
      setError(null);

      const year = currentMonth.getFullYear();
      const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(year, currentMonth.getMonth() + 1, 0).getDate();
      const startStr = `${year}-${month}-01`;
      const endStr = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

      try {
        const monthData = await attendanceService.getByRange(semester.id, startStr, endStr);
        setMonthOccurrences(monthData);
      } catch (err) {
        console.error("Failed to load month range data", err);
        setError("Error fetching attendance data.");
      } finally {
        setLoading(false);
      }
    };
    fetchMonthData();
  }, [semester, currentMonth]);

  // Derive day occurrences from month data (no separate API call)
  useEffect(() => {
    setOccurrences(monthOccurrences.filter(o => o.date === selectedDate));
  }, [monthOccurrences, selectedDate]);

  // Quick navigation for dates (Prev Day / Next Day)
  const adjustDate = (days: number) => {
    const dateObj = new Date(selectedDate + "T00:00:00");
    dateObj.setDate(dateObj.getDate() + days);
    const newDateStr = dateObj.toLocaleDateString("en-CA");
    setSelectedDate(newDateStr);
    setCurrentMonth(new Date(dateObj.getFullYear(), dateObj.getMonth(), 1));
    setIsDrawerOpen(true);
  };

  // Update Status handler — optimistic UI: update immediately, API in background
  const handleStatusChange = async (occurrenceId: number, status: "present" | "absent" | "cancelled" | "unmarked" | "holiday" | "medical_leave" | "other") => {
    if (!semester || mutatingIdsRef.current.has(occurrenceId)) return;
    mutatingIdsRef.current.add(occurrenceId);
    setError(null);

    // Optimistic update: immediately reflect status in both state arrays
    const prevMonth = monthOccurrences;
    const updateOcc = (occ: LectureOccurrence) =>
      occ.id === occurrenceId ? { ...occ, attendance_status: status, is_imported: false } : occ;
    setMonthOccurrences(prev => prev.map(updateOcc));
    setOccurrences(prev => prev.map(updateOcc));

    try {
      const updated = await attendanceService.updateStatus(semester.id, occurrenceId, status);
      // Confirm with server response
      const confirmOcc = (occ: LectureOccurrence) =>
        occ.id === occurrenceId
          ? { ...occ, attendance_status: updated.attendance_status, is_imported: updated.is_imported }
          : occ;
      setMonthOccurrences(prev => prev.map(confirmOcc));
      setOccurrences(prev => prev.map(confirmOcc));

      await refreshStats();
    } catch (err) {
      console.error("Failed to update status", err);
      setError("Failed to update attendance status. Try again.");
      // Revert optimistic update
      setMonthOccurrences(prevMonth);
      setOccurrences(prevMonth.filter(o => o.date === selectedDate));
    } finally {
      mutatingIdsRef.current.delete(occurrenceId);
    }
  };

  const handleDayClick = (dateStr: string) => {
    setSelectedDate(dateStr);
    setIsDrawerOpen(true);
  };

  // Pre-indexed Maps for O(1) lookups in calendar grid (Bug 4 perf fix)
  const monthOccsByDate = useMemo(() => {
    const map = new Map<string, LectureOccurrence[]>();
    for (const occ of monthOccurrences) {
      const arr = map.get(occ.date);
      if (arr) arr.push(occ);
      else map.set(occ.date, [occ]);
    }
    return map;
  }, [monthOccurrences]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent>();
    for (const ev of allEvents) map.set(ev.date, ev);
    return map;
  }, [allEvents]);

  const statsById = useMemo(() => {
    const map = new Map<number, SubjectAttendanceStats>();
    for (const s of subjectStats) map.set(s.subject_id, s);
    return map;
  }, [subjectStats]);

  // Find if selected date matches any exam or holiday
  const dayEvent = eventsByDate.get(selectedDate) || null;
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

  const getImpactPercent = (occ: LectureOccurrence, targetStatus: string) => {
    const stats = statsById.get(occ.subject_id);
    if (!stats) return null;

    const earned = stats.units_earned_per_class || 1;
    const lost = stats.units_lost_per_class || 1;
    
    let presentCount = stats.attended;
    let absentCount = stats.absent;

    if (occ.attendance_status === "present") {
      presentCount = Math.max(0, presentCount - 1);
    } else if (occ.attendance_status === "absent") {
      absentCount = Math.max(0, absentCount - 1);
    }

    if (targetStatus === "present") {
      presentCount += 1;
    } else if (targetStatus === "absent") {
      absentCount += 1;
    }

    const attendedUnits = presentCount * earned;
    const conductedUnits = (presentCount * earned) + (absentCount * lost);

    if (conductedUnits === 0) return 100.0;
    return Math.round((attendedUnits / conductedUnits) * 10000) / 100;
  };

  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    const daysInMonth = lastDayOfMonth.getDate();
    const startOffset = (firstDayOfMonth.getDay() + 6) % 7;
    
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push(null);
    }
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
  const todayStr = new Date().toLocaleDateString("en-CA");

  if (subjectStats.length === 0 && !loading) {
    return (
      <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased flex flex-col font-sans">
        <Navbar />
        <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-14 flex flex-col justify-center items-center">
          <div className="premium-card p-10 text-center space-y-4 max-w-sm mx-auto shadow-sm animate-scale-in">
            <div className="h-10 w-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 mx-auto">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-xs font-bold text-zinc-800">No Timetable Imported</h4>
              <p className="text-[11px] text-zinc-550 leading-relaxed">
                No timetable imported yet. Please configure your weekly class schedule to generate your calendar timeline.
              </p>
            </div>
            <Link
              to="/setup"
              className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-[11.5px] font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Configure Schedule
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-14 space-y-10 relative">
        
        {/* Header */}
        <div className="border-b border-zinc-150/60 pb-5">
          <h1 className="text-2xl font-black tracking-tight text-zinc-900">Daily Tracker & Calendar</h1>
          <p className="text-xs text-zinc-500 font-semibold mt-1">Click any calendar cell to view timing details and log course attendance statuses.</p>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-2xl border border-red-500/15 bg-red-50/50 p-4 text-xs text-red-600 flex items-start space-x-3">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        {/* 1. MONTHLY CALENDAR GRID CARD */}
        <div className="premium-card p-6 space-y-6">
          {/* Calendar Header with Month Navigation */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
            <h2 className="text-sm font-bold text-zinc-800 uppercase tracking-widest flex items-center space-x-2">
              <CalendarIcon className="h-5 w-5 text-zinc-400" />
              <span>
                {currentMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </span>
            </h2>
            <div className="flex items-center space-x-1.5">
              <button
                onClick={() => adjustMonth(-1)}
                className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 cursor-pointer transition-colors shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  const today = new Date();
                  setCurrentMonth(today);
                  setSelectedDate(today.toLocaleDateString("en-CA"));
                }}
                className="text-[10px] font-bold px-3 py-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 transition-colors cursor-pointer shadow-sm uppercase tracking-widest"
              >
                Today
              </button>
              <button
                onClick={() => adjustMonth(1)}
                className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-500 hover:text-zinc-800 cursor-pointer transition-colors shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Week Day Titles */}
          <div className="grid grid-cols-7 gap-2 text-center">
            {dayNames.map((name) => (
              <span key={name} className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest py-1">
                {name}
              </span>
            ))}
          </div>

          {/* Monthly Days Grid */}
          <div className="grid grid-cols-7 gap-2.5">
            {calendarDays.map((day, idx) => {
              if (!day) {
                return <div key={`empty-${idx}`} className="aspect-square bg-transparent" />;
              }

              const formatted = day.toLocaleDateString("en-CA");
              const isSelected = selectedDate === formatted;
              const isToday = todayStr === formatted;
              
              // Filter occurrences for this day
              const dayOccs = monthOccsByDate.get(formatted) || [];
              
              // Find calendar exceptions
              const dayEv = eventsByDate.get(formatted);
              const isHoliday = dayEv && ["holiday", "college_closure", "exam_break"].includes(dayEv.event_type);
              const isExam = dayEv && (dayEv.event_type === "exam_day" || dayEv.event_type === "exam");
              const isLeave = dayEv && dayEv.event_type === "leave";

              // Color-coding class evaluation
              let dayStyles = "border border-zinc-200/80 bg-zinc-50/10 text-zinc-800 hover:bg-zinc-100/40 hover:border-zinc-300";
              
              if (isSelected) {
                dayStyles = "bg-zinc-900 border-zinc-900 text-white shadow-md shadow-zinc-900/10";
              } else if (isHoliday) {
                dayStyles = "bg-emerald-50 border-emerald-100 text-emerald-800 hover:bg-emerald-100/50";
              } else if (isExam) {
                dayStyles = "bg-amber-50 border-amber-100 text-amber-800 hover:bg-amber-100/50";
              } else if (isLeave) {
                dayStyles = "bg-blue-50 border-blue-100 text-blue-800 hover:bg-blue-100/50";
              } else if (dayOccs.length > 0) {
                const hasAbsent = dayOccs.some(occ => occ.attendance_status === "absent");
                const hasPresent = dayOccs.some(occ => occ.attendance_status === "present");
                const allCancelled = dayOccs.every(occ => occ.attendance_status === "cancelled");
                const allUnmarked = dayOccs.every(occ => occ.attendance_status === "unmarked");
                
                if (hasAbsent) {
                  dayStyles = "bg-red-50 border-red-100 text-red-700 hover:bg-red-100/30";
                } else if (hasPresent) {
                  dayStyles = "bg-emerald-50/60 border-emerald-100 text-emerald-700 hover:bg-emerald-50";
                } else if (allCancelled) {
                  dayStyles = "bg-amber-50/60 border-amber-100 text-amber-700 hover:bg-amber-50";
                } else if (formatted < todayStr && allUnmarked) {
                  dayStyles = "bg-zinc-50/80 border-zinc-200/60 text-zinc-500 hover:bg-zinc-100 hover:border-zinc-300";
                } else if (formatted > todayStr) {
                  dayStyles = "border-dashed border-zinc-200/80 bg-zinc-50/30 text-zinc-400 hover:bg-zinc-50";
                }
              } else if (formatted > todayStr) {
                dayStyles = "opacity-60 border border-zinc-100 bg-transparent text-zinc-400";
              }

              if (isToday && !isSelected) {
                dayStyles += " ring-2 ring-emerald-500/40 border-emerald-400";
              }

              return (
                <button
                  key={formatted}
                  onClick={() => handleDayClick(formatted)}
                  className={`aspect-square rounded-2xl flex flex-col justify-between p-3.5 text-left relative transition-all cursor-pointer ${dayStyles}`}
                >
                  <span className="text-xs font-bold leading-none">{day.getDate()}</span>

                  {/* Indicators / Badges */}
                  <div className="flex flex-wrap gap-1 justify-end w-full">
                    {isHoliday ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-emerald-500"}`} title="Holiday" />
                    ) : isExam ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-amber-500"}`} title="Exam" />
                    ) : isLeave ? (
                      <span className={`h-1.5 w-1.5 rounded-full ${isSelected ? "bg-white" : "bg-blue-500"}`} title="Leave" />
                    ) : dayOccs.length > 0 ? (
                      dayOccs.map(occ => {
                        let dotBg = "bg-zinc-300";
                        if (occ.attendance_status === "present") dotBg = isSelected ? "bg-white" : "bg-emerald-500";
                        else if (occ.attendance_status === "absent") dotBg = isSelected ? "bg-white" : "bg-red-500";
                        else if (occ.attendance_status === "cancelled") dotBg = isSelected ? "bg-white" : "bg-amber-450";
                        return (
                          <span
                            key={occ.id}
                            className={`h-1.5 w-1.5 rounded-full ${dotBg}`}
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

        {/* Informative helper banner */}
        <div className="premium-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-3 text-xs">
            <Eye className="h-4.5 w-4.5 text-zinc-400 shrink-0" />
            <span className="text-zinc-500 font-semibold">Click any calendar date to display and log status changes in a clean overlay drawer.</span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(true)}
            className="text-[10px] font-bold text-zinc-700 hover:text-zinc-900 border border-zinc-200 bg-white px-3.5 py-2 rounded-xl hover:bg-zinc-50 transition-colors cursor-pointer shadow-sm uppercase tracking-widest"
          >
            Open Selected Date
          </button>
        </div>

        {/* 2. SIDE DRAWER */}
        {isDrawerOpen && (
          <>
            {/* Backdrop */}
            <div 
              className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[3px] transition-opacity" 
              onClick={() => setIsDrawerOpen(false)}
            />

            {/* Drawer */}
            <div className="fixed top-0 right-0 z-50 h-full w-full sm:max-w-md border-l border-zinc-100 bg-white shadow-[0_0_50px_rgba(15,23,42,0.12)] flex flex-col justify-between animate-scale-in text-[#0f172a]">
              
              {/* Drawer Header */}
              <div className="p-6 border-b border-zinc-100 flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[9px] text-zinc-400 font-bold uppercase tracking-widest block">Selected Date</span>
                  <h3 className="text-base font-black text-zinc-800">
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                </div>
                <button 
                  onClick={() => setIsDrawerOpen(false)}
                  className="h-9 w-9 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-55 flex items-center justify-center text-zinc-400 hover:text-zinc-700 cursor-pointer transition-colors shadow-sm"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Drawer Body (Content) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Date Navigator */}
                <div className="flex gap-3">
                  <button
                    onClick={() => adjustDate(-1)}
                    className="flex-1 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 py-2.5 text-xs font-bold text-zinc-600 hover:text-zinc-800 cursor-pointer flex justify-center items-center space-x-1 shadow-sm"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span>Prev Day</span>
                  </button>
                  <button
                    onClick={() => adjustDate(1)}
                    className="flex-1 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 py-2.5 text-xs font-bold text-zinc-600 hover:text-zinc-800 cursor-pointer flex justify-center items-center space-x-1 shadow-sm"
                  >
                    <span>Next Day</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>

                {/* Exception Banners */}
                {dayExam && (
                  <div className="premium-card p-5 text-center space-y-3 shadow-[0_8px_20px_rgba(0,0,0,0.02)] border-amber-100 bg-amber-50/20">
                    <div className="mx-auto h-10 w-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500">
                      <Brain className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-zinc-800">{dayExam.description || "Examination Session"}</h4>
                      <p className="text-[10px] text-zinc-400 font-bold font-mono">
                        {dayExam.start_time ? `${dayExam.start_time.slice(0, 5)} - ${dayExam.end_time?.slice(0, 5)}` : "All Day"}
                      </p>
                    </div>
                    <div className="text-[9px] text-amber-600 font-extrabold uppercase tracking-widest bg-amber-50 px-3 py-1 rounded-full inline-block border border-amber-100">
                      Good luck for your exam
                    </div>
                  </div>
                )}

                {dayHoliday && (
                  <div className="premium-card p-5 text-center space-y-3 shadow-[0_8px_20px_rgba(0,0,0,0.02)] border-emerald-100 bg-emerald-50/20">
                    <div className="mx-auto h-10 w-10 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600">
                      <CalendarIcon className="h-5 w-5" />
                    </div>
                    <h4 className="text-xs font-black text-zinc-800">{dayHoliday.description || "Holiday Exception"}</h4>
                    <div className="text-[9px] text-emerald-650 font-extrabold uppercase tracking-widest bg-emerald-50 px-3 py-1 rounded-full inline-block border border-emerald-100">
                      Enjoy your day off
                    </div>
                  </div>
                )}

                {/* Timetable Slots */}
                <div className="space-y-4">
                  <span className="text-[9.5px] text-zinc-400 font-bold uppercase tracking-widest block">Lectures ({occurrences.length})</span>
                  
                  {loading ? (
                    <div className="space-y-4 animate-pulse">
                      {[1, 2].map((i) => (
                        <div key={i} className="premium-card p-5 h-20 bg-zinc-50/50 flex items-center justify-between border-dashed">
                          <div className="space-y-2 flex-grow">
                            <div className="h-4 w-1/3 bg-zinc-200 rounded" />
                            <div className="h-3 w-1/4 bg-zinc-150 rounded" />
                          </div>
                          <div className="h-8 w-24 bg-zinc-200 rounded-xl" />
                        </div>
                      ))}
                    </div>
                  ) : isWeekend() && occurrences.length === 0 ? (
                    <div className="premium-card p-6 text-center space-y-1.5 text-zinc-400">
                      <h4 className="text-xs font-bold text-zinc-700">Weekend Exception</h4>
                      <p className="text-[10px]">No weekly lectures scheduled on weekends.</p>
                    </div>
                  ) : occurrences.length === 0 ? (
                    <div className="premium-card p-8 text-center text-xs text-zinc-400 italic">
                      No classes scheduled for this date.
                    </div>
                  ) : (
                    <div className="space-y-4 animate-scale-in">
                      {occurrences.map((occ) => {
                        return (
                          <div 
                            key={occ.id} 
                            className="premium-card p-5 flex flex-col justify-between gap-4"
                          >
                            {/* Lecture metadata */}
                            <div className="space-y-1">
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-bold text-zinc-850">{occ.subject.name}</h4>
                                {occ.subject.code && (
                                  <span className="text-[9px] bg-zinc-100 border border-zinc-200/60 text-zinc-500 px-1.5 py-0.2 rounded font-mono uppercase tracking-wide">
                                    {occ.subject.code}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center text-[10px] text-zinc-400 space-x-1.5 font-semibold">
                                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                                <span>{occ.start_time.slice(0, 5)} - {occ.end_time.slice(0, 5)}</span>
                              </div>
                              {/* Imported History badge — shown only for records generated by the
                                  historical import engine. Disappears automatically when the student
                                  manually changes the status (backend clears is_imported=false). */}
                              {occ.is_imported && occ.attendance_status !== "unmarked" && (
                                <div className="pt-1">
                                  <span className="inline-flex items-center gap-1 text-[8px] font-bold text-amber-700 bg-amber-50 border border-amber-200/70 px-2 py-0.5 rounded-full uppercase tracking-wide">
                                    <svg className="h-2.5 w-2.5" viewBox="0 0 16 16" fill="currentColor">
                                      <path d="M8 1a.75.75 0 0 1 .75.75v6.19l1.97-1.97a.75.75 0 1 1 1.06 1.06L8.53 10.28a.75.75 0 0 1-1.06 0L4.22 7.03a.75.75 0 0 1 1.06-1.06L7.25 7.94V1.75A.75.75 0 0 1 8 1zM2.5 13.25a.75.75 0 0 1 .75-.75h9.5a.75.75 0 0 1 0 1.5h-9.5a.75.75 0 0 1-.75-.75z"/>
                                    </svg>
                                    Imported History
                                  </span>
                                </div>
                              )}
                            </div>


                            {/* Status controls */}
                            <div className="space-y-3 pt-3 border-t border-zinc-100">
                              <div className="flex justify-between items-center text-[8.5px] font-bold">
                                <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  Value: +{occ.subject.units_earned_per_class || 1} (Present)
                                </span>
                                <span className="text-red-650 bg-red-50 px-2 py-0.5 rounded border border-red-100">
                                  Value: -{occ.subject.units_lost_per_class || 1} (Absent)
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-1.5">
                                {["present", "absent", "cancelled", "holiday", "medical_leave", "other"].map((status) => {
                                  const projPercent = getImpactPercent(occ, status);
                                  const isCurrent = occ.attendance_status === status;
                                  let actClass = "";
                                  if (isCurrent) {
                                    if (status === "present") actClass = "bg-emerald-500 border-emerald-500 text-white shadow-sm";
                                    else if (status === "absent") actClass = "bg-red-500 border-red-500 text-white shadow-sm";
                                    else if (status === "cancelled") actClass = "bg-amber-500 border-amber-500 text-white shadow-sm";
                                    else if (status === "holiday") actClass = "bg-blue-500 border-blue-500 text-white shadow-sm";
                                    else if (status === "medical_leave") actClass = "bg-purple-500 border-purple-500 text-white shadow-sm";
                                    else actClass = "bg-zinc-500 border-zinc-500 text-white shadow-sm";
                                  } else {
                                    actClass = "bg-white border-zinc-200 text-zinc-400 hover:bg-zinc-50 hover:text-zinc-700";
                                  }

                                  const displayLabel = status.replace("_", " ");

                                  return (
                                    <button
                                      key={status}
                                      onClick={() => handleStatusChange(occ.id, isCurrent ? "unmarked" : (status as any))}
                                      className={`text-[9px] font-bold py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer uppercase tracking-widest ${actClass}`}
                                    >
                                      {displayLabel} {projPercent !== null ? `(→ ${projPercent}%)` : ""}
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

              </div>

              {/* Drawer Footer */}
              <div className="p-6 border-t border-zinc-100 bg-zinc-50/20 flex justify-end">
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="rounded-xl bg-zinc-900 py-2.5 px-5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer shadow-sm"
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
