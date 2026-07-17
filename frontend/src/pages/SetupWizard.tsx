import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { subjectService } from "../services/subject";
import type { Subject } from "../services/subject";
import { timetableService } from "../services/timetable";
import { calendarService } from "../services/calendar";
import { 
  GraduationCap, Plus, Trash2, Clock, AlertCircle, ArrowRight, Check 
} from "lucide-react";
import Navbar from "../components/Navbar";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const SetupWizard: React.FC = () => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  // Wizard state
  const [step, setStep] = useState(1);
  const [semester, setSemester] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<any[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<any[]>([]);
  
  // Local form loading/error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Semester Form
  const [semName, setSemName] = useState("");
  const [semStart, setSemStart] = useState("");
  const [semEnd, setSemEnd] = useState("");

  // Step 2: Working Week Checkboxes
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);

  // Step 3: Subject Input Form
  const [subjName, setSubjName] = useState("");
  const [subjCode, setSubjCode] = useState("");
  const [subjFaculty, setSubjFaculty] = useState("");
  const [subjMinAtt, setSubjMinAtt] = useState(75);

  // Step 4: Timetable Input Form
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSubjId, setSelectedSubjId] = useState<number | "">("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Step 5: Calendar Event Form
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("holiday");
  const [eventDesc, setEventDesc] = useState("");
  const [timetableDayOverride, setTimetableDayOverride] = useState<number | "">("");
  const [selectedExamSubjId, setSelectedExamSubjId] = useState<number | "">("");
  const [examStartTime, setExamStartTime] = useState("10:00");
  const [examEndTime, setExamEndTime] = useState("12:00");

  // Load active semester if one already exists
  useEffect(() => {
    const checkExistingSemester = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length > 0) {
          const latestSem = sems[sems.length - 1];
          setSemester(latestSem);
          setSemName(latestSem.name);
          setSemStart(latestSem.start_date);
          setSemEnd(latestSem.end_date);
          if (latestSem.working_days) {
            setWorkingDays(latestSem.working_days.split(",").map(Number));
          }
          loadSemesterData(latestSem.id);
          setStep(3); // Start at step 3 (Subjects) if semester exists
        }
      } catch (err) {
        console.error("Error loading semester details:", err);
      }
    };
    checkExistingSemester();
  }, []);

  const loadSemesterData = async (semId: number) => {
    try {
      const subjs = await subjectService.list(semId);
      setSubjects(subjs);
      
      const slots = await timetableService.list(semId);
      setTimetableSlots(slots);
      
      const evs = await calendarService.list(semId);
      setCalendarEvents(evs);
    } catch (err) {
      console.error("Error loading sub-resources:", err);
    }
  };

  const handleStepClick = (targetStep: number) => {
    if (semester || targetStep === 1) {
      setError(null);
      setStep(targetStep);
    }
  };

  // Step 1: Create or Update Semester
  const handleSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (semester) {
        const updated = await semesterService.update(semester.id, {
          name: semName,
          start_date: semStart,
          end_date: semEnd,
        });
        setSemester(updated);
      } else {
        const created = await semesterService.create({
          name: semName,
          start_date: semStart,
          end_date: semEnd,
          working_days: workingDays.join(","),
        });
        setSemester(created);
        loadSemesterData(created.id);
      }
      setStep(2); // Go to step 2 (Working Week)
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save semester.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Save Working Week days
  const handleWorkingDaysSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semester) return;
    if (workingDays.length === 0) {
      setError("Please select at least one working day.");
      return;
    }
    setError(null);
    setLoading(true);

    try {
      const updated = await semesterService.update(semester.id, {
        working_days: workingDays.join(","),
      });
      setSemester(updated);
      
      setSelectedDay(workingDays[0]);
      setStep(3); // Go to step 3 (Subjects)
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save working week.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Add Subject
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!semester) return;
    setError(null);
    setLoading(true);

    try {
      const added = await subjectService.create(semester.id, {
        name: subjName,
        code: subjCode || undefined,
        faculty: subjFaculty || undefined,
        min_attendance_percent: subjMinAtt,
      });
      setSubjects([...subjects, added]);
      
      setSubjName("");
      setSubjCode("");
      setSubjFaculty("");
      setSubjMinAtt(75);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add subject.");
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Delete Subject
  const handleDeleteSubject = async (id: number) => {
    if (!semester) return;
    try {
      await subjectService.delete(semester.id, id);
      setSubjects(subjects.filter((s) => s.id !== id));
      setTimetableSlots(timetableSlots.filter((slot) => slot.subject_id !== id));
    } catch (err) {
      console.error("Failed to delete subject:", err);
    }
  };

  // Step 4: Add Timetable Slot
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjId) {
      setError("Please select a subject.");
      return;
    }
    setError(null);

    if (startTime >= endTime) {
      setError("Start time must be before end time.");
      return;
    }

    const newSlot = {
      subject_id: Number(selectedSubjId),
      day_of_week: selectedDay,
      start_time: startTime.length === 5 ? `${startTime}:00` : startTime,
      end_time: endTime.length === 5 ? `${endTime}:00` : endTime,
    };

    setTimetableSlots([...timetableSlots, newSlot]);
  };

  // Step 4: Remove Timetable Slot
  const handleRemoveSlot = (index: number) => {
    setTimetableSlots(timetableSlots.filter((_, i) => i !== index));
  };

  // Step 5: Add Calendar Exception
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate) {
      setError("Please pick a date.");
      return;
    }
    
    if (semester) {
      if (eventDate < semester.start_date || eventDate > semester.end_date) {
        setError("Event date must fall within the semester range.");
        return;
      }
    }
    
    setError(null);

    const newEvent = {
      date: eventDate,
      event_type: eventType,
      description: eventDesc || undefined,
      timetable_day_override: eventType === "working_day_override" && timetableDayOverride !== "" ? Number(timetableDayOverride) : undefined,
      subject_id: eventType === "exam_day" && selectedExamSubjId !== "" ? Number(selectedExamSubjId) : undefined,
      start_time: eventType === "exam_day" && examStartTime !== "" ? `${examStartTime}:00` : undefined,
      end_time: eventType === "exam_day" && examEndTime !== "" ? `${examEndTime}:00` : undefined,
    };

    setCalendarEvents([...calendarEvents, newEvent]);
    setEventDate("");
    setEventDesc("");
    setTimetableDayOverride("");
    setSelectedExamSubjId("");
    setExamStartTime("10:00");
    setExamEndTime("12:00");
  };

  // Step 5: Remove Calendar Event
  const handleRemoveEvent = (index: number) => {
    setCalendarEvents(calendarEvents.filter((_, i) => i !== index));
  };

  // Step 5: Save & Complete setup
  const handleCompleteSetup = async () => {
    if (!semester) return;
    setError(null);
    setLoading(true);

    try {
      // Save timetable slots in batch
      await timetableService.save(semester.id, timetableSlots.map(slot => ({
        subject_id: slot.subject_id,
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time
      })));

      // Save calendar events in batch
      await calendarService.save(semester.id, calendarEvents.map(event => ({
        date: event.date,
        event_type: event.event_type,
        description: event.description,
        timetable_day_override: event.timetable_day_override,
        subject_id: event.subject_id,
        start_time: event.start_time,
        end_time: event.end_time
      })));

      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to complete setup. Please check your timetable/calendar inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      
      {/* Header override if semester exists to support direct persistent navigation */}
      {semester ? (
        <Navbar />
      ) : (
        <header className="border-b border-border bg-card shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
          <div className="max-w-4xl mx-auto px-6 h-14 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <GraduationCap className="h-4.5 w-4.5 text-foreground" />
              </div>
              <span className="font-semibold text-sm tracking-tight">AttendWise Setup Wizard</span>
            </div>
            <button
              onClick={logout}
              className="text-xs text-muted-foreground hover:text-foreground py-1.5 px-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
            >
              Logout
            </button>
          </div>
        </header>
      )}

      {/* Main Wizard Layout */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Clickable Step Indicator with Navigation Improvements */}
        <div className="flex items-center justify-between max-w-xl mx-auto border border-border bg-card rounded-xl p-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] text-xs text-muted-foreground font-medium">
          <button
            type="button"
            onClick={() => handleStepClick(1)}
            className={`flex items-center space-x-1.5 hover:text-foreground transition-colors cursor-pointer ${step >= 1 ? "text-foreground" : ""}`}
          >
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 1 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 1 ? <Check className="h-3 w-3" /> : "1"}
            </span>
            <span>Semester</span>
          </button>
          <div className="h-px bg-border flex-1 mx-1.5" />
          <button
            type="button"
            disabled={!semester}
            onClick={() => handleStepClick(2)}
            className={`flex items-center space-x-1.5 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${step >= 2 ? "text-foreground" : ""}`}
          >
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 2 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 2 ? <Check className="h-3 w-3" /> : "2"}
            </span>
            <span>Week</span>
          </button>
          <div className="h-px bg-border flex-1 mx-1.5" />
          <button
            type="button"
            disabled={!semester}
            onClick={() => handleStepClick(3)}
            className={`flex items-center space-x-1.5 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${step >= 3 ? "text-foreground" : ""}`}
          >
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 3 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 3 ? <Check className="h-3 w-3" /> : "3"}
            </span>
            <span>Subjects</span>
          </button>
          <div className="h-px bg-border flex-1 mx-1.5" />
          <button
            type="button"
            disabled={!semester}
            onClick={() => handleStepClick(4)}
            className={`flex items-center space-x-1.5 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${step >= 4 ? "text-foreground" : ""}`}
          >
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 4 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 4 ? <Check className="h-3 w-3" /> : "4"}
            </span>
            <span>Timetable</span>
          </button>
          <div className="h-px bg-border flex-1 mx-1.5" />
          <button
            type="button"
            disabled={!semester}
            onClick={() => handleStepClick(5)}
            className={`flex items-center space-x-1.5 hover:text-foreground transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${step >= 5 ? "text-foreground" : ""}`}
          >
            <span className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
              5
            </span>
            <span>Exceptions</span>
          </button>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-xs text-destructive flex items-start space-x-3">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* STEP 1: CREATE SEMESTER */}
        {step === 1 && (
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Semester Configuration</h2>
              <p className="text-xs text-muted-foreground">Define your current academic period timeline.</p>
            </div>

            <form onSubmit={handleSemesterSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Semester Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fall Semester 2026"
                  value={semName}
                  onChange={(e) => setSemName(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-background py-2.5 px-3.5 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start Date</label>
                  <input
                    type="date"
                    required
                    value={semStart}
                    onChange={(e) => setSemStart(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End Date</label>
                  <input
                    type="date"
                    required
                    value={semEnd}
                    onChange={(e) => setSemEnd(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 disabled:opacity-50 transition-all cursor-pointer"
              >
                <span>Continue to Working Week</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: WORKING WEEK CONFIGURATION */}
        {step === 2 && (
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Working Week Configuration</h2>
              <p className="text-xs text-muted-foreground">Select the days of the week when classes are normally conducted at your college.</p>
            </div>
            <form onSubmit={handleWorkingDaysSubmit} className="space-y-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const isChecked = workingDays.includes(idx);
                  return (
                    <label key={idx} className="flex items-center space-x-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/40 cursor-pointer select-none text-xs transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setWorkingDays(workingDays.filter(d => d !== idx));
                          } else {
                            setWorkingDays([...workingDays, idx].sort());
                          }
                        }}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4 cursor-pointer"
                      />
                      <span className="font-medium text-foreground">{day}</span>
                    </label>
                  );
                })}
              </div>

              <div className="flex items-center space-x-4 border-t border-border pt-4">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="submit"
                  className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 cursor-pointer"
                >
                  <span>Continue to Subjects</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}

        {/* STEP 3: SUBJECTS CONFIGURATION */}
        {step === 3 && (
          <div className="space-y-6">
            
            {/* Subject Input Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Course Catalog Setup</h2>
                <p className="text-xs text-muted-foreground">Add the subjects/courses you are taking this semester.</p>
              </div>

              <form onSubmit={handleAddSubject} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Operating Systems"
                      value={subjName}
                      onChange={(e) => setSubjName(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CS-301 (Optional)"
                      value={subjCode}
                      onChange={(e) => setSubjCode(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Faculty Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. John Doe (Optional)"
                      value={subjFaculty}
                      onChange={(e) => setSubjFaculty(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Min Attendance Required (%)</label>
                    <input
                      type="number"
                      required
                      min="0"
                      max="100"
                      value={subjMinAtt}
                      onChange={(e) => setSubjMinAtt(Number(e.target.value))}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading || !subjName}
                  className="flex items-center space-x-1.5 rounded-lg border border-border bg-card hover:bg-muted py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Subject</span>
                </button>
              </form>
            </div>

            {/* Added Subjects List */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Enrolled Subjects ({subjects.length})
              </h3>

              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No subjects added yet.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {subjects.map((s) => (
                    <div key={s.id} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground">{s.name}</span>
                          {s.code && <span className="text-[10px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.2 rounded font-semibold">{s.code}</span>}
                        </div>
                        {s.faculty && <span className="text-muted-foreground text-[11px] block">{s.faculty}</span>}
                      </div>
                      <div className="flex items-center space-x-4">
                        <span className="text-muted-foreground">Min Attendance: <strong>{s.min_attendance_percent}%</strong></span>
                        <button
                          onClick={() => handleDeleteSubject(s.id)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                disabled={subjects.length === 0}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                <span>Continue to Timetable</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 4: TIMETABLE CONFIGURATION */}
        {step === 4 && (
          <div className="space-y-6">
            
            {/* Timetable Input Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Weekly Timetable Config</h2>
                <p className="text-xs text-muted-foreground">Map your weekly recurring schedule. Slots can only be registered on configured working week days.</p>
              </div>

              <form onSubmit={handleAddSlot} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  
                  {/* Select Weekday */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Weekday</label>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(Number(e.target.value))}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      {DAYS_OF_WEEK.map((day, idx) => {
                        if (!workingDays.includes(idx)) return null;
                        return <option key={idx} value={idx}>{day}</option>;
                      })}
                    </select>
                  </div>

                  {/* Select Subject */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject</label>
                    <select
                      value={selectedSubjId}
                      onChange={(e) => setSelectedSubjId(e.target.value === "" ? "" : Number(e.target.value))}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      <option value="">Choose Course...</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Start Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start Time</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>

                  {/* End Time */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End Time</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!selectedSubjId}
                  className="flex items-center space-x-1.5 rounded-lg border border-border bg-card hover:bg-muted py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Timetable Slot</span>
                </button>
              </form>
            </div>

            {/* Added Slots List */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Timetable Slots Layout ({timetableSlots.length})
              </h3>

              {timetableSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No timetable slots created. Fill the fields above to schedule recurring classes.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {timetableSlots.map((slot, idx) => {
                    const subject = subjects.find((s) => s.id === slot.subject_id);
                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-4">
                          <span className="font-semibold text-foreground w-20">{DAYS_OF_WEEK[slot.day_of_week]}</span>
                          <span className="text-muted-foreground flex items-center space-x-1">
                            <Clock className="h-3.5 w-3.5 mr-1 shrink-0" />
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                          <span className="font-medium text-foreground">{subject ? subject.name : "Unknown Subject"}</span>
                        </div>
                        <button
                          onClick={() => handleRemoveSlot(idx)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(3)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setStep(5)}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 cursor-pointer"
              >
                <span>Continue to Calendar Exceptions</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 5: ACADEMIC CALENDAR EXCEPTIONS */}
        {step === 5 && (
          <div className="space-y-6">
            
            {/* Input Form Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Academic Calendar Exceptions</h2>
                <p className="text-xs text-muted-foreground">Register single-date overrides like holidays, closures, working overrides, or examinations.</p>
              </div>

              <form onSubmit={handleAddEvent} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Date</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Exception Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      <option value="holiday">Holiday</option>
                      <option value="working_day_override">Working Day Override</option>
                      <option value="college_closure">College Closure</option>
                      <option value="exam_break">Exam Break</option>
                      <option value="exam_day">Exam Day</option>
                    </select>
                  </div>
                </div>

                {eventType === "working_day_override" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Timetable Day to Run</label>
                    <select
                      value={timetableDayOverride}
                      onChange={(e) => setTimetableDayOverride(e.target.value === "" ? "" : Number(e.target.value))}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      <option value="">Default (Use actual weekday schedule of the date)</option>
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={idx} value={idx}>{day} timetable</option>
                      ))}
                    </select>
                  </div>
                )}

                {eventType === "exam_day" && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border border-border/40 p-4 rounded-lg bg-background/50">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject (Optional)</label>
                      <select
                        value={selectedExamSubjId}
                        onChange={(e) => setSelectedExamSubjId(e.target.value === "" ? "" : Number(e.target.value))}
                        className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                      >
                        <option value="">Choose Course...</option>
                        {subjects.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Start Time</label>
                      <input
                        type="time"
                        value={examStartTime}
                        onChange={(e) => setExamStartTime(e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">End Time</label>
                      <input
                        type="time"
                        value={examEndTime}
                        onChange={(e) => setExamEndTime(e.target.value)}
                        className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {eventType === "exam_day" ? "Exam Title / Description" : "Description"}
                  </label>
                  <input
                    type="text"
                    placeholder={eventType === "exam_day" ? "e.g. Operating Systems Theory Mid-Term" : "e.g. Independence Day, College Anniversary"}
                    value={eventDesc}
                    onChange={(e) => setEventDesc(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                  />
                </div>

                <button
                  type="submit"
                  className="flex items-center space-x-1.5 rounded-lg border border-border bg-card hover:bg-muted py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Exception</span>
                </button>
              </form>
            </div>

            {/* Exceptions List */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Registered Calendar Exceptions ({calendarEvents.length})
              </h3>

              {calendarEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No calendar exceptions added. Regular working week days will generate classes.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {calendarEvents.map((event, idx) => {
                    const matchedSubj = subjects.find((s) => s.id === event.subject_id);
                    return (
                      <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                            <span className="font-semibold text-foreground">{event.date}</span>
                            <span className={`text-[9px] border font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              event.event_type === "holiday" ? "bg-red-500/5 text-destructive border-destructive/15" :
                              event.event_type === "working_day_override" ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/15" :
                              event.event_type === "college_closure" ? "bg-red-500/5 text-destructive border-destructive/15" :
                              event.event_type === "exam_break" ? "bg-amber-500/5 text-amber-600 border-amber-500/15" :
                              event.event_type === "exam_day" ? "bg-amber-500/5 text-amber-600 border-amber-500/15" :
                              "bg-amber-500/5 text-amber-600 border-amber-500/15"
                            }`}>
                              {event.event_type.replace(/_/g, " ")}
                            </span>
                            {event.timetable_day_override !== undefined && event.timetable_day_override !== null && (
                              <span className="text-[9px] bg-muted text-muted-foreground border border-border/80 px-1.5 py-0.5 rounded">
                                Runs {DAYS_OF_WEEK[event.timetable_day_override]} slots
                              </span>
                            )}
                            {event.event_type === "exam_day" && (
                              <>
                                {matchedSubj && (
                                  <span className="text-[9px] bg-muted text-muted-foreground border border-border/80 px-1.5 py-0.5 rounded uppercase">
                                    {matchedSubj.code || matchedSubj.name}
                                  </span>
                                )}
                                {event.start_time && (
                                  <span className="text-[9px] text-muted-foreground flex items-center">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {event.start_time.slice(0, 5)} - {event.end_time?.slice(0, 5)}
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          {event.description && <span className="text-muted-foreground text-[11px] block">{event.description}</span>}
                        </div>
                        <button
                          onClick={() => handleRemoveEvent(idx)}
                          className="text-muted-foreground hover:text-destructive p-1.5 rounded-md hover:bg-muted cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(4)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={handleCompleteSetup}
                disabled={loading}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-5 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                {loading ? "Completing setup..." : "Complete Setup"}
              </button>
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default SetupWizard;
