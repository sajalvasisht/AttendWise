import React, { createContext, useContext, useState, useEffect } from "react";
import type { ReactNode } from "react";
import type { AuthState } from "../types";
import { authService } from "../services/auth";

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (credential: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem("token"),
    isAuthenticated: false,
    loading: true,
  });

  const loadUser = async (token: string) => {
    try {
      const user = await authService.getMe();
      setState({
        user,
        token,
        isAuthenticated: true,
        loading: false,
      });
    } catch (error) {
      localStorage.removeItem("token");
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        loading: false,
      });
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      loadUser(token);
    } else {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const login = async (email: string, password: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await authService.login(email, password);
      localStorage.setItem("token", data.access_token);
      await loadUser(data.access_token);
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const loginWithGoogle = async (credential: string) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      const data = await authService.googleLogin(credential);
      localStorage.setItem("token", data.access_token);
      await loadUser(data.access_token);
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const register = async (userData: any) => {
    setState((prev) => ({ ...prev, loading: true }));
    try {
      await authService.register(userData);
      setState((prev) => ({ ...prev, loading: false }));
    } catch (error) {
      setState((prev) => ({ ...prev, loading: false }));
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem("token");
    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      loading: false,
    });
  };

  return (
    <AuthContext.Provider value={{ ...state, login, loginWithGoogle, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
