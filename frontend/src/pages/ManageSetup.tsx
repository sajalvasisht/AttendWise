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
} from "lucide-react";

import { aiService } from "../services/ai";

const DAYS_OF_WEEK = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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
  const [newSubjEarned, setNewSubjEarned] = useState(1);
  const [newSubjLost, setNewSubjLost] = useState(1);

  // Timetable form states (For adding)
  const [newSlotDay, setNewSlotDay] = useState(0);
  const [newSlotSubjId, setNewSlotSubjId] = useState<number | "">("");
  const [newSlotStart, setNewSlotStart] = useState("09:00");
  const [newSlotEnd, setNewSlotEnd] = useState("10:00");

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
      const subjs = await subjectService.list(active.id);
      setSubjects(subjs);

      const slots = await timetableService.list(active.id);
      setTimetableSlots(slots);

      const events = await calendarService.list(active.id);
      setCalendarEvents(events);
    } catch (err: any) {
      console.error(err);
      setError("Failed to load semester setup data.");
    } finally {
      setLoading(false);
    }
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
      await subjectService.create(activeSem.id, {
        name: newSubjName,
        code: newSubjCode || undefined,
        faculty: newSubjFaculty || undefined,
        min_attendance_percent: newSubjMinAtt,
        units_earned_per_class: newSubjEarned,
        units_lost_per_class: newSubjLost,
      });
      setNewSubjName("");
      setNewSubjCode("");
      setNewSubjFaculty("");
      setNewSubjMinAtt(75);
      setNewSubjEarned(1);
      setNewSubjLost(1);
      setSuccess("Subject added successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSubject = async () => {
    if (!activeSem || subjectToDelete === null) return;
    setSaving(true);
    setError(null);
    try {
      await subjectService.delete(activeSem.id, subjectToDelete);
      setSubjectToDelete(null);
      setSuccess("Subject deleted successfully. Future calendar slots updated.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete subject.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddTimetableSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem || !newSlotSubjId) return;

    setSaving(true);
    setError(null);
    try {
      const payload = timetableSlots.map(s => ({
        subject_id: s.subject_id,
        day_of_week: s.day_of_week,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5)
      }));

      // Append new slot
      payload.push({
        subject_id: Number(newSlotSubjId),
        day_of_week: newSlotDay,
        start_time: newSlotStart,
        end_time: newSlotEnd
      });

      await timetableService.save(activeSem.id, payload, "replace");
      setSuccess("Timetable updated successfully. Occurrences regenerated.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to save slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTimetableSlot = async (slotId: number) => {
    if (!activeSem) return;
    if (!confirm("Are you sure you want to remove this slot from your timetable?")) return;

    setSaving(true);
    setError(null);
    try {
      const updated = timetableSlots.filter(s => s.id !== slotId).map(s => ({
        subject_id: s.subject_id,
        day_of_week: s.day_of_week,
        start_time: s.start_time.slice(0, 5),
        end_time: s.end_time.slice(0, 5)
      }));

      await timetableService.save(activeSem.id, updated, "replace");
      setSuccess("Slot deleted successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete slot.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSem || !newEventDate) return;

    setSaving(true);
    setError(null);
    try {
      const payload = calendarEvents.map(ev => ({
        date: ev.date,
        event_type: ev.event_type,
        description: ev.description || "",
        timetable_day_override: ev.timetable_day_override
      }));

      // Append new event
      payload.push({
        date: newEventDate,
        event_type: newEventType,
        description: newEventDesc || "Holiday / Event Override",
        timetable_day_override: newEventOverrideDay !== "" ? Number(newEventOverrideDay) : undefined
      });

      await calendarService.save(activeSem.id, payload, "replace");
      setNewEventDate("");
      setNewEventDesc("");
      setNewEventOverrideDay("");
      setSuccess("Calendar exception saved successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to add calendar event.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteCalendarEvent = async (eventId: number) => {
    if (!activeSem) return;
    if (!confirm("Are you sure you want to delete this calendar exception?")) return;

    setSaving(true);
    setError(null);
    try {
      const updated = calendarEvents.filter(ev => ev.id !== eventId).map(ev => ({
        date: ev.date,
        event_type: ev.event_type,
        description: ev.description || "",
        timetable_day_override: ev.timetable_day_override
      }));

      await calendarService.save(activeSem.id, updated, "replace");
      setSuccess("Calendar exception removed successfully.");
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete calendar event.");
    } finally {
      setSaving(false);
    }
  };

  const toggleWorkingDay = (dayIdx: number) => {
    setWorkingDays(prev => 
      prev.includes(dayIdx) ? prev.filter(d => d !== dayIdx) : [...prev, dayIdx].sort()
    );
  };

  const handleTimetableAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSem || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setError(null);
    setTimetableLoading(true);

    try {
      const response = await aiService.extractTimetable(file);
      
      const mappedSlots = response.timetable_slots.map(slot => {
        const matched = subjects.find(s => 
          s.name.toLowerCase() === slot.subject_name.toLowerCase() ||
          (slot.subject_code && s.code && s.code.toLowerCase() === slot.subject_code.toLowerCase())
        );
        
        if (!matched) {
          throw new Error(`Subject "${slot.subject_name}" in the uploaded timetable does not exist. Please add this subject first under the "Subjects & Units" tab.`);
        }
        
        return {
          subject_id: matched.id,
          day_of_week: slot.day_of_week,
          start_time: slot.start_time.slice(0, 5),
          end_time: slot.end_time.slice(0, 5)
        };
      });

      if (timetableSlots.length > 0) {
        setPendingSlots(mappedSlots);
        setShowTimetableMergeConfirm(true);
      } else {
        await timetableService.save(activeSem.id, mappedSlots, "replace");
        setSuccess("Timetable slots imported successfully.");
        setTimeout(() => setSuccess(null), 3000);
        await loadSemesterDetails();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to extract timetable slots.");
    } finally {
      setTimetableLoading(false);
      e.target.value = "";
    }
  };

  const confirmTimetableImport = async (mode: "replace" | "merge") => {
    if (!activeSem) return;
    setSaving(true);
    setError(null);
    setShowTimetableMergeConfirm(false);
    try {
      await timetableService.save(activeSem.id, pendingSlots, mode);
      setPendingSlots([]);
      setSuccess(`Timetable slots successfully ${mode === "replace" ? "replaced" : "merged"}.`);
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to import timetable slots.");
    } finally {
      setSaving(false);
    }
  };

  const handleCalendarAIUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeSem || !e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setError(null);
    setCalendarLoading(true);

    try {
      const response = await aiService.extractCalendar(file);
      
      const mappedEvents = response.events.map(ev => {
        let mappedType = "holiday";
        const cat = ev.category.toLowerCase();
        if (cat.includes("holiday")) mappedType = "holiday";
        else if (cat.includes("closure") || cat.includes("closed")) mappedType = "college_closure";
        else if (cat.includes("override")) mappedType = "working_day_override";
        else if (cat.includes("assessment")) mappedType = "exam_day";
        else if (cat.includes("break")) mappedType = "exam_break";
        
        let mappedSubjId: number | undefined = undefined;
        if (ev.subject_name || ev.subject_code) {
          const matched = subjects.find(s => 
            (ev.subject_name && s.name.toLowerCase() === ev.subject_name.toLowerCase()) ||
            (ev.subject_code && s.code && s.code.toLowerCase() === ev.subject_code.toLowerCase())
          );
          if (matched) mappedSubjId = matched.id;
        }

        return {
          date: ev.date,
          event_type: mappedType,
          description: ev.description || ev.title,
          timetable_day_override: ev.timetable_day_override !== undefined ? ev.timetable_day_override : undefined,
          subject_id: mappedSubjId,
          start_time: ev.start_time || undefined,
          end_time: ev.end_time || undefined
        };
      });

      if (calendarEvents.length > 0) {
        setPendingEvents(mappedEvents);
        setShowCalendarMergeConfirm(true);
      } else {
        await calendarService.save(activeSem.id, mappedEvents, "replace");
        setSuccess("Calendar exceptions imported successfully.");
        setTimeout(() => setSuccess(null), 3000);
        await loadSemesterDetails();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to extract calendar exceptions.");
    } finally {
      setCalendarLoading(false);
      e.target.value = "";
    }
  };

  const confirmCalendarImport = async (mode: "replace" | "merge") => {
    if (!activeSem) return;
    setSaving(true);
    setError(null);
    setShowCalendarMergeConfirm(false);
    try {
      await calendarService.save(activeSem.id, pendingEvents, mode);
      setPendingEvents([]);
      setSuccess(`Calendar exceptions successfully ${mode === "replace" ? "replaced" : "merged"}.`);
      setTimeout(() => setSuccess(null), 3000);
      await loadSemesterDetails();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to import calendar exceptions.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col font-sans">
        <Navbar />
        <div className="flex-1 flex flex-col justify-center items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground font-semibold">Loading semester configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
        {/* Header Title */}
        <div className="flex items-center justify-between border-b border-zinc-200/80 pb-5">
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-zinc-950">Manage Semester Setup</h1>
            <p className="text-xs text-zinc-500 font-medium">Edit term details, subject credits, timetables, and calendars at any time.</p>
          </div>
          <button 
            onClick={() => navigate("/settings")}
            className="text-[10px] font-bold text-zinc-700 border border-zinc-200 bg-white hover:bg-zinc-50 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
          >
            Back to Settings
          </button>
        </div>

        {/* Global Success / Error alert boxes */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 flex items-start space-x-2.5 leading-relaxed font-semibold animate-scale-in">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-700 flex items-start space-x-2.5 leading-relaxed font-semibold animate-scale-in">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 mt-0.5" />
            <span>{success}</span>
          </div>
        )}

        {/* Dynamic Tab Navigation Buttons */}
        <div className="flex border-b border-zinc-200/80 pb-px space-x-6 text-xs font-semibold select-none">
          {[
            { id: "semester", label: "Semester Info", icon: Layers },
            { id: "subjects", label: "Subjects & Units", icon: Bookmark },
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
                className={`flex items-center space-x-2 pb-3 transition-colors cursor-pointer border-b-2 ${
                  isCurrent 
                    ? "border-zinc-950 text-zinc-950 font-bold" 
                    : "border-transparent text-zinc-400 hover:text-zinc-600"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* TAB 1: SEMESTER INFO EDIT */}
        {activeTab === "semester" && (
          <form onSubmit={handleUpdateSemester} className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm space-y-6 animate-scale-in">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Semester Name</label>
                <input
                  type="text"
                  required
                  value={semName}
                  onChange={(e) => setSemName(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Start Date</label>
                <input
                  type="date"
                  required
                  value={semStart}
                  onChange={(e) => setSemStart(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">End Date</label>
                <input
                  type="date"
                  required
                  value={semEnd}
                  onChange={(e) => setSemEnd(e.target.value)}
                  className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                />
              </div>
            </div>

            {/* Working Days Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Weekly Working Days</label>
              <div className="flex flex-wrap gap-2">
                {DAYS_OF_WEEK.map((day, idx) => {
                  const active = workingDays.includes(idx);
                  return (
                    <button
                      type="button"
                      key={day}
                      onClick={() => toggleWorkingDay(idx)}
                      className={`text-xs font-semibold py-1.5 px-3.5 rounded-lg border transition-colors cursor-pointer ${
                        active
                          ? "bg-zinc-950 border-zinc-950 text-white"
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
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-zinc-900 py-2 px-5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Save Semester Details</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB 2: SUBJECTS & ATTENDANCE UNIT CONFIGURATION */}
        {activeTab === "subjects" && (
          <div className="space-y-6 animate-scale-in">
            {/* List of current subjects */}
            <div className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Current Subjects ({subjects.length})</h3>
              
              {subjects.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 italic">No subjects configured.</div>
              ) : (
                <div className="divide-y divide-zinc-100">
                  {subjects.map((subj) => (
                    <div key={subj.id} className="py-4.5 flex justify-between items-start gap-4 first:pt-0 last:pb-0">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-bold text-zinc-800">{subj.name}</h4>
                          {subj.code && (
                            <span className="text-[10px] bg-zinc-100 border border-zinc-200 text-zinc-500 px-2 py-0.2 rounded font-mono uppercase font-semibold">
                              {subj.code}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400">
                          {subj.faculty ? `Faculty: ${subj.faculty} | ` : ""}
                          Required: <span className="font-semibold text-zinc-700">{subj.min_attendance_percent}%</span>
                        </p>
                        <div className="flex items-center space-x-3 text-[10px] text-zinc-500 font-semibold pt-1">
                          <span className="bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-100">
                            Earned per class: {subj.units_earned_per_class || 1} unit(s)
                          </span>
                          <span className="bg-red-50 text-red-700 px-2 py-0.5 rounded border border-red-100">
                            Lost per class: {subj.units_lost_per_class || 1} unit(s)
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => setSubjectToDelete(subj.id)}
                        className="p-2 rounded-lg border border-red-100 bg-red-50/50 hover:bg-red-50 text-red-500 hover:text-red-700 transition-colors cursor-pointer"
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
            <form onSubmit={handleAddSubject} className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center space-x-2">
                <Plus className="h-4 w-4 text-zinc-400" />
                <span>Add New Subject</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Subject Name</label>
                  <input
                    type="text"
                    required
                    value={newSubjName}
                    onChange={(e) => setNewSubjName(e.target.value)}
                    placeholder="e.g. Operating Systems"
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Subject Code</label>
                  <input
                    type="text"
                    value={newSubjCode}
                    onChange={(e) => setNewSubjCode(e.target.value)}
                    placeholder="e.g. CS-302"
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Faculty Name</label>
                  <input
                    type="text"
                    value={newSubjFaculty}
                    onChange={(e) => setNewSubjFaculty(e.target.value)}
                    placeholder="e.g. Dr. Jane Smith"
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Min Required Target (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    required
                    value={newSubjMinAtt}
                    onChange={(e) => setNewSubjMinAtt(Number(e.target.value))}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                {/* Units Configurations */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Units Earned (When Attended)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newSubjEarned}
                    onChange={(e) => setNewSubjEarned(Number(e.target.value))}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Units Lost (When Missed)</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={newSubjLost}
                    onChange={(e) => setNewSubjLost(Number(e.target.value))}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-zinc-900 py-2 px-5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Add Subject</span>
                </button>
              </div>
            </form>

            {/* Subject Delete Confirmation Dialog Modal */}
            {subjectToDelete !== null && (
              <>
                <div className="fixed inset-0 z-40 bg-zinc-950/60 backdrop-blur-sm" onClick={() => setSubjectToDelete(null)} />
                <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 max-w-sm w-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl space-y-5 animate-scale-in text-zinc-800">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-500 border border-red-100 mx-auto">
                    <AlertTriangle className="h-5.5 w-5.5" />
                  </div>
                  <div className="space-y-2 text-center">
                    <h3 className="text-sm font-bold text-zinc-900">Delete Subject Confirmation</h3>
                    <p className="text-xs text-zinc-500 leading-relaxed">
                      Removing this subject will delete its timetable slots and unmarked occurrences calendar-wide. This action is destructive and cannot be undone.
                    </p>
                  </div>
                  <div className="flex space-x-3.5">
                    <button
                      onClick={() => setSubjectToDelete(null)}
                      className="flex-1 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 py-2.5 text-xs font-bold text-zinc-700 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDeleteSubject}
                      disabled={saving}
                      className="flex-1 rounded-xl bg-red-600 hover:bg-red-700 py-2.5 text-xs font-bold text-white flex justify-center items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                      <span>Delete Subject</span>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* TAB 3: WEEKLY TIMETABLE SLOTS */}
        {activeTab === "timetable" && (
          <div className="space-y-6 animate-scale-in">
            {/* AI Timetable Upload Area */}
            <div className="border border-zinc-200/60 bg-white rounded-xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  AI Timetable Import
                  <span className="text-[9px] bg-zinc-900 text-white px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider">
                    Gemini
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">Upload your college timetable PDF or screenshot to extract and pre-fill your schedule slots.</p>
              </div>

              {timetableLoading ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-3">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-400 font-medium">Gemini is extracting timetable details...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept="application/pdf, image/*"
                    onChange={handleTimetableAIUpload}
                    className="block w-full text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-zinc-200 file:text-xs file:font-semibold file:bg-white file:text-zinc-700 hover:file:bg-zinc-50 cursor-pointer file:cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* List of slots */}
            <div className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Weekly Timetable Schedule Slots</h3>
              
              {timetableSlots.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 italic">No scheduled timetable slots. Add a slot below to begin.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs divide-y divide-zinc-200">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Weekday</th>
                        <th className="py-3 px-2">Subject</th>
                        <th className="py-3 px-2">Timings</th>
                        <th className="py-3 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {timetableSlots
                        .sort((a, b) => a.day_of_week - b.day_of_week || a.start_time.localeCompare(b.start_time))
                        .map((slot) => {
                          const matchedSubj = subjects.find(s => s.id === slot.subject_id);
                          return (
                            <tr key={slot.id} className="hover:bg-zinc-50/50">
                              <td className="py-3.5 px-2 font-semibold text-zinc-800">{DAYS_OF_WEEK[slot.day_of_week]}</td>
                              <td className="py-3.5 px-2 font-medium">{matchedSubj ? matchedSubj.name : `Subject #${slot.subject_id}`}</td>
                              <td className="py-3.5 px-2 font-mono text-[11px] text-zinc-500">{slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}</td>
                              <td className="py-3.5 px-2 text-right">
                                <button
                                  onClick={() => handleDeleteTimetableSlot(slot.id)}
                                  className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded hover:bg-red-50 cursor-pointer inline-block"
                                  title="Delete Slot"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Form to add a slot */}
            <form onSubmit={handleAddTimetableSlot} className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center space-x-2">
                <Plus className="h-4 w-4 text-zinc-400" />
                <span>Add Timetable Slot</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Subject</label>
                  <select
                    required
                    value={newSlotSubjId}
                    onChange={(e) => setNewSlotSubjId(e.target.value !== "" ? Number(e.target.value) : "")}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  >
                    <option value="">Select subject...</option>
                    {subjects.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.code || "No Code"})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Day of Week</label>
                  <select
                    required
                    value={newSlotDay}
                    onChange={(e) => setNewSlotDay(Number(e.target.value))}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  >
                    {DAYS_OF_WEEK.map((day, idx) => (
                      <option key={day} value={idx}>{day}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Start Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotStart}
                    onChange={(e) => setNewSlotStart(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">End Time</label>
                  <input
                    type="time"
                    required
                    value={newSlotEnd}
                    onChange={(e) => setNewSlotEnd(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || newSlotSubjId === ""}
                  className="rounded-lg bg-zinc-900 py-2 px-5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Timetable Slot</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 4: CALENDAR EXCEPTIONS & OVERRIDES */}
        {activeTab === "calendar" && (
          <div className="space-y-6 animate-scale-in">
            {/* AI Calendar Upload Area */}
            <div className="border border-zinc-200/60 bg-white rounded-xl p-6 shadow-sm space-y-4">
              <div className="space-y-1">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  AI Calendar Import
                  <span className="text-[9px] bg-zinc-900 text-white px-1.5 py-0.2 rounded font-semibold uppercase tracking-wider">
                    Gemini
                  </span>
                </h3>
                <p className="text-xs text-zinc-400">Upload your academic calendar PDF or screenshot to extract holidays and exams automatically.</p>
              </div>

              {calendarLoading ? (
                <div className="flex flex-col items-center justify-center py-4 space-y-3">
                  <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  <span className="text-xs text-zinc-400 font-medium">Gemini is extracting calendar events...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-4">
                  <input
                    type="file"
                    accept="application/pdf, image/*"
                    onChange={handleCalendarAIUpload}
                    className="block w-full text-xs text-zinc-400 file:mr-4 file:py-1.5 file:px-3 file:rounded-md file:border file:border-zinc-200 file:text-xs file:font-semibold file:bg-white file:text-zinc-700 hover:file:bg-zinc-50 cursor-pointer file:cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* List of exceptions */}
            <div className="bg-white border border-zinc-200/60 rounded-xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Holidays, Closure Overrides, and Exams</h3>
              
              {calendarEvents.length === 0 ? (
                <div className="text-center py-6 text-xs text-zinc-400 italic">No calendar exceptions configured. Add a holiday below to pre-populate.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs divide-y divide-zinc-200">
                    <thead>
                      <tr className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">
                        <th className="py-3 px-2">Date</th>
                        <th className="py-3 px-2">Type</th>
                        <th className="py-3 px-2">Description</th>
                        <th className="py-3 px-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 text-zinc-700">
                      {calendarEvents
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((ev) => (
                          <tr key={ev.id} className="hover:bg-zinc-50/50">
                            <td className="py-3.5 px-2 font-mono font-semibold text-zinc-800">{ev.date}</td>
                            <td className="py-3.5 px-2 uppercase tracking-wide text-[9px] font-bold">
                              <span className={`px-2 py-0.5 rounded ${
                                ev.event_type === "holiday" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" :
                                ev.event_type === "exam_day" || ev.event_type === "exam" ? "bg-amber-50 text-amber-700 border border-amber-100" :
                                "bg-zinc-100 text-zinc-600 border border-zinc-200"
                              }`}>
                                {ev.event_type.replace("_", " ")}
                              </span>
                            </td>
                            <td className="py-3.5 px-2 font-medium">{ev.description || "Holiday"}</td>
                            <td className="py-3.5 px-2 text-right">
                              <button
                                onClick={() => handleDeleteCalendarEvent(ev.id)}
                                className="text-red-500 hover:text-red-700 transition-colors p-1.5 rounded hover:bg-red-50 cursor-pointer inline-block"
                                title="Delete Exception"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Form to add an exception */}
            <form onSubmit={handleAddCalendarEvent} className="bg-white border border-zinc-200/60 rounded-xl p-6 shadow-sm space-y-5">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider flex items-center space-x-2">
                <Plus className="h-4 w-4 text-zinc-400" />
                <span>Add Calendar Exception</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Date</label>
                  <input
                    type="date"
                    required
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Exception Type</label>
                  <select
                    required
                    value={newEventType}
                    onChange={(e) => setNewEventType(e.target.value)}
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  >
                    <option value="holiday">Holiday</option>
                    <option value="college_closure">College Closure</option>
                    <option value="exam_break">Exam Break</option>
                    <option value="exam_day">Exam Day</option>
                    <option value="working_day_override">Working Day Override</option>
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Description / Notes</label>
                  <input
                    type="text"
                    required
                    value={newEventDesc}
                    onChange={(e) => setNewEventDesc(e.target.value)}
                    placeholder="e.g. Independence Day Break"
                    className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                  />
                </div>

                {newEventType === "working_day_override" && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Timetable Day Override</label>
                    <select
                      required
                      value={newEventOverrideDay}
                      onChange={(e) => setNewEventOverrideDay(e.target.value !== "" ? Number(e.target.value) : "")}
                      className="block w-full rounded-lg border border-zinc-200 bg-white py-2 px-3 text-xs text-zinc-800 outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400"
                    >
                      <option value="">Select weekday schedule to run...</option>
                      {DAYS_OF_WEEK.map((day, idx) => (
                        <option key={day} value={idx}>{day}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="border-t border-zinc-100 pt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={saving || !newEventDate}
                  className="rounded-lg bg-zinc-900 py-2 px-5 text-xs font-bold text-white hover:bg-zinc-800 transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>Save Calendar Exception</span>
                </button>
              </div>
            </form>
          </div>
        )}
      {/* CONFIRM TIMETABLE MERGE OR REPLACE DIALOG */}
      {showTimetableMergeConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-6 text-zinc-800">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-zinc-900">Import Timetable Slots?</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We extracted {pendingSlots.length} timetable slots from your file. How would you like to save these to your semester timetable?
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => confirmTimetableImport("replace")}
                disabled={saving}
                className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 py-2.5 text-xs font-bold text-white transition-all cursor-pointer text-center flex justify-center items-center space-x-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Replace Entire Timetable (Overwrite existing slots)</span>
              </button>
              <button
                onClick={() => confirmTimetableImport("merge")}
                disabled={saving}
                className="w-full rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 py-2.5 text-xs font-bold text-zinc-700 transition-all cursor-pointer text-center flex justify-center items-center space-x-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Merge (Only append new slots)</span>
              </button>
              <button
                onClick={() => {
                  setPendingSlots([]);
                  setShowTimetableMergeConfirm(false);
                }}
                className="w-full rounded-xl border border-transparent bg-transparent py-2.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-50 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM CALENDAR MERGE OR REPLACE DIALOG */}
      {showCalendarMergeConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/60 backdrop-blur-sm flex items-center justify-center p-6 text-zinc-800">
          <div className="max-w-md w-full bg-white border border-zinc-200 rounded-2xl p-6 shadow-2xl space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-zinc-900">Import Calendar Exceptions?</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              We extracted {pendingEvents.length} calendar exceptions. How would you like to save these to your academic calendar?
            </p>
            <div className="flex flex-col space-y-2">
              <button
                onClick={() => confirmCalendarImport("replace")}
                disabled={saving}
                className="w-full rounded-xl bg-zinc-900 hover:bg-zinc-800 py-2.5 text-xs font-bold text-white transition-all cursor-pointer text-center flex justify-center items-center space-x-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Replace Entire Calendar (Overwrite existing exceptions)</span>
              </button>
              <button
                onClick={() => confirmCalendarImport("merge")}
                disabled={saving}
                className="w-full rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 py-2.5 text-xs font-bold text-zinc-700 transition-all cursor-pointer text-center flex justify-center items-center space-x-1.5"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Merge (Only append new exceptions)</span>
              </button>
              <button
                onClick={() => {
                  setPendingEvents([]);
                  setShowCalendarMergeConfirm(false);
                }}
                className="w-full rounded-xl border border-transparent bg-transparent py-2.5 text-xs font-semibold text-zinc-400 hover:bg-zinc-50 transition-all cursor-pointer text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
};

export default ManageSetup;
