import api from "./api";
import type { Subject } from "./subject";

export interface LectureOccurrence {
  id: number;
  semester_id: number;
  subject_id: number;
  date: string; // "YYYY-MM-DD"
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
  attendance_status: "unmarked" | "present" | "absent" | "cancelled";
  subject: Subject;
}

export interface OverallAttendanceStats {
  total_lectures: number;
  attended: number;
  absent: number;
  cancelled: number;
  unmarked: number;
  conducted: number;
  attendance_percent: number;
  safe_bunks_budget: number;
}

export interface SubjectAttendanceStats {
  subject_id: number;
  name: string;
  code?: string;
  faculty?: string;
  total_lectures: number;
  attended: number;
  absent: number;
  cancelled: number;
  unmarked: number;
  conducted: number;
  attendance_percent: number;
  min_attendance_percent: number;
  safe_bunks: number;
  required_to_attend: number;
}

export const attendanceService = {
  async getByDate(semesterId: number, dateStr?: string): Promise<LectureOccurrence[]> {
    const params = dateStr ? { date_query: dateStr } : {};
    const response = await api.get(`/semesters/${semesterId}/attendance`, { params });
    return response.data;
  },

  async getToday(semesterId: number): Promise<LectureOccurrence[]> {
    const response = await api.get(`/semesters/${semesterId}/attendance/today`);
    return response.data;
  },

  async updateStatus(semesterId: number, occurrenceId: number, status: "present" | "absent" | "cancelled" | "unmarked"): Promise<LectureOccurrence> {
    const response = await api.put(`/semesters/${semesterId}/attendance/${occurrenceId}`, { status });
    return response.data;
  },

  async getSummary(semesterId: number): Promise<OverallAttendanceStats> {
    const response = await api.get(`/semesters/${semesterId}/attendance/summary`);
    return response.data;
  },

  async getSubjectsAttendance(semesterId: number): Promise<SubjectAttendanceStats[]> {
    const response = await api.get(`/semesters/${semesterId}/attendance/subjects`);
    return response.data;
  },
};
