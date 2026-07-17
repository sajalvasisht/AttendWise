import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { OverallAttendanceStats, SubjectAttendanceStats } from "../services/attendance";
import { ArrowLeft, Loader2, AlertCircle, BookOpen, Calculator } from "lucide-react";

const AttendanceSummary: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
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
        setSemester(activeSem);
        
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
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Link to="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-semibold text-sm tracking-tight">Attendance Summary</span>
          </div>

          <div className="flex items-center space-x-4">
            {semester && (
              <span className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                {semester.name}
              </span>
            )}
            <button
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-foreground py-1.5 px-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Error State Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* OVERALL SUMMARY CARD */}
            {overall && (
              <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="space-y-1">
                    <h2 className="text-lg font-semibold text-foreground tracking-tight">Semester Summary</h2>
                    <p className="text-xs text-muted-foreground">Aggregated attendance percentages across all enrolled subjects.</p>
                  </div>
                  
                  {/* Huge Percentage indicator */}
                  <div className="text-right">
                    <span className="text-3xl font-bold tracking-tight text-foreground">{overall.attendance_percent}%</span>
                    <span className="block text-[10px] text-muted-foreground uppercase font-semibold tracking-wider mt-0.5">Average</span>
                  </div>
                </div>

                {/* Substats */}
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-6 pt-2">
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Total Lectures</span>
                    <span className="block text-lg font-semibold text-foreground">{overall.total_lectures}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Conducted</span>
                    <span className="block text-lg font-semibold text-foreground">{overall.conducted}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium text-emerald-600">Present</span>
                    <span className="block text-lg font-semibold text-emerald-600">{overall.attended}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium text-destructive">Absent</span>
                    <span className="block text-lg font-semibold text-destructive">{overall.absent}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Cancelled</span>
                    <span className="block text-lg font-semibold text-foreground">{overall.cancelled}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-xs text-muted-foreground font-medium">Unmarked</span>
                    <span className="block text-lg font-semibold text-foreground">{overall.unmarked}</span>
                  </div>
                </div>

                {/* Budget Banner */}
                <div className="mt-4 border border-border bg-muted/30 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center space-x-3 text-xs">
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-muted-foreground">Remaining Safe Bunks (Semester Overall)</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">
                    {overall.safe_bunks_budget} classes
                  </span>
                </div>
              </div>
            )}

            {/* SUBJECT-WISE CARDS */}
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                  Course Breakdown
                </h3>
              </div>

              {subjects.length === 0 ? (
                <div className="rounded-xl border border-border bg-card p-8 text-center text-xs text-muted-foreground italic">
                  No courses found. Complete the setup wizard to add courses.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {subjects.map((subj) => {
                    const isBelow = subj.attendance_percent < subj.min_attendance_percent;
                    
                    return (
                      <div key={subj.subject_id} className="border border-border bg-card rounded-xl p-6 shadow-[0_1px_2px_rgba(0,0,0,0.01)] space-y-4 hover:border-foreground/10 transition-colors">
                        
                        {/* Title and Code */}
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-foreground leading-tight">{subj.name}</h4>
                            {subj.code && (
                              <span className="text-[9px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.5 rounded uppercase font-semibold">
                                {subj.code}
                              </span>
                            )}
                          </div>
                          
                          <div className="text-right">
                            <span className={`text-base font-bold ${isBelow ? "text-destructive" : "text-foreground"}`}>
                              {subj.attendance_percent}%
                            </span>
                            <span className="block text-[9px] text-muted-foreground font-medium mt-0.5">
                              Goal: {subj.min_attendance_percent}%
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isBelow ? "bg-destructive" : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(100, subj.attendance_percent)}%` }}
                          />
                        </div>

                        {/* Sub-counts */}
                        <div className="grid grid-cols-4 gap-2 text-center text-[10px] text-muted-foreground py-1 bg-muted/10 rounded-lg border border-border/30">
                          <div>
                            <span className="block font-semibold text-foreground">{subj.attended}</span>
                            <span>Present</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-foreground">{subj.absent}</span>
                            <span>Absent</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-foreground">{subj.cancelled}</span>
                            <span>Cancelled</span>
                          </div>
                          <div>
                            <span className="block font-semibold text-foreground">{subj.unmarked}</span>
                            <span>Unmarked</span>
                          </div>
                        </div>

                        {/* Safe Bunk calculation notification */}
                        <div className="text-xs pt-1">
                          {isBelow ? (
                            <div className="text-destructive font-medium bg-destructive/5 border border-destructive/10 rounded-lg p-2.5 flex items-start space-x-2">
                              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                              <span>
                                Below threshold! You must attend the next <strong className="font-bold underline">{subj.required_to_attend}</strong> classes consecutively to recover.
                              </span>
                            </div>
                          ) : (
                            <div className="text-muted-foreground bg-muted/30 border border-border/40 rounded-lg p-2.5 flex items-start space-x-2">
                              <BookOpen className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground" />
                              <span>
                                Safe Bunk: You can miss <strong className="font-bold text-foreground">{subj.safe_bunks}</strong> more lectures safely.
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
