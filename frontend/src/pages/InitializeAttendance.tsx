import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { subjectService } from "../services/subject";
import type { Subject } from "../services/subject";
import { attendanceService } from "../services/attendance";
import { Loader2, BookOpen, Info, ShieldAlert } from "lucide-react";
import Navbar from "../components/Navbar";

const InitializeAttendance: React.FC = () => {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [semesterId, setSemesterId] = useState<number | null>(null);
  const [conductedValues, setConductedValues] = useState<Record<number, number>>({});
  const [attendedValues, setAttendedValues] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const fetchSemesterAndSubjects = async () => {
    try {
      // Find active semesters
      const res = await apiGetSemesters();
      if (res.length === 0) {
        navigate("/setup");
        return;
      }
      const sem = res[0];
      setSemesterId(sem.id);
      
      const subList = await subjectService.list(sem.id);
      setSubjects(subList);
      
      // Initialize states
      const conducted: Record<number, number> = {};
      const attended: Record<number, number> = {};
      subList.forEach((s: Subject) => {
        conducted[s.id] = 0;
        attended[s.id] = 0;
      });
      setConductedValues(conducted);
      setAttendedValues(attended);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load subjects. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  // Helper to get semesters without direct service export imports conflicts
  const apiGetSemesters = async () => {
    const response = await import("../services/api").then((m) => m.default.get("/semesters"));
    return response.data;
  };

  useEffect(() => {
    fetchSemesterAndSubjects();
  }, []);

  const handleValChange = (subjectId: number, type: "conducted" | "attended", val: number) => {
    setError(null);
    if (type === "conducted") {
      setConductedValues((prev) => ({ ...prev, [subjectId]: val }));
    } else {
      setAttendedValues((prev) => ({ ...prev, [subjectId]: val }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semesterId || submitting) return;

    // Validate: attended <= conducted for all subjects
    for (const sub of subjects) {
      const cond = conductedValues[sub.id] || 0;
      const att = attendedValues[sub.id] || 0;
      if (att > cond) {
        setError(`For subject "${sub.name}", classes attended cannot exceed classes conducted.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = subjects.map((s) => ({
        subject_id: s.id,
        initial_conducted: conductedValues[s.id] || 0,
        initial_attended: attendedValues[s.id] || 0,
      }));
      await attendanceService.initializeAttendance(semesterId, payload);
      navigate("/dashboard");
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to initialize attendance. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-6 py-12">
        <div className="space-y-6">
          
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Initialize Attendance</h1>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If this is an ongoing semester, enter the classes conducted and attended so far to seed your stats. If it is a new semester, leave them at 0.
            </p>
          </div>

          {/* Alert banner */}
          <div className="rounded-xl border border-blue-500/10 bg-blue-500/5 p-4 text-xs text-blue-500 flex items-start space-x-3 leading-relaxed">
            <Info className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block mb-0.5">Why is this required?</span>
              AttendWise needs your baseline stats to calculate safe bunks and consecutive classes. You will mark today's classes onwards using the Daily Tracker.
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3 leading-relaxed">
              <ShieldAlert className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="divide-y divide-border/60">
                {subjects.map((sub) => (
                  <div key={sub.id} className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
                        <BookOpen className="h-4 w-4 text-muted-foreground/80" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate">{sub.name}</h4>
                        {sub.code && (
                          <span className="text-[10px] text-muted-foreground uppercase font-mono tracking-wider">
                            {sub.code}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      {/* Conducted Input */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Conducted
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={conductedValues[sub.id]}
                          onChange={(e) => handleValChange(sub.id, "conducted", Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                        />
                      </div>

                      {/* Attended Input */}
                      <div className="space-y-1">
                        <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                          Attended
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={attendedValues[sub.id]}
                          onChange={(e) => handleValChange(sub.id, "attended", Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-24 rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg bg-primary py-2 px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-foreground/25 disabled:opacity-50 cursor-pointer flex items-center space-x-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Submit Initialization</span>
                )}
              </button>
            </div>
          </form>

        </div>
      </main>
    </div>
  );
};

export default InitializeAttendance;
