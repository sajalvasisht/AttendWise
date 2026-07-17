import React, { useState, useEffect } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { 
  LogOut, GraduationCap, LayoutDashboard, Calendar, CalendarDays, Brain, Loader2, AlertCircle, Sparkles
} from "lucide-react";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { OverallAttendanceStats } from "../services/attendance";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [summary, setSummary] = useState<OverallAttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length === 0) {
          setLoading(false);
          return;
        }
        
        const activeSem = sems[0];
        setSemester(activeSem);

        const summaryData = await attendanceService.getSummary(activeSem.id);
        setSummary(summaryData);
      } catch (err) {
        console.error("Failed to load dashboard statistics:", err);
        setError("Error loading attendance statistics.");
      } finally {
        setLoading(false);
      }
    };
    loadDashboardData();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      
      {/* Navigation Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <GraduationCap className="h-4.5 w-4.5 text-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-foreground">
              AttendWise
            </span>
          </div>

          <div className="flex items-center space-x-6">
            <span className="text-xs text-muted-foreground font-medium">
              {user?.full_name || user?.email}
            </span>
            <button
              onClick={logout}
              className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2.5 rounded-lg hover:bg-muted cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Grid Workspace */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Global Error */}
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
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="space-y-2">
              <div className="flex items-center space-x-2.5 text-muted-foreground">
                <Sparkles className="h-4 w-4 text-foreground" />
                <span className="text-xs font-semibold tracking-wider uppercase">Get Started</span>
              </div>
              <h1 className="text-xl font-semibold text-foreground tracking-tight">
                Welcome to AttendWise
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                AttendWise is a deterministic attendance planner. Create a semester, add subjects, and build your timetable to begin logging class records and monitoring safety thresholds.
              </p>
            </div>
            
            <Link 
              to="/setup"
              className="inline-flex items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800"
            >
              Configure Semester Setup
            </Link>
          </div>
        ) : (
          /* Active state - Real attendance calculations */
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <LayoutDashboard className="h-4.5 w-4.5 text-foreground" />
                <span className="text-xs font-semibold tracking-wide uppercase">Dashboard Overview</span>
              </div>
              
              <div className="space-y-1">
                <h1 className="text-xl font-semibold text-foreground tracking-tight">
                  {semester.name} Status
                </h1>
                {summary && (
                  <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                    You have attended <strong className="font-semibold text-foreground">{summary.attended}</strong> classes out of <strong className="font-semibold text-foreground">{summary.conducted}</strong> conducted lectures so far. You have <strong className="font-semibold text-foreground">{summary.safe_bunks_budget}</strong> total safe bunks left.
                  </p>
                )}
              </div>
            </div>

            {/* Overall stat metrics */}
            {summary && (
              <div className="flex items-center space-x-8 border-l border-border pl-0 md:pl-8 py-2">
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Overall Percent</span>
                  <span className="block text-3xl font-extrabold text-foreground">{summary.attendance_percent}%</span>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Bunk Budget</span>
                  <span className="block text-3xl font-extrabold text-foreground">{summary.safe_bunks_budget}</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section Divider */}
        {semester && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Platform Modules
              </h2>
            </div>

            {/* Productivity Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              
              {/* Daily Tracker Card */}
              <Link to="/tracker" className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between hover:border-foreground/20 transition-all cursor-pointer group">
                <div className="space-y-3">
                  <div className="h-8 w-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-foreground group-hover:bg-accent transition-colors">
                    <Calendar className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:underline">Daily Tracker</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Log daily class statuses. Back-mark or edit records directly from the integrated academic calendar view.
                  </p>
                  </div>
                </div>
              </Link>

              {/* Attendance Summary Card */}
              <Link to="/summary" className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between hover:border-foreground/20 transition-all cursor-pointer group">
                <div className="space-y-3">
                  <div className="h-8 w-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-foreground group-hover:bg-accent transition-colors">
                    <CalendarDays className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:underline">Attendance Summary</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      View overall and subject-specific details, safe bunk calculations, and required attendance projections.
                    </p>
                  </div>
                </div>
              </Link>

              {/* Semester & Timetable Setup Card */}
              <Link to="/setup" className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between hover:border-foreground/20 transition-all cursor-pointer group">
                <div className="space-y-3">
                  <div className="h-8 w-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-foreground group-hover:bg-accent transition-colors">
                    <Brain className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-foreground group-hover:underline">Semester & Timetable Setup</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Configure your semester timeline, subjects list, weekly schedule, and calendar parameters manually.
                    </p>
                  </div>
                </div>
              </Link>

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
