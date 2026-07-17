import api from "./api";

export interface Semester {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  working_days: string;
  user_id: number;
}

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
  },
};
