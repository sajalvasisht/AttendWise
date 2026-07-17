import api from "./api";

export interface CalendarEvent {
  id: number;
  semester_id: number;
  date: string; // "YYYY-MM-DD"
  event_type: string; // "holiday", "working_saturday", "exam"
  description?: string;
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
