import React from "react";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { LogOut, GraduationCap, LayoutDashboard, Calendar, CalendarDays, Brain } from "lucide-react";

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();

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
        
        {/* Welcome Section */}
        <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-3">
          <div className="flex items-center space-x-3 text-muted-foreground">
            <LayoutDashboard className="h-4.5 w-4.5 text-foreground" />
            <span className="text-xs font-medium tracking-wide uppercase">Overview</span>
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              Attendance Planner
            </h1>
            <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
              Your academic workspace is set up and active. Create your semester timetable and configure calendar parameters to start tracking and calculating bunk budgets.
            </p>
          </div>
        </div>

        {/* Section Divider */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Platform Modules
            </h2>
          </div>

          {/* Productivity Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Daily Tracker Card */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between hover:border-foreground/10 transition-colors">
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-foreground">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Daily Tracker</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Log daily class statuses. Back-mark or edit records directly from the integrated academic calendar view.
                  </p>
                </div>
              </div>
            </div>

            {/* Leave Planner Card */}
            <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.01)] flex flex-col justify-between hover:border-foreground/10 transition-colors">
              <div className="space-y-3">
                <div className="h-8 w-8 rounded-lg bg-muted border border-border/60 flex items-center justify-center text-foreground">
                  <CalendarDays className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Leave Planner</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Simulate absences before taking them. Determine safety calculations and keep your averages above minimum thresholds.
                  </p>
                </div>
              </div>
            </div>

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
