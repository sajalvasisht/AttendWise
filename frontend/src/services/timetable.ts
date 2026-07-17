import api from "./api";

export interface TimetableSlot {
  id: number;
  semester_id: number;
  subject_id: number;
  day_of_week: number; // 0=Monday, 6=Sunday
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
}

export const timetableService = {
  async list(semesterId: number): Promise<TimetableSlot[]> {
    const response = await api.get(`/semesters/${semesterId}/timetable`);
    return response.data;
  },

  async save(semesterId: number, slots: Omit<TimetableSlot, "id" | "semester_id">[]): Promise<TimetableSlot[]> {
    const response = await api.post(`/semesters/${semesterId}/timetable`, slots);
    return response.data;
  },
};
