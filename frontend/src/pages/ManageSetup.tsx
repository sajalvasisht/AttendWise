import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { subjectService } from "../services/subject";
import type { Subject } from "../services/subject";
import { timetableService } from "../services/timetable";
import type { TimetableSlot } from "../services/timetable";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import {
  Loader2,
  Calendar,
  Layers,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Bookmark,
  Upload
} from "lucide-react";
import { motion } from "framer-motion";

import { aiService } from "../services/ai";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function inputStyle(focused: boolean, hovered: boolean): React.CSSProperties {
  return {
    border: `1px solid ${
      focused
        ? "rgba(15,23,42,0.3)"
        : hovered
        ? "rgba(15,23,42,0.14)"
        : "rgba(15,23,42,0.08)"
    }`,
    backgroundColor: focused ? "#ffffff" : hovered ? "#ffffff" : "#fafafa",
    boxShadow: focused
      ? "0 0 0 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.02)"
      : "none",
    transition:
      "border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
    outline: "none",
  };
}

const ManageSetup: React.FC = () => {
  const navigate = useNavigate();

  const [activeSem, setActiveSem] = useState<Semester | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetableSlots, setTimetableSlots] = useState<TimetableSlot[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  const [activeTab, setActiveTab] = useState<"semester" | "subjects" | "timetable" | "calendar">("semester");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // AI assisted states
  const [timetableLoading, setTimetableLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [showTimetableMergeConfirm, setShowTimetableMergeConfirm] = useState(false);
  const [showCalendarMergeConfirm, setShowCalendarMergeConfirm] = useState(false);
  const [pendingSlots, setPendingSlots] = useState<any[]>([]);
  const [pendingEvents, setPendingEvents] = useState<any[]>([]);

  // Focus & Hover states tracking
  const [focusedInputs, setFocusedInputs] = useState<Record<string, boolean>>({});
  const [hoveredInputs, setHoveredInputs] = useState<Record<string, boolean>>({});

  // Semester form states
  const [semName, setSemName] = useState("");
  const [semStart, setSemStart] = useState("");
  const [semEnd, setSemEnd] = useState("");
  const [workingDays, setWorkingDays] = useState<number[]>([0, 1, 2, 3, 4]);

  // Subject form states (For adding)
  const [newSubjName, setNewSubjName] = useState("");
  const [newSubjCode, setNewSubjCode] = useState("");
  const [newSubjFaculty, setNewSubjFaculty] = useState("");
  const [newSubjMinAtt, setNewSubjMinAtt] = useState(75);
  const [newSubjUnitsPerClass, setNewSubjUnitsPerClass] = useState<number | "custom">(1);
  const [customUnits, setCustomUnits] = useState(3);
  const [newSubjTrackAttendance, setNewSubjTrackAttendance] = useState(true);
  const [newSubjActiveFrom, setNewSubjActiveFrom] = useState("");
  const [newSubjActiveUntil, setNewSubjActiveUntil] = useState("");

  // Timetable form states (For adding)
  const [newSlotDay, setNewSlotDay] = useState(0);
  const [newSlotSubjId, setNewSlotSubjId] = useState<number | "">("");
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("10:00");
  const [newSlotRoom, setNewSlotRoom] = useState("");

  // Calendar event form states (For adding)
  const [newEventDate, setNewEventDate] = useState("");
  const [newEventType, setNewEventType] = useState("holiday");
  const [newEventDesc, setNewEventDesc] = useState("");
  const [newEventOverrideDay, setNewEventOverrideDay] = useState<number | "">("");

  // Confirmation state
  const [subjectToDelete, setSubjectToDelete] = useState<number | null>(null);

  useEffect(() => {
    loadSemesterDetails();
  }, []);

  const loadSemesterDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const sems = await semesterService.list();
      const active = sems.find((s) => s.is_active);
      if (!active) {
        navigate("/setup");
        return;
      }
      setActiveSem(active);
      setSemName(active.name);
      setSemStart(active.start_date);
      setSemEnd(active.end_date);
      if (active.working_days) {
        setWorkingDays(active.working_days.split(",").map(Number));
      }

      // Fetch children
      const [subjs, slots, events] = await Promise.all([
        subjectService.list(active.id),
        timetableService.list(active.id),
        calendarService.list(active.id),
      ]);
      setSubjects(subjs);
      setTimetableSlots(slots);
      setCalendarEvents(events);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load semester setup data.");
    } finally {
      setLoading(false);
    }
  };

  const setInputFocus = (key: string, focused: boolean) => {
    setFocusedInputs(prev => ({ ...prev, [key]: focused }));
  };

  const setInputHover = (key: string, hovered: boolean) => {
    setHoveredInputs(prev => ({ ...prev, [key]: hovered }));
  };

  const handleUpdateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await semesterService.update(activeSem.id, {
        name: semName,
        start_date: semStart,
        end_date: semEnd,
        working_days: workingDays.join(","),
      });
      setSuccess("Semester details updated successfully. Schedule occurrences regenerated.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to update semester details.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem) return;
    if (!newSubjName.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const finalUnits = newSubjUnitsPerClass === "custom" ? customUnits : newSubjUnitsPerClass;
      await subjectService.create(activeSem.id, {
        name: newSubjName,
        code: newSubjCode || undefined,
        faculty: newSubjFaculty || undefined,
        min_attendance_percent: newSubjMinAtt,
        units_per_class: finalUnits,
        track_attendance: newSubjTrackAttendance,
        active_from: newSubjActiveFrom || undefined,
        active_until: newSubjActiveUntil || undefined,
      });
      setSuccess("Subject added successfully.");
      setTimeout(() => setSuccess(null), 3000);
      setNewSubjName("");
      setNewSubjCode("");
      setNewSubjFaculty("");
      setNewSubjMinAtt(75);
      setNewSubjUnitsPerClass(1);
      setCustomUnits(3);
      setNewSubjTrackAttendance(true);
      setNewSubjActiveFrom("");
      setNewSubjActiveUntil("");
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async (subjectId: number) => {
    if (!activeSem) return;
    setLoading(true);
    setError(null);
    try {
      await subjectService.delete(activeSem.id, subjectId);
      setSuccess("Subject deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      setSubjectToDelete(null);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete subject.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddTimetableSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem || !newSlotSubjId) return;

    setSaving(true);
    setError(null);
    try {
      // Smart Timetable Detection:
      const [sh, sm] = newSlotStart.split(":").map(Number);
      const [eh, em] = newSlotEnd.split(":").map(Number);
      const duration = (eh * 60 + em) - (sh * 60 + sm);
      
      let detectedEntries = 1;
      if (duration === 60) detectedEntries = 1;
      else if (duration === 120) detectedEntries = 2;
      else if (duration === 180) detectedEntries = 3;

      const subjectId = Number(newSlotSubjId);
      const subject = subjects.find(s => s.id === subjectId);
      
      if (subject && subject.units_per_class !== detectedEntries) {
        try {
          await subjectService.update(activeSem.id, subjectId, {
            units_per_class: detectedEntries
          });
        } catch (err) {
          console.error("Failed to auto-update subject entries based on slot duration:", err);
        }
      }

      await timetableService.save(activeSem.id, [{
        subject_id: subjectId,
        day_of_week: newSlotDay,
        start_time: newSlotStart,
        end_time: newSlotEnd,
        room: newSlotRoom.trim() || undefined
      }], "merge");
      setSuccess("Timetable slot added successfully.");
      setTimeout(() => setSuccess(null), 3000);
      setNewSlotSubjId("");
      setNewSlotRoom("");
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add timetable slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimetableSlot = async (slotId: number) => {
    if (!activeSem) return;
    setLoading(true);
    setError(null);
    try {
      const filtered = timetableSlots
        .filter((s) => s.id !== slotId)
        .map((s) => ({
          subject_id: s.subject_id,
          day_of_week: s.day_of_week,
          start_time: s.start_time,
          end_time: s.end_time,
          room: s.room
        }));
      await timetableService.save(activeSem.id, filtered, "replace");
      setSuccess("Timetable slot deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete timetable slot.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem || !newEventDate) return;

    setSaving(true);
    setError(null);
    try {
      await calendarService.save(activeSem.id, [{
        date: newEventDate,
        event_type: newEventType,
        description: newEventDesc || undefined,
        timetable_day_override: newEventType === "working_day_override" && newEventOverrideDay !== "" ? Number(newEventOverrideDay) : undefined,
      }], "merge");
      setSuccess("Calendar exception added successfully.");
      setTimeout(() => setSuccess(null), 3000);
      setNewEventDate("");
      setNewEventDesc("");
      setNewEventOverrideDay("");
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add calendar exception.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCalendarEvent = async (eventId: number) => {
    if (!activeSem) return;
    setLoading(true);
    setError(null);
    try {
      const filtered = calendarEvents
        .filter((ev) => ev.id !== eventId)
        .map((ev) => ({
          date: ev.date,
          event_type: ev.event_type,
          description: ev.description || undefined,
          timetable_day_override: ev.timetable_day_override || undefined,
          subject_id: ev.subject_id || undefined,
        }));
      await calendarService.save(activeSem.id, filtered, "replace");
      setSuccess("Calendar exception deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete calendar exception.");
    } finally {
      setLoading(false);
    }
  };

  const toggleWorkingDay = (dayIdx: number) => {
    setWorkingDays((prev) => {
      if (prev.includes(dayIdx)) {
        return prev.filter((d) => d !== dayIdx);
      } else {
        return [...prev, dayIdx].sort();
      }
    });
  };

  const handleTimetableAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSem) return;

    setTimetableLoading(true);
    setError(null);
    try {
      const parsed = await aiService.extractTimetable(file);
      setPendingSlots(parsed.timetable_slots);
      setShowTimetableMergeConfirm(true);
    } catch (err: any) {
      setError("Failed to extract timetable slots via AI. Please verify document formatting.");
    } finally {
      setTimetableLoading(false);
    }
  };

  const handleConfirmTimetableMerge = async () => {
    if (!activeSem) return;
    setSaving(true);
    try {
      const payload = pendingSlots.map((slot) => {
        const matched = subjects.find(
          (s) =>
            s.name.toLowerCase() === slot.subject_name.toLowerCase() ||
            (slot.subject_code && s.code && s.code.toLowerCase() === slot.subject_code.toLowerCase())
        );
        return {
          subject_id: matched ? matched.id : subjects[0]?.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time,
          end_time: slot.end_time,
        };
      });

      await timetableService.save(activeSem.id, payload);
      setSuccess("AI timetable merge complete.");
      setTimeout(() => setSuccess(null), 3000);
      setShowTimetableMergeConfirm(false);
      await loadSemesterDetails();
    } catch (err: any) {
      setError("Failed to save parsed timetable slots.");
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeSem) return;

    setCalendarLoading(true);
    setError(null);
    try {
      const parsed = await aiService.extractCalendar(file);
      setPendingEvents(parsed.events);
      setShowCalendarMergeConfirm(true);
    } catch (err: any) {
      setError("Failed to extract calendar dates via AI.");
    } finally {
      setCalendarLoading(false);
    }
  };

  const handleConfirmCalendarMerge = async () => {
    if (!activeSem) return;
    setSaving(true);
    try {
      const payload = pendingEvents.map((ev) => {
        let mappedType = "holiday";
        const cat = ev.category.toLowerCase();
        if (cat.includes("holiday")) mappedType = "holiday";
        else if (cat.includes("closure")) mappedType = "college_closure";
        else if (cat.includes("override")) mappedType = "working_day_override";
        else if (cat === "st" || cat.includes("sessional")) mappedType = "ST";
        else if (cat === "fa" || cat.includes("final assessment")) mappedType = "FA";
        else if (cat === "ce" || cat.includes("continuous evaluation")) mappedType = "CE";
        else if (cat.includes("exam")) mappedType = "exam_day";
        else if (cat.includes("break")) mappedType = "exam_break";

        return {
          date: ev.date,
          event_type: mappedType,
          description: ev.description || ev.title,
        };
      });

      await calendarService.save(activeSem.id, payload, "merge");
      setSuccess("AI calendar merge complete.");
      setTimeout(() => setSuccess(null), 3000);
      setShowCalendarMergeConfirm(false);
      await loadSemesterDetails();
    } catch (err: any) {
      setError("Failed to merge academic calendar events.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && subjects.length === 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfdfd] text-[#0f172a] font-sans">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-300" />
        <p className="text-xs text-zinc-400 font-semibold mt-3">Loading setup data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-14 space-y-10">
        
        {/* Header */}
        <div className="flex items-center space-x-3.5 border-b border-zinc-150/60 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/50 bg-white shadow-sm">
            <Layers className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Manage Semester Setup</h1>
            <p className="text-xs text-zinc-500 font-semibold mt-1">Configure subjects, weekly timetable structure, calendar exceptions, and settings.</p>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="rounded-xl border border-red-500/15 bg-red-50/50 p-4 text-xs text-red-650 flex items-start space-x-2.5 leading-relaxed font-semibold animate-scale-in shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5 text-red-500" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-50/50 p-4 text-xs text-emerald-650 flex items-start space-x-2.5 leading-relaxed font-semibold animate-scale-in shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5 text-emerald-500" />
            <span>{success}</span>
          </div>
        )}

        {/* Dynamic Tab Navigation Buttons */}
        <div className="flex border-b border-zinc-150/60 pb-px space-x-6 text-xs font-semibold select-none">
          {[
            { id: "semester", label: "Semester Info", icon: Layers },
            { id: "subjects", label: "Subjects & Values", icon: Bookmark },
            { id: "timetable", label: "Weekly Timetable", icon: Clock },
            { id: "calendar", label: "Calendar Overrides", icon: Calendar }
          ].map((tab) => {
            const Icon = tab.icon;
            const isCurrent = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id as any);
                  setError(null);
                  setSuccess(null);
                }}
                className={`flex items-center space-x-2 pb-3.5 transition-colors cursor-pointer border-b-2 uppercase tracking-widest text-[10px] ${
                  isCurrent 
                    ? "border-zinc-900 text-zinc-900 font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-650"
                }`}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: SEMESTER INFO EDIT */}
        {activeTab === "semester" && (
          <form onSubmit={handleUpdateSemester} className="premium-card p-6 space-y-6 animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Semester Name</label>
                <input
                  type="text"
                  required
                  value={semName}
                  onChange={(e) => setSemName(e.target.value)}
                  onFocus={() => setInputFocus("semName", true)}
                  onBlur={() => setInputFocus("semName", false)}
                  onMouseEnter={() => setInputHover("semName", true)}
                  onMouseLeave={() => setInputHover("semName", false)}
                  style={inputStyle(!!focusedInputs["semName"], !!hoveredInputs["semName"])}
                  className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">Start Date</label>
                <input
                  type="date"
                  required
                  value={semStart}
                  onChange={(e) => setSemStart(e.target.value)}
                  onFocus={() => setInputFocus("semStart", true)}
                  onBlur={() => setInputFocus("semStart", false)}
                  onMouseEnter={() => setInputHover("semStart", true)}
                  onMouseLeave={() => setInputHover("semStart", false)}
                  style={inputStyle(!!focusedInputs["semStart"], !!hoveredInputs["semStart"])}
                  className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-850 font-semibold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest block">End Date</label>
                <input
                  type="date"
                  required
                  value={semEnd}
                  onChange={(e) => setSemEnd(e.target.value)}
                  onFocus={() => setInputFocus("semEnd", true)}
                  onBlur={() => setInputFocus("semEnd", false)}
                  onMouseEnter={() => setInputHover("semEnd", true)}
                  onMouseLeave={() => setInputHover("semEnd", false)}
                  style={inputStyle(!!focusedInputs["semEnd"], !!hoveredInputs["semEnd"])}
                  className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-850 font-semibold"
                />
              </div>
            </div>

            {/* Working Days Selector */}
            <div className="space-y-3">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Weekly Working Days</label>
              <div className="flex flex-wrap gap-2.5">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const active = workingDays.includes(idx);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleWorkingDay(idx)}
                      className={`text-xs font-bold py-2 px-4 rounded-xl border transition-all cursor-pointer shadow-sm ${
                        active
                          ? "bg-zinc-900 border-zinc-900 text-white"
                          : "bg-white border-zinc-200 text-zinc-500 hover:text-zinc-700"
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-5 flex justify-end">
              <motion.button
                type="submit"
                disabled={saving}
                whileHover={!saving ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                whileTap={!saving ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                transition={{ duration: 0.16 }}
                className="rounded-xl bg-zinc-900 h-10 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 select-none"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
                <span>Save Semester Details</span>
              </motion.button>
            </div>
          </form>
        )}

        {/* TAB 2: SUBJECTS & ATTENDANCE UNIT CONFIGURATION */}
        {activeTab === "subjects" && (
          <div className="space-y-6 animate-scale-in">
            {/* List of current subjects */}
            <div className="premium-card p-6 space-y-4">
              <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 pb-2">Current Subjects ({subjects.length})</h3>
              
              {subjects.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-500 font-semibold">No subjects added. Add your first subject using the form below.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {subjects.map((subj) => (
                    <div key={subj.id} className="py-4.5 flex justify-between items-start gap-4 first:pt-0 last:pb-0">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-zinc-800">{subj.name}</h4>
                          {subj.code && (
                            <span className="text-[9px] bg-zinc-100 border border-zinc-200/60 text-zinc-500 px-2 py-0.2 rounded font-mono uppercase font-semibold tracking-wider">
                              {subj.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-450 font-semibold leading-relaxed">
                          {subj.faculty ? `Faculty: ${subj.faculty} | ` : ""}
                          Required: <span className="font-extrabold text-zinc-700">{subj.min_attendance_percent}%</span>
                        </p>
                        <div className="flex flex-wrap items-center gap-2 text-[9.5px] font-bold pt-1.5">
                          <span className="bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full border border-blue-100">
                            Entries: {subj.units_per_class || 1}
                          </span>
                          <span className={subj.track_attendance ? "bg-emerald-50 text-emerald-700 px-2.5 py-0.5 rounded-full border border-emerald-100" : "bg-zinc-50 text-zinc-550 px-2.5 py-0.5 rounded-full border border-zinc-200"}>
                            {subj.track_attendance ? "Tracking Enabled" : "Tracking Disabled"}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSubjectToDelete(subj.id)}
                        className="p-2.5 rounded-xl border border-red-100 bg-red-50/50 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer shadow-sm"
                        title="Delete Subject"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Form to add a subject */}
            <form onSubmit={handleAddSubject} className="premium-card p-6 space-y-6">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-widest flex items-center space-x-2 border-b border-zinc-100 pb-3">
                <Plus className="h-4.5 w-4.5 text-zinc-400" />
                <span>Add New Subject</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={newSubjName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setNewSubjName(val);
                      const valLower = val.toLowerCase();
                      if (valLower.includes("lab") || valLower.includes("2-hour") || valLower.includes("2 hour") || valLower.includes("2hr")) {
                        setNewSubjUnitsPerClass(2);
                      } else {
                        setNewSubjUnitsPerClass(1);
                      }
                      if (valLower.includes("sts")) {
                        setNewSubjTrackAttendance(false);
                      } else {
                        setNewSubjTrackAttendance(true);
                      }
                    }}
                    onFocus={() => setInputFocus("newSubjName", true)}
                    onBlur={() => setInputFocus("newSubjName", false)}
                    onMouseEnter={() => setInputHover("newSubjName", true)}
                    onMouseLeave={() => setInputHover("newSubjName", false)}
                    style={inputStyle(!!focusedInputs["newSubjName"], !!hoveredInputs["newSubjName"])}
                    placeholder="e.g. Operating Systems"
                    className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Subject Code</label>
                  <input
                    type="text"
                    value={newSubjCode}
                    onChange={(e) => setNewSubjCode(e.target.value)}
                    onFocus={() => setInputFocus("newSubjCode", true)}
                    onBlur={() => setInputFocus("newSubjCode", false)}
                    onMouseEnter={() => setInputHover("newSubjCode", true)}
                    onMouseLeave={() => setInputHover("newSubjCode", false)}
                    style={inputStyle(!!focusedInputs["newSubjCode"], !!hoveredInputs["newSubjCode"])}
                    placeholder="e.g. CS-302"
                    className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Faculty Name</label>
                  <input
                    type="text"
                    value={newSubjFaculty}
                    onChange={(e) => setNewSubjFaculty(e.target.value)}
                    onFocus={() => setInputFocus("newSubjFaculty", true)}
                    onBlur={() => setInputFocus("newSubjFaculty", false)}
                    onMouseEnter={() => setInputHover("newSubjFaculty", true)}
                    onMouseLeave={() => setInputHover("newSubjFaculty", false)}
                    style={inputStyle(!!focusedInputs["newSubjFaculty"], !!hoveredInputs["newSubjFaculty"])}
                    placeholder="e.g. Dr. Jane Smith"
                    className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Min Required Target (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newSubjMinAtt}
                    onChange={(e) => setNewSubjMinAtt(Number(e.target.value))}
                    onFocus={() => setInputFocus("newSubjMinAtt", true)}
                    onBlur={() => setInputFocus("newSubjMinAtt", false)}
                    onMouseEnter={() => setInputHover("newSubjMinAtt", true)}
                    onMouseLeave={() => setInputHover("newSubjMinAtt", false)}
                    style={inputStyle(!!focusedInputs["newSubjMinAtt"], !!hoveredInputs["newSubjMinAtt"])}
                    className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>

                {/* Attendance Entries Per Scheduled Class */}
                <div className="space-y-1.5 animate-scale-in">
                  <div className="flex items-center space-x-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Attendance Entries Per Class</label>
                    <div className="group relative inline-block">
                      <span className="text-zinc-400 hover:text-zinc-600 transition-colors cursor-pointer select-none text-[11px] font-bold">ⓘ</span>
                      <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 w-64 bg-zinc-950 text-white text-[10px] p-3.5 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 leading-relaxed font-normal normal-case tracking-normal">
                        <p className="font-semibold mb-1 text-white">Some scheduled classes count as multiple attendance entries.</p>
                        <div className="space-y-0.5 text-zinc-300 mt-1">
                          <div>• Normal lecture (1 hour) → 1 attendance entry</div>
                          <div>• 2-hour lecture/lab → 2 attendance entries</div>
                          <div>• 3-hour workshop → 3 attendance entries</div>
                        </div>
                        <p className="mt-1.5 text-zinc-400">AttendWise automatically uses this value while calculating attendance percentages, leave planner results and forecasts.</p>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-950"></div>
                      </div>
                    </div>
                  </div>
                  <select
                    value={newSubjUnitsPerClass}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === "custom") {
                        setNewSubjUnitsPerClass("custom");
                        setCustomUnits(3);
                      } else {
                        setNewSubjUnitsPerClass(Number(val));
                      }
                    }}
                    className="block w-full rounded-xl py-2 px-3 text-xs text-zinc-800 font-semibold bg-[#fafafa] border border-zinc-200 outline-none"
                  >
                    <option value="1">1 (Default lecture)</option>
                    <option value="2">2 (e.g. 2-hour Lab)</option>
                    <option value="custom">Custom Value</option>
                  </select>
                </div>

                {newSubjUnitsPerClass === "custom" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Custom Attendance Entries</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={customUnits}
                      onChange={(e) => setCustomUnits(Math.max(1, parseInt(e.target.value) || 1))}
                      className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold bg-[#fafafa] border border-zinc-200 outline-none"
                    />
                  </div>
                )}

                {/* Track Attendance Toggle */}
                <div className="space-y-1.5 flex items-center space-x-3 pt-3">
                  <input
                    type="checkbox"
                    id="track_attendance_chk"
                    checked={newSubjTrackAttendance}
                    onChange={(e) => setNewSubjTrackAttendance(e.target.checked)}
                    className="h-4 w-4 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                  />
                  <label htmlFor="track_attendance_chk" className="text-xs font-bold text-zinc-700 cursor-pointer select-none">
                    Track Attendance for this subject
                  </label>
                </div>

                {/* Active From and Active Until Dates */}
                <div className="space-y-1.5 animate-scale-in">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Active From</label>
                  <input
                    type="date"
                    value={newSubjActiveFrom}
                    onChange={(e) => setNewSubjActiveFrom(e.target.value)}
                    className="block w-full rounded-xl py-2 px-3 text-xs text-zinc-800 font-semibold bg-[#fafafa] border border-zinc-200 outline-none cursor-pointer"
                  />
                </div>
                <div className="space-y-1.5 animate-scale-in">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Active Until (Optional)</label>
                  <input
                    type="date"
                    value={newSubjActiveUntil}
                    onChange={(e) => setNewSubjActiveUntil(e.target.value)}
                    className="block w-full rounded-xl py-2 px-3 text-xs text-zinc-800 font-semibold bg-[#fafafa] border border-zinc-200 outline-none cursor-pointer"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <motion.button
                  type="submit"
                  disabled={saving}
                  whileHover={!saving ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                  whileTap={!saving ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                  transition={{ duration: 0.16 }}
                  className="rounded-xl bg-zinc-900 h-10 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 select-none"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
                  <span>Add Subject</span>
                </motion.button>
              </div>
            </form>

            {/* Subject Delete Confirmation Dialog Modal */}
            {subjectToDelete !== null && (
              <>
                <div className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[3px]" onClick={() => setSubjectToDelete(null)} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-sm w-full bg-white border border-zinc-200/50 rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-5 animate-scale-in text-[#0f172a]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-500 border border-red-100 mx-auto">
                    <AlertTriangle className="h-5.5 w-5.5" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-base font-black text-zinc-900">Delete Subject?</h3>
                    <p className="text-[12px] text-zinc-500 leading-relaxed font-semibold">
                      This will permanently purge this course configurations, all its associated weekly timetable slots, calendar exceptions, and marked attendance records.
                    </p>
                  </div>
                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setSubjectToDelete(null)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDeleteSubject(subjectToDelete)}
                      className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-red-700 cursor-pointer shadow-sm"
                    >
                      Delete Course
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: TIMETABLE CONFIGURATION */}
        {activeTab === "timetable" && (
          <div className="space-y-6 animate-scale-in">
            {/* List of current timetable slots */}
            <div className="premium-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Weekly Timetable Slots</h3>
                  <p className="text-[11.5px] text-zinc-500 font-semibold mt-1">Timetable slots define the recurring classes conducted every week.</p>
                </div>
                
                {/* AI Timetable Uploader */}
                <div className="relative shrink-0">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleTimetableAIUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={timetableLoading}
                  />
                  <button
                    disabled={timetableLoading}
                    className="rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-650 hover:text-zinc-800 transition-all cursor-pointer shadow-sm flex items-center space-x-1.5 disabled:opacity-50 select-none"
                  >
                    {timetableLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                    ) : (
                      <Upload className="h-4 w-4 text-zinc-400" />
                    )}
                    <span>Merge Timetable PDF (AI)</span>
                  </button>
                </div>
              </div>

              {timetableSlots.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400 italic font-semibold">No timetable slots scheduled.</div>
              ) : (
                <div className="space-y-5">
                  {DAYS_OF_WEEK.map((dayName, dayIdx) => {
                    const daySlots = timetableSlots
                      .filter((s) => s.day_of_week === dayIdx)
                      .sort((a, b) => a.start_time.localeCompare(b.start_time));
                    
                    if (daySlots.length === 0) return null;
                    return (
                      <div key={dayName} className="space-y-2">
                        <h4 className="text-[10px] font-extrabold text-zinc-700 uppercase tracking-widest">{dayName}</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {daySlots.map((slot) => {
                            const subj = subjects.find(s => s.id === slot.subject_id);
                            const subjName = subj ? subj.name : "Unknown Subject";
                            const subjCode = subj ? subj.code : null;
                            return (
                              <div key={slot.id} className="border border-zinc-200/60 rounded-xl bg-zinc-50/20 p-4.5 flex justify-between items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs font-bold text-zinc-800">{subjName}</span>
                                    {subjCode && (
                                      <span className="text-[9px] bg-zinc-100 border border-zinc-200/60 text-zinc-550 px-1.5 py-0.2 rounded font-mono uppercase tracking-wide">
                                        {subjCode}
                                      </span>
                                    )}
                                  </div>
                                  <span className="text-[10.5px] text-zinc-450 font-bold block mt-1">
                                    {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                                    {slot.room && (
                                      <span className="ml-2 px-1.5 py-0.5 rounded bg-zinc-150 text-zinc-650 border border-zinc-200 text-[9px] font-bold">
                                        Room: {slot.room}
                                      </span>
                                    )}
                                  </span>
                                </div>
                                <button
                                  onClick={() => handleDeleteTimetableSlot(slot.id)}
                                  className="p-2 rounded-xl text-zinc-450 hover:text-red-500 hover:bg-red-50/50 transition-colors cursor-pointer border border-transparent hover:border-red-100/50"
                                >
                                  <Trash2 className="h-4 w-4" />
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

            {/* Form to add a slot */}
            <form onSubmit={handleAddTimetableSlot} className="premium-card p-6 space-y-6">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-widest flex items-center space-x-2 border-b border-zinc-100 pb-3">
                <Plus className="h-4.5 w-4.5 text-zinc-400" />
                <span>Add Timetable Slot</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                
                {/* Select Weekday */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Weekday</label>
                  <select
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(Number(e.target.value))}
                    className="block w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-450 shadow-sm cursor-pointer"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={day} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>

                {/* Select Subject */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Subject</label>
                  <select
                    required
                    value={newSlotSubjId}
                    onChange={(e) => setNewSlotSubjId(e.target.value === "" ? "" : Number(e.target.value))}
                    className="block w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-450 shadow-sm cursor-pointer"
                  >
                    <option value="">Select subject...</option>
                    {subjects.map((s) => (
                      <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ""}</option>
                    ))}
                  </select>
                </div>

                {/* Room Location */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Room</label>
                  <input
                    type="text"
                    value={newSlotRoom}
                    onChange={(e) => setNewSlotRoom(e.target.value)}
                    placeholder="e.g. Room 301"
                    className="block w-full rounded-xl py-2 px-3.5 text-xs text-zinc-800 font-semibold bg-[#fafafa] border border-zinc-200 outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    onFocus={() => setInputFocus("newSlotStart", true)}
                    onBlur={() => setInputFocus("newSlotStart", false)}
                    onMouseEnter={() => setInputHover("newSlotStart", true)}
                    onMouseLeave={() => setInputHover("newSlotStart", false)}
                    style={inputStyle(!!focusedInputs["newSlotStart"], !!hoveredInputs["newSlotStart"])}
                    className="block w-full rounded-xl py-2 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">End Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    onFocus={() => setInputFocus("newSlotEnd", true)}
                    onBlur={() => setInputFocus("newSlotEnd", false)}
                    onMouseEnter={() => setInputHover("newSlotEnd", true)}
                    onMouseLeave={() => setInputHover("newSlotEnd", false)}
                    style={inputStyle(!!focusedInputs["newSlotEnd"], !!hoveredInputs["newSlotEnd"])}
                    className="block w-full rounded-xl py-2 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <motion.button
                  type="submit"
                  disabled={saving || newSlotSubjId === ""}
                  whileHover={!(saving || newSlotSubjId === "") ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                  whileTap={!(saving || newSlotSubjId === "") ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                  transition={{ duration: 0.16 }}
                  className="rounded-xl bg-zinc-900 h-10 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 select-none"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
                  <span>Add Timetable Slot</span>
                </motion.button>
              </div>
            </form>

            {/* AI Timetable Merge Confirmation overlay Modal dialog */}
            {showTimetableMergeConfirm && (
              <>
                <div className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[3px]" onClick={() => setShowTimetableMergeConfirm(false)} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-md w-full bg-white border border-zinc-200/50 rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-6 text-[#0f172a] animate-scale-in">
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-zinc-800">Confirm Parsed Slots ({pendingSlots.length})</h3>
                    <p className="text-[12.5px] text-zinc-500 font-semibold leading-relaxed">
                      Below is the list of classes found in your document. Click proceed to merge these weekly entries into your timetable layout.
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 p-4.5 bg-zinc-50/50 max-h-52 overflow-y-auto space-y-2.5">
                    {pendingSlots.map((slot, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-zinc-100 pb-1.5 last:border-0 last:pb-0 text-zinc-700">
                        <span>{slot.subject_name} ({DAYS_OF_WEEK[slot.day_of_week].slice(0, 3)})</span>
                        <span className="text-zinc-500 font-mono">{slot.start_time} - {slot.end_time}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowTimetableMergeConfirm(false)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmTimetableMerge}
                      className="rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer shadow-sm"
                    >
                      Proceed & Merge
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 4: CALENDAR EXCEPTIONS CONFIGURATION */}
        {activeTab === "calendar" && (
          <div className="space-y-6 animate-scale-in">
            {/* List of current calendar exceptions */}
            <div className="premium-card p-6 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-zinc-100 pb-3">
                <div>
                  <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Active Academic Calendar Overrides</h3>
                  <p className="text-[11.5px] text-zinc-500 font-semibold mt-1">Calendar exceptions represent holidays, working days updates, and examinations.</p>
                </div>
                
                {/* AI Calendar Exception Uploader */}
                <div className="relative shrink-0">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleCalendarAIUpload}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    disabled={calendarLoading}
                  />
                  <button
                    disabled={calendarLoading}
                    className="rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-650 hover:text-zinc-800 transition-all cursor-pointer shadow-sm flex items-center space-x-1.5 disabled:opacity-50 select-none"
                  >
                    {calendarLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />
                    ) : (
                      <Upload className="h-4 w-4 text-zinc-400" />
                    )}
                    <span>Merge Academic Calendar (AI)</span>
                  </button>
                </div>
              </div>

              {calendarEvents.length === 0 ? (
                <div className="text-center py-8 text-xs text-zinc-400 italic font-semibold">No calendar overrides logged.</div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto space-y-2.5 pr-1">
                  {calendarEvents
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((ev) => (
                      <div key={ev.id} className="border border-zinc-200/60 rounded-xl bg-zinc-50/20 p-4 flex justify-between items-center gap-3 shadow-[0_1px_2px_rgba(0,0,0,0.015)]">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-zinc-800">{ev.description || "Holiday Exception"}</span>
                            <span className="text-[9px] bg-zinc-100 border border-zinc-200/60 text-zinc-550 px-1.5 py-0.2 rounded font-bold uppercase tracking-wider">
                              {ev.event_type.replace(/_/g, " ")}
                            </span>
                            {ev.event_type === "working_day_override" && ev.timetable_day_override !== null && ev.timetable_day_override !== undefined && (
                              <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                                Acts as {DAYS_OF_WEEK[ev.timetable_day_override]}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-zinc-400 font-bold block mt-1.5 font-mono">{ev.date}</span>
                        </div>
                        <button
                          onClick={() => handleDeleteCalendarEvent(ev.id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-50/50 transition-colors cursor-pointer border border-transparent hover:border-red-100/50 animate-scale-in"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Form to add a calendar exception */}
            <form onSubmit={handleAddCalendarEvent} className="premium-card p-6 space-y-6">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-widest flex items-center space-x-2 border-b border-zinc-100 pb-3">
                <Plus className="h-4.5 w-4.5 text-zinc-400" />
                <span>Add Calendar Override</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Exception Date</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    onFocus={() => setInputFocus("newEventDate", true)}
                    onBlur={() => setInputFocus("newEventDate", false)}
                    onMouseEnter={() => setInputHover("newEventDate", true)}
                    onMouseLeave={() => setInputHover("newEventDate", false)}
                    style={inputStyle(!!focusedInputs["newEventDate"], !!hoveredInputs["newEventDate"])}
                    className="block w-full rounded-xl py-2 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Type of Override</label>
                  <select
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value)}
                    className="block w-full rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-450 shadow-sm cursor-pointer"
                  >
                    <option value="holiday">Holiday Exception</option>
                    <option value="college_closure">Campus Closure</option>
                    <option value="exam_day">Examination Session</option>
                    <option value="exam_break">Preparatory Break</option>
                    <option value="working_day_override">Working Day Override</option>
                    <option value="ST">ST (Sessional Test)</option>
                    <option value="FA">FA (Final Assessment)</option>
                    <option value="CE">CE (Continuous Evaluation)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Override Description</label>
                  <input
                    type="text"
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                    onFocus={() => setInputFocus("newEventDesc", true)}
                    onBlur={() => setInputFocus("newEventDesc", false)}
                    onMouseEnter={() => setInputHover("newEventDesc", true)}
                    onMouseLeave={() => setInputHover("newEventDesc", false)}
                    style={inputStyle(!!focusedInputs["newEventDesc"], !!hoveredInputs["newEventDesc"])}
                    placeholder="e.g. Independence Day"
                    className="block w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 font-semibold"
                  />
                </div>

                {/* Conditional override day selector (For working day overrides) */}
                {newEventType === "working_day_override" && (
                  <div className="space-y-1.5 md:col-span-2 lg:col-span-3 animate-scale-in">
                    <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest block">Target timetable scheduling day</label>
                    <select
                      required
                      value={newEventOverrideDay}
                      onChange={(e) => setNewEventOverrideDay(e.target.value === "" ? "" : Number(e.target.value))}
                      className="block w-full max-w-xs rounded-xl border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-450 shadow-sm cursor-pointer"
                    >
                      <option value="">Select target day...</option>
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={day} value={idx}>Acts as {day} Timetable</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <motion.button
                  type="submit"
                  disabled={saving || (newEventType === "working_day_override" && newEventOverrideDay === "")}
                  whileHover={!(saving || (newEventType === "working_day_override" && newEventOverrideDay === "")) ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" } : undefined}
                  whileTap={!(saving || (newEventType === "working_day_override" && newEventOverrideDay === "")) ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" } : undefined}
                  transition={{ duration: 0.16 }}
                  className="rounded-xl bg-zinc-900 h-10 px-5 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50 select-none"
                >
                  {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
                  <span>Add Calendar Exception</span>
                </motion.button>
              </div>
            </form>

            {/* AI Calendar Exception Merge Confirmation overlay Modal dialog */}
            {showCalendarMergeConfirm && (
              <>
                <div className="fixed inset-0 z-40 bg-zinc-950/20 backdrop-blur-[3px]" onClick={() => setShowCalendarMergeConfirm(false)} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-md w-full bg-white border border-zinc-200/50 rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-6 text-[#0f172a] animate-scale-in">
                  <div className="space-y-2">
                    <h3 className="text-base font-black text-zinc-800">Confirm Parsed Events ({pendingEvents.length})</h3>
                    <p className="text-[12.5px] text-zinc-500 font-semibold leading-relaxed">
                      Below is the list of calendar exceptions found in your document. Click proceed to merge these dates into your academic timetable exceptions list.
                    </p>
                  </div>

                  <div className="rounded-xl border border-zinc-200 p-4.5 bg-zinc-50/50 max-h-52 overflow-y-auto space-y-2.5">
                    {pendingEvents.map((ev, idx) => (
                      <div key={idx} className="flex justify-between items-center text-[11px] font-bold border-b border-zinc-100 pb-1.5 last:border-0 last:pb-0 text-zinc-700">
                        <span>{ev.title}</span>
                        <span className="text-zinc-500 font-mono">{ev.date}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-end space-x-3 pt-2">
                    <button
                      onClick={() => setShowCalendarMergeConfirm(false)}
                      className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-650 hover:bg-zinc-50 cursor-pointer transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmCalendarMerge}
                      className="rounded-xl bg-zinc-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer shadow-sm"
                    >
                      Proceed & Merge
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

      </main>
    </div>
  );
};

export default ManageSetup;
