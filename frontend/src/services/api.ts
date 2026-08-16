import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

const api = axios.create({
  baseURL: API_URL,
  timeout: 15000, // 15s timeout to handle Render cold starts gracefully
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to attach JWT token and log diagnostic info
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    console.debug(`[API Request] ${config.method?.toUpperCase()} ${config.url} (Token: ${token ? "Present" : "Missing"})`);
    return config;
  },
  (error) => {
    console.error("[API Request Error]", error);
    return Promise.reject(error);
  }
);

// Response interceptor to handle token expiry vs server/network failures
api.interceptors.response.use(
  (response) => {
    console.debug(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url} -> ${response.status}`);
    return response;
  },
  (error) => {
    const status = error.response ? error.response.status : "NETWORK/TIMEOUT_ERROR";
    const url = error.config ? error.config.url : "unknown_url";
    console.error(`[API Error] ${url} -> Status: ${status}`, error.response?.data || error.message);

    // ONLY clear stored JWT token on an explicit HTTP 401 Unauthorized
    if (error.response && error.response.status === 401) {
      console.warn("[API Auth] Explicit 401 Unauthorized detected - removing stored token.");
      localStorage.removeItem("token");
    }
    return Promise.reject(error);
  }
);

export default api;
