import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Lock, Mail, Loader2 } from "lucide-react";

const Login: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
      navigate("/dashboard");
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-12 text-foreground antialiased selection:bg-accent selection:text-foreground">
      <div className="w-full max-w-sm space-y-8">
        
        {/* Brand Logo & Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <GraduationCap className="h-5 w-5 text-foreground" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in to AttendWise
            </h2>
            <p className="text-sm text-muted-foreground">
              Keep your class attendance on track
            </p>
          </div>
        </div>

        {/* Card Form container */}
        <div className="rounded-xl border border-border bg-card p-8 shadow-[0_2px_8px_rgba(0,0,0,0.03),_0_1px_3px_rgba(0,0,0,0.02)]">
          {error && (
            <div className="mb-6 rounded-lg border border-destructive/15 bg-destructive/5 p-3.5 text-xs text-destructive font-medium leading-relaxed">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email Field */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Email
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                  placeholder="name@university.edu"
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                Password
              </label>
              <div className="relative rounded-lg">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                </div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-lg border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none transition-all focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 px-4 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-foreground/25 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          {/* Navigation link */}
          <div className="mt-6 text-center">
            <p className="text-xs text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/register" className="font-semibold text-foreground hover:underline transition-all">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
