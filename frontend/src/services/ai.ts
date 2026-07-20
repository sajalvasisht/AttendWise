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

export interface ExtractedCalendarEvent {
  title: string;
  category: string;
  schedule_effect: string;
  date: string;
  end_date?: string;
  subject_name?: string;
  subject_code?: string;
  start_time?: string;
  end_time?: string;
  description?: string;
  timetable_day_override?: number;
}

export interface ExtractedCalendarResponse {
  events: ExtractedCalendarEvent[];
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

  async extractCalendar(file: File): Promise<ExtractedCalendarResponse> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await api.post("/ai/calendar/extract", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  },

  async chatWithAssistant(message: string): Promise<ChatResponse> {
    const response = await api.post("/ai/assistant/chat", { message });
    return response.data;
  },
};

export interface ChatResponse {
  reply: string;
  intent: string;
  clarification_needed: boolean;
}
