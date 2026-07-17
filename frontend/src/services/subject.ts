import api from "./api";

export interface Subject {
  id: number;
  semester_id: number;
  name: string;
  code?: string;
  faculty?: string;
  min_attendance_percent: number;
}

export const subjectService = {
  async list(semesterId: number): Promise<Subject[]> {
    const response = await api.get(`/semesters/${semesterId}/subjects`);
    return response.data;
  },

  async create(semesterId: number, data: { name: string; code?: string; faculty?: string; min_attendance_percent: number }): Promise<Subject> {
    const response = await api.post(`/semesters/${semesterId}/subjects`, data);
    return response.data;
  },

  async update(semesterId: number, subjectId: number, data: Partial<Subject>): Promise<Subject> {
    const response = await api.put(`/semesters/${semesterId}/subjects/${subjectId}`, data);
    return response.data;
  },

  async delete(semesterId: number, subjectId: number): Promise<void> {
    await api.delete(`/semesters/${semesterId}/subjects/${subjectId}`);
  },
};
