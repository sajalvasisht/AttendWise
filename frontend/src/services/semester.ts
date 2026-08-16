import api from "./api";

export interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  working_days: string;
  user_id: number;
  is_active: boolean;
}

export const getStoredActiveSemester = (): Semester | null => {
  try {
    const raw = localStorage.getItem("active_semester");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setStoredActiveSemester = (sem: Semester | null) => {
  try {
    if (sem) {
      localStorage.setItem("active_semester", JSON.stringify(sem));
    } else {
      localStorage.removeItem("active_semester");
    }
  } catch {}
};

export const semesterService = {
  async list(): Promise<Semester[]> {
    const response = await api.get("/semesters");
    return response.data;
  },

  async get(id: number): Promise<Semester> {
    const response = await api.get(`/semesters/${id}`);
    return response.data;
  },

  async create(data: { name: string; start_date: string; end_date: string; working_days?: string }): Promise<Semester> {
    const response = await api.post("/semesters", data);
    return response.data;
  },

  async update(id: number, data: Partial<Semester>): Promise<Semester> {
    const response = await api.put(`/semesters/${id}`, data);
    return response.data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/semesters/${id}`);
    localStorage.removeItem("active_semester");
  },
};
