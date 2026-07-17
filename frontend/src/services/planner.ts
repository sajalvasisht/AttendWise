import api from "./api";

export interface SubjectProjection {
  subject_id: number;
  name: string;
  code?: string;
  current_percent: number;
  projected_percent: number;
  current_safe_bunks: number;
  projected_safe_bunks: number;
  is_safe: boolean;
  recovery_required: boolean;
  required_to_attend: number;
}

export interface OverallProjection {
  current_percent: number;
  projected_percent: number;
  current_safe_bunks: number;
  projected_safe_bunks: number;
}

export interface MissedLectureInfo {
  subject_name: string;
  date: string;
  start_time: string;
  end_time: string;
}

export interface SimulationResponse {
  overall: OverallProjection;
  subjects: SubjectProjection[];
  missed_lectures: MissedLectureInfo[];
  warnings: string[];
}

export interface LeaveSuggestion {
  label: string;
  start_date: string;
  end_date: string;
  dates: string[];
  missed_classes_count: number;
  projected_percent: number;
  is_safe: boolean;
}

export const plannerService = {
  async simulate(semesterId: number, dates: string[]): Promise<SimulationResponse> {
    const response = await api.post("/planner/simulate", {
      semester_id: semesterId,
      dates,
    });
    return response.data;
  },

  async getSuggestions(semesterId: number): Promise<LeaveSuggestion[]> {
    const response = await api.get("/planner/suggest", {
      params: { semester_id: semesterId },
    });
    return response.data;
  },
};
