import api from "./api";

export const authService = {
  async register(data: any): Promise<any> {
    const response = await api.post("/auth/register", data);
    return response.data;
  },

  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const params = new URLSearchParams();
    params.append("username", email);
    params.append("password", password);
    const response = await api.post("/auth/login", params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
    });
    return response.data;
  },

  async getMe(): Promise<any> {
    const response = await api.get("/auth/me");
    return response.data;
  },
};
