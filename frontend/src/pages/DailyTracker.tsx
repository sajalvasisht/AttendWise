import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { LectureOccurrence } from "../services/attendance";
import { 
  Clock, Loader2, ArrowLeft, ChevronLeft, ChevronRight, AlertCircle
} from "lucide-react";

const DailyTracker: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const [semester, setSemester] = useState<Semester | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // "YYYY-MM-DD" local format
  );
  const [occurrences, setOccurrences] = useState<LectureOccurrence[]>([]);
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

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
        <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <Link to="/dashboard" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <span className="font-semibold text-sm tracking-tight">Daily Attendance Tracker</span>
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
            Scheduled Lectures
          </h3>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : occurrences.length === 0 ? (
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
