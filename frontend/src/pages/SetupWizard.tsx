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

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

  // Step 2: Subject Input Form
  const [subjName, setSubjName] = useState("");
  const [subjCode, setSubjCode] = useState("");
  const [subjFaculty, setSubjFaculty] = useState("");
  const [subjMinAtt, setSubjMinAtt] = useState(75);

  // Step 3: Timetable Input Form
  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedSubjId, setSelectedSubjId] = useState<number | "">("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");

  // Step 4: Calendar Event Form
  const [eventDate, setEventDate] = useState("");
  const [eventType, setEventType] = useState("holiday");
  const [eventDesc, setEventDesc] = useState("");

  // Load active semester if one already exists
  useEffect(() => {
    const checkExistingSemester = async () => {
      try {
        const sems = await semesterService.list();
        if (sems.length > 0) {
          // If user has a semester, pick the latest one and advance to Step 2
          const latestSem = sems[sems.length - 1];
          setSemester(latestSem);
          setSemName(latestSem.name);
          setSemStart(latestSem.start_date);
          setSemEnd(latestSem.end_date);
          loadSemesterData(latestSem.id);
          setStep(2);
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

  // Step 1: Create or Update Semester
  const handleSemesterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (semester) {
        // Update existing semester
        const updated = await semesterService.update(semester.id, {
          name: semName,
          start_date: semStart,
          end_date: semEnd,
        });
        setSemester(updated);
      } else {
        // Create new semester
        const created = await semesterService.create({
          name: semName,
          start_date: semStart,
          end_date: semEnd,
        });
        setSemester(created);
        loadSemesterData(created.id);
      }
      setStep(2);
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save semester. Make sure dates are valid.");
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Add Subject
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
      
      // Reset subject inputs
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

  // Step 2: Delete Subject
  const handleDeleteSubject = async (id: number) => {
    if (!semester) return;
    try {
      await subjectService.delete(semester.id, id);
      setSubjects(subjects.filter((s) => s.id !== id));
      // Remove any slots matching this subject
      setTimetableSlots(timetableSlots.filter((slot) => slot.subject_id !== id));
    } catch (err) {
      console.error("Failed to delete subject:", err);
    }
  };

  // Step 3: Add Timetable Slot
  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubjId) {
      setError("Please select a subject.");
      return;
    }
    setError(null);

    // Validate times
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

  // Step 3: Remove Timetable Slot
  const handleRemoveSlot = (index: number) => {
    setTimetableSlots(timetableSlots.filter((_, i) => i !== index));
  };

  // Step 4: Add Calendar Event
  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventDate) {
      setError("Please pick a date.");
      return;
    }
    
    // Check if eventDate falls within semester range
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
    };

    setCalendarEvents([...calendarEvents, newEvent]);
    setEventDate("");
    setEventDesc("");
  };

  // Step 4: Remove Calendar Event
  const handleRemoveEvent = (index: number) => {
    setCalendarEvents(calendarEvents.filter((_, i) => i !== index));
  };

  // Step 4: Save & Complete setup
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
        description: event.description
      })));

      // Redirect to main dashboard
      navigate("/dashboard");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to complete setup. Please check your timetable/calendar inputs.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col font-sans">
      
      {/* Header */}
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

      {/* Main Wizard Layout */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-12 space-y-10">
        
        {/* Step Indicator */}
        <div className="flex items-center justify-between max-w-md mx-auto border border-border bg-card rounded-xl p-3 shadow-[0_1px_2px_rgba(0,0,0,0.01)] text-xs text-muted-foreground font-medium">
          <div className={`flex items-center space-x-1.5 ${step >= 1 ? "text-foreground" : ""}`}>
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 1 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 1 ? <Check className="h-3 w-3" /> : "1"}
            </span>
            <span>Semester</span>
          </div>
          <div className="h-px bg-border flex-1 mx-2" />
          <div className={`flex items-center space-x-1.5 ${step >= 2 ? "text-foreground" : ""}`}>
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 2 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 2 ? <Check className="h-3 w-3" /> : "2"}
            </span>
            <span>Subjects</span>
          </div>
          <div className="h-px bg-border flex-1 mx-2" />
          <div className={`flex items-center space-x-1.5 ${step >= 3 ? "text-foreground" : ""}`}>
            <span className={`h-5 w-5 rounded-full border border-border flex items-center justify-center ${step > 3 ? "bg-foreground border-foreground text-background" : ""}`}>
              {step > 3 ? <Check className="h-3 w-3" /> : "3"}
            </span>
            <span>Timetable</span>
          </div>
          <div className="h-px bg-border flex-1 mx-2" />
          <div className={`flex items-center space-x-1.5 ${step >= 4 ? "text-foreground" : ""}`}>
            <span className="h-5 w-5 rounded-full border border-border flex items-center justify-center">
              4
            </span>
            <span>Calendar</span>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-4 text-sm text-destructive flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{error}</span>
          </div>
        )}

        {/* STEP 1: CREATE SEMESTER */}
        {step === 1 && (
          <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">Semester timeline</h2>
              <p className="text-xs text-muted-foreground">Define your college academic term dates to structure lecture occurrences.</p>
            </div>
            
            <form onSubmit={handleSemesterSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Semester Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Fall Semester 2026, Semester 5"
                  value={semName}
                  onChange={(e) => setSemName(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                className="flex items-center space-x-1.5 justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 cursor-pointer disabled:opacity-50"
              >
                <span>Continue to Subjects</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        )}

        {/* STEP 2: SUBJECT MANAGEMENT */}
        {step === 2 && (
          <div className="space-y-6">
            
            {/* Input Form Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Add Semester Subjects</h2>
                <p className="text-xs text-muted-foreground">Create subjects and set their minimum attendance thresholds (e.g. 75% for college rules).</p>
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
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Subject Code</label>
                    <input
                      type="text"
                      placeholder="e.g. CS302 (Optional)"
                      value={subjCode}
                      onChange={(e) => setSubjCode(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Faculty / Teacher</label>
                    <input
                      type="text"
                      placeholder="e.g. Dr. Ramesh (Optional)"
                      value={subjFaculty}
                      onChange={(e) => setSubjFaculty(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Required Attendance %</label>
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
                  disabled={loading}
                  className="flex items-center space-x-1.5 rounded-lg border border-border bg-card hover:bg-muted py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer disabled:opacity-50 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Subject</span>
                </button>
              </form>
            </div>

            {/* Subject List Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Created Subjects ({subjects.length})
              </h3>
              
              {subjects.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-4">No subjects added yet. Add at least one to continue.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {subjects.map((subj) => (
                    <div key={subj.id} className="py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-semibold text-foreground">{subj.name}</span>
                          {subj.code && (
                            <span className="text-[10px] bg-muted border border-border/80 text-muted-foreground px-1.5 py-0.5 rounded">
                              {subj.code}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {subj.faculty && <span>Teacher: {subj.faculty}  •  </span>}
                          <span>Threshold: {subj.min_attendance_percent}%</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeleteSubject(subj.id)}
                        className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Next Step Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(1)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={subjects.length === 0}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 disabled:opacity-50 cursor-pointer"
              >
                <span>Continue to Timetable</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
            
          </div>
        )}

        {/* STEP 3: WEEKLY TIMETABLE */}
        {step === 3 && (
          <div className="space-y-6">
            
            {/* Input Form Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Timetable scheduler</h2>
                <p className="text-xs text-muted-foreground">Define your weekly recurring schedule. Create slots with correct subject and start/end times.</p>
              </div>

              <form onSubmit={handleAddSlot} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Day of Week</label>
                    <select
                      value={selectedDay}
                      onChange={(e) => setSelectedDay(Number(e.target.value))}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={idx} value={idx}>{day}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Select Subject</label>
                    <select
                      value={selectedSubjId}
                      onChange={(e) => setSelectedSubjId(e.target.value ? Number(e.target.value) : "")}
                      required
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      <option value="">-- Choose Subject --</option>
                      {subjects.map((s) => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ""}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  className="flex items-center space-x-1.5 rounded-lg border border-border bg-card hover:bg-muted py-2 px-4 text-xs font-semibold shadow-sm cursor-pointer transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Class Slot</span>
                </button>
              </form>
            </div>

            {/* Timetable List Grid */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Weekly Schedule Overview
              </h3>

              {timetableSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No timetable slots created yet. Add slots for your classes.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                    const daySlots = timetableSlots.filter((slot) => slot.day_of_week === dayIdx);
                    if (daySlots.length === 0) return null;

                    return (
                      <div key={dayIdx} className="border border-border/80 rounded-xl p-4 space-y-3 bg-muted/20">
                        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider border-b border-border/40 pb-1.5">
                          {dayName}
                        </h4>
                        <div className="space-y-2">
                          {daySlots.map((slot, idx) => {
                            const subj = subjects.find((s) => s.id === slot.subject_id);
                            // Find matching slots index to delete accurately
                            const slotIndex = timetableSlots.findIndex(
                              (s) => s.day_of_week === slot.day_of_week && 
                                     s.subject_id === slot.subject_id && 
                                     s.start_time === slot.start_time
                            );

                            return (
                              <div key={idx} className="text-xs flex items-center justify-between py-1 px-2 bg-card border border-border/40 rounded-lg">
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-foreground">{subj?.name || "Unknown Subject"}</span>
                                  <div className="flex items-center text-[10px] text-muted-foreground space-x-1.5">
                                    <Clock className="h-3 w-3" />
                                    <span>{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</span>
                                  </div>
                                </div>
                                <button
                                  onClick={() => handleRemoveSlot(slotIndex)}
                                  className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-muted cursor-pointer transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Step 3 Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(2)}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground py-2 px-4 border border-border rounded-lg bg-card hover:bg-muted cursor-pointer"
              >
                Back
              </button>
              <button
                onClick={() => setStep(4)}
                className="flex items-center space-x-1.5 rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 cursor-pointer"
              >
                <span>Continue to Calendar</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        )}

        {/* STEP 4: ACADEMIC CALENDAR EVENTS */}
        {step === 4 && (
          <div className="space-y-6">
            
            {/* Input Form Card */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-6">
              <div className="space-y-1">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">Academic Calendar Details</h2>
                <p className="text-xs text-muted-foreground">Register holidays (no classes generated), exams, and working Saturdays (which conduct Saturday slots).</p>
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
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Event Type</label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 px-3 text-sm text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 cursor-pointer"
                    >
                      <option value="holiday">Holiday</option>
                      <option value="working_saturday">Working Saturday</option>
                      <option value="exam">Exam Day</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Description</label>
                  <input
                    type="text"
                    placeholder="e.g. Independence Day, Mid-term examinations"
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
                  <span>Add Calendar Event</span>
                </button>
              </form>
            </div>

            {/* Calendar Events List */}
            <div className="border border-border bg-card rounded-xl p-8 shadow-[0_1px_3px_rgba(0,0,0,0.01)] space-y-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest border-b border-border pb-2">
                Calendar Schedule Events ({calendarEvents.length})
              </h3>

              {calendarEvents.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">No special calendar events added. All regular weekdays will generate classes.</p>
              ) : (
                <div className="divide-y divide-border/60">
                  {calendarEvents.map((event, idx) => (
                    <div key={idx} className="py-2.5 flex items-center justify-between text-xs">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-foreground">{event.date}</span>
                          <span className={`text-[9px] border font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            event.event_type === "holiday" ? "bg-red-500/5 text-destructive border-destructive/15" :
                            event.event_type === "working_saturday" ? "bg-emerald-500/5 text-emerald-600 border-emerald-500/15" :
                            "bg-amber-500/5 text-amber-600 border-amber-500/15"
                          }`}>
                            {event.event_type.replace("_", " ")}
                          </span>
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
                  ))}
                </div>
              )}
            </div>

            {/* Step 4 Controls */}
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setStep(3)}
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
