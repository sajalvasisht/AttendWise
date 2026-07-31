import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import api from "../services/api";

const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectAfterLogin = async () => {
    try {
      const sems = await api.get("/semesters");
      const activeSem = sems.data.find((s: any) => s.is_active);
      if (activeSem) {
        navigate("/dashboard");
      } else {
        navigate("/welcome");
      }
    } catch (err) {
      navigate("/welcome");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      await redirectAfterLogin();
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Failed to log in. Please check your credentials and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credential: string) => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle(credential);
      await redirectAfterLogin();
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Google authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Typographic Header */}
      <div className="space-y-2.5">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Welcome back</h2>
        <p className="text-xs text-zinc-400 font-medium">Sign in to continue to your dashboard.</p>
      </div>

      <div className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs text-red-500 leading-relaxed font-semibold animate-scale-in">
            {error}
          </div>
        )}

        {/* Google Sign-In */}
        <div className="w-full">
          <GoogleSignInButton 
            onSuccess={handleGoogleSuccess}
            onError={(err) => setError(err.message || "Google OAuth failed")}
          />
        </div>

        {/* Divider */}
        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-zinc-200/50"></div>
          <span className="flex-shrink mx-4 text-[9px] text-zinc-400 uppercase font-bold tracking-wider">or</span>
          <div className="flex-grow border-t border-zinc-200/50"></div>
        </div>

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
              placeholder="name@university.edu"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Password
              </label>
              <Link to="/forgot-password" className="text-[10px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors">
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-3.5 pr-10 text-xs text-zinc-800 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                placeholder="Enter your password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-600 disabled:opacity-50 cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm transition-all focus:outline-none disabled:opacity-50 cursor-pointer active:scale-[0.98] duration-150 h-10"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin text-white/60" />
            ) : (
              <span className="flex items-center space-x-1.5">
                <span>Sign in</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </span>
            )}
          </button>
        </form>

        {/* Switcher Footer */}
        <div className="text-center pt-4 border-t border-zinc-150/40">
          <p className="text-xs text-zinc-500 font-medium">
            New to AttendWise?{" "}
            <Link to="/register" className="font-bold text-emerald-600 hover:underline transition-all">
              Create account
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default Login;
