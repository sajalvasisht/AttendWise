import api from "./api";

export interface ExtractedSubject {
  name: string;
  code?: string;
  min_attendance_percent: number;
}

export interface ExtractedTimetableSlot {
  subject_name: string;
  subject_code?: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
}

export interface ExtractedTimetableResponse {
  semester_name: string;
  start_date: string;
  end_date: string;
  working_days: number[];
  subjects: ExtractedSubject[];
  timetable_slots: ExtractedTimetableSlot[];
}

export const aiService = {
  async extractTimetable(file: File): Promise<ExtractedTimetableResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/ai/timetable/extract", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },
};
