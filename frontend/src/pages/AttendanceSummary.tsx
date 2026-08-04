import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { semesterService } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { OverallAttendanceStats, SubjectAttendanceStats } from "../services/attendance";
import { AlertCircle, BookOpen, Calculator } from "lucide-react";
import Navbar from "../components/Navbar";

const AttendanceSummary: React.FC = () => {
  const navigate = useNavigate();

  const [overall, setOverall] = useState<OverallAttendanceStats | null>(null);
  const [subjects, setSubjects] = useState<SubjectAttendanceStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummaryData = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          navigate("/setup");
          return;
        }
        
        const activeSem = sems[0];
        
        // Fetch stats parallelly
        const [overallData, subjectsData] = await Promise.all([
          attendanceService.getSummary(activeSem.id),
          attendanceService.getSubjectsAttendance(activeSem.id)
        ]);
        
        setOverall(overallData);
        setSubjects(subjectsData);
      } catch (err) {
        console.error("Failed to load attendance summary details:", err);
        setError("Error compiling attendance calculations.");
      } finally {
        setLoading(false);
      }
    };
    fetchSummaryData();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-5xl mx-auto w-full px-6 py-14 space-y-12">
        
        {/* Error State Banner */}
        {error && (
          <div className="rounded-2xl border border-red-500/15 bg-red-50/50 p-4 text-xs text-red-650 flex items-start space-x-3">
            <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span className="leading-relaxed font-semibold">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="space-y-12 animate-pulse">
            {/* Header Skeleton */}
            <div className="premium-card p-8 bg-zinc-50/50 space-y-6 border-dashed">
              <div className="space-y-2">
                <div className="h-3.5 w-24 bg-zinc-200 rounded" />
                <div className="h-8 w-56 bg-zinc-250 rounded-xl" />
              </div>
              <div className="grid grid-cols-3 gap-6 pt-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-3 w-16 bg-zinc-200 rounded" />
                    <div className="h-6 w-12 bg-zinc-250 rounded-lg" />
                  </div>
                ))}
              </div>
              <div className="h-10 w-full bg-zinc-200/50 rounded-xl" />
            </div>

            {/* Grid list Skeleton */}
            <div className="space-y-6">
              <div className="h-4 w-32 bg-zinc-200 rounded" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="premium-card p-6 h-56 bg-zinc-50/50 border-dashed" />
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* OVERALL SUMMARY CARD */}
            {overall && (
              <div className="premium-card p-8 space-y-8">
                <div className="flex items-center justify-between border-b border-zinc-100 pb-5">
                  <div className="space-y-1.5">
                    <h2 className="text-xl font-black text-zinc-900 tracking-tight">Semester Summary</h2>
                    <p className="text-xs text-zinc-500 font-medium leading-relaxed max-w-md">Overall attendance calculated from all recorded classes across your enrolled subjects.</p>
                  </div>
                  
                  {/* Huge Percentage indicator */}
                  <div className="text-right">
                    <span className="text-3xl font-black tracking-tight text-zinc-900 leading-none">{overall.attendance_percent}%</span>
                    <span className="block text-[9px] text-zinc-400 uppercase font-bold tracking-widest mt-1">Overall</span>
                  </div>
                </div>

                {/* Substats */}
                <div className="grid grid-cols-3 gap-6 pt-2">
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400 font-semibold uppercase tracking-wider block">Delivered</span>
                    <span className="block text-xl font-bold text-zinc-800">{overall.conducted}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-emerald-600 font-semibold uppercase tracking-wider block">Attended</span>
                    <span className="block text-xl font-bold text-emerald-600">{overall.attended}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] text-red-650 font-semibold uppercase tracking-wider block">Missed</span>
                    <span className="block text-xl font-bold text-red-650">{overall.absent}</span>
                  </div>
                </div>

                {/* Budget Banner */}
                <div className="border border-zinc-200 bg-zinc-50/50 rounded-xl p-4.5 flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-xs">
                    <Calculator className="h-4.5 w-4.5 text-zinc-400" />
                    <span className="font-semibold text-zinc-500">Remaining Safe Absences (Semester Overall)</span>
                  </div>
                  <span className="text-sm font-extrabold text-zinc-800">
                    {subjects.reduce((sum, s) => sum + Math.floor(s.safe_bunks / (s.units_per_class || 1)), 0)} classes ({subjects.reduce((sum, s) => sum + s.safe_bunks, 0)} entries)
                  </span>
                </div>
              </div>
            )}

            {/* SUBJECT-WISE CARDS */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
                <h3 className="text-[10px] font-bold text-zinc-450 uppercase tracking-widest">
                  Course Breakdown
                </h3>
              </div>

              {subjects.length === 0 ? (
                <div className="premium-card p-10 text-center space-y-4 max-w-sm mx-auto shadow-sm animate-scale-in">
                  <div className="h-10 w-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-400 mx-auto">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-zinc-800">No Attendance Recorded</h4>
                    <p className="text-[11px] text-zinc-550 leading-relaxed">
                      No attendance has been recorded. Add subjects and import your timetable/attendance setup to view metrics.
                    </p>
                  </div>
                  <Link
                    to="/setup"
                    className="inline-block rounded-xl bg-zinc-900 px-4 py-2 text-[11.5px] font-bold text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                  >
                    Get Started
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {subjects.map((subj) => {
                    const isBelow = subj.attendance_percent < subj.min_attendance_percent;
                    const isWarning = !isBelow && subj.safe_bunks === 0;

                    let colorClass = "text-emerald-600";
                    let barColor = "bg-emerald-500";
                    if (isBelow) {
                      colorClass = "text-red-650";
                      barColor = "bg-red-500";
                    } else if (isWarning) {
                      colorClass = "text-amber-600";
                      barColor = "bg-amber-500";
                    }

                    return (
                      <div key={subj.subject_id} className="premium-card p-6 flex flex-col justify-between gap-5 animate-scale-in">
                        
                        {/* Title and Code */}
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-zinc-850 leading-tight truncate max-w-[160px]">{subj.name}</h4>
                            {subj.code && (
                              <span className="text-[9px] bg-zinc-100 border border-zinc-200 text-zinc-500 px-1.5 py-0.5 rounded font-mono uppercase tracking-wide inline-block">
                                {subj.code}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <span className={`text-[18px] font-black leading-none block ${colorClass}`}>
                              {subj.attendance_percent}%
                            </span>
                            <span className="block text-[9px] text-zinc-400 font-bold tracking-wide mt-1">
                              Goal: {subj.min_attendance_percent}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                              style={{ width: `${Math.min(100, subj.attendance_percent)}%` }}
                            />
                          </div>
                        </div>

                        {/* Sub-counts */}
                        <div className="grid grid-cols-3 gap-2 text-center text-[10px] text-zinc-500 py-1.5 bg-zinc-50/50 rounded-xl border border-zinc-200/50 animate-scale-in">
                          <div>
                            <span className="block font-bold text-zinc-850">{subj.conducted}</span>
                            <span>Delivered</span>
                          </div>
                          <div>
                            <span className="block font-bold text-emerald-600">{subj.attended}</span>
                            <span>Attended</span>
                          </div>
                          <div>
                            <span className="block font-bold text-red-650">{subj.absent}</span>
                            <span>Missed</span>
                          </div>
                        </div>

                        {/* Safe Absence calculation notification */}
                        <div className="text-xs pt-1.5 border-t border-zinc-100">
                          {isBelow ? (
                            <div className="text-red-700 font-bold bg-red-50/60 border border-red-100 rounded-xl p-3 flex items-start space-x-2 animate-scale-in">
                              <AlertCircle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
                              <span className="leading-normal">
                                Below threshold! You must attend the next <strong className="font-extrabold underline">{Math.ceil(subj.required_to_attend / (subj.units_per_class || 1))}</strong> {Math.ceil(subj.required_to_attend / (subj.units_per_class || 1)) === 1 ? "class" : "classes"} consecutively to recover.
                              </span>
                            </div>
                          ) : (
                            <div className="text-zinc-500 font-bold bg-zinc-50/50 border border-zinc-200 rounded-xl p-3 flex items-start space-x-2 animate-scale-in">
                              <BookOpen className="h-4.5 w-4.5 shrink-0 mt-0.5 text-zinc-400" />
                              <span className="leading-normal">
                                Attendance Margin: You can safely miss <strong className="font-extrabold text-zinc-800">{Math.floor(subj.safe_bunks / (subj.units_per_class || 1))} lecture sessions</strong> ({subj.safe_bunks} attendance entries).
                              </span>
                            </div>
                          )}
                        </div>

                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

      </main>
    </div>
  );
};

export default AttendanceSummary;
