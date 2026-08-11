import api from "./api";

export interface Subject {
  id: number;
  semester_id: number;
  name: string;
  code?: string;
  faculty?: string;
  min_attendance_percent: number;
  units_per_class: number;
  units_earned_per_class: number;
  units_lost_per_class: number;
  track_attendance: boolean;
  active_from?: string;
  active_until?: string;
}

export const subjectService = {
  async list(semesterId: number, inTimetableOnly?: boolean): Promise<Subject[]> {
    const response = await api.get(`/semesters/${semesterId}/subjects`, {
      params: inTimetableOnly ? { in_timetable_only: true } : undefined,
    });
    return response.data;
  },


  async create(semesterId: number, data: { name: string; code?: string; faculty?: string; min_attendance_percent: number; units_per_class?: number; units_earned_per_class?: number; units_lost_per_class?: number; track_attendance?: boolean; active_from?: string; active_until?: string }): Promise<Subject> {
    const response = await api.post(`/semesters/${semesterId}/subjects`, data);
    return response.data;
  },

  async update(semesterId: number, subjectId: number, data: Partial<Subject>): Promise<Subject> {
    const response = await api.put(`/semesters/${semesterId}/subjects/${subjectId}`, data);
    return response.data;
  },

  async syncAttendance(semesterId: number, subjectId: number, data: { attended: number; missed: number; delivered: number }): Promise<Subject> {
    const response = await api.put(`/semesters/${semesterId}/subjects/${subjectId}/sync-attendance`, data);
    return response.data;
  },

  async delete(semesterId: number, subjectId: number): Promise<void> {
    await api.delete(`/semesters/${semesterId}/subjects/${subjectId}`);
  },
};
