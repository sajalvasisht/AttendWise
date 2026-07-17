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
  subject?: Subject;
}

export const calendarService = {
  async list(semesterId: number): Promise<CalendarEvent[]> {
    const response = await api.get(`/semesters/${semesterId}/calendar`);
    return response.data;
  },

  async save(semesterId: number, events: Omit<CalendarEvent, "id" | "semester_id">[]): Promise<CalendarEvent[]> {
    const response = await api.post(`/semesters/${semesterId}/calendar`, events);
    return response.data;
  },
};
