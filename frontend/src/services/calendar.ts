import api from "./api";
import type { Subject } from "./subject";

export interface CalendarEvent {
  id: number;
  semester_id: number;
  date: string; // "YYYY-MM-DD"
  event_type: string; // "holiday", "working_day_override", "college_closure", "exam_break", "working_saturday", "exam", "exam_day"
  description?: string;
  timetable_day_override?: number;
  subject_id?: number;
  start_time?: string;
  end_time?: string;
  title?: string;
  category?: string;
  schedule_effect?: string;
  end_date?: string;
  subject?: Subject;
}

export const calendarService = {
  async list(semesterId: number): Promise<CalendarEvent[]> {
    const response = await api.get(`/semesters/${semesterId}/calendar`);
    return response.data;
  },

  async save(semesterId: number, events: Omit<CalendarEvent, "id" | "semester_id">[], mode: "replace" | "merge" = "replace"): Promise<CalendarEvent[]> {
    const response = await api.post(`/semesters/${semesterId}/calendar?mode=${mode}`, events);
    return response.data;
  },
};
