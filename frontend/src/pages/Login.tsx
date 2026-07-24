import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Lock, Mail, Loader2, Sparkles, Calendar, Compass, ShieldCheck } from "lucide-react";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import api from "../services/api";

const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectAfterLogin = async () => {
    try {
      // Check if user has an active semester
      const sems = await api.get("/semesters");
      const activeSem = sems.data.find((s: any) => s.is_active);
      if (activeSem) {
        navigate("/dashboard");
      } else {
        navigate("/welcome");
      }
    } catch (err) {
      // Fallback
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
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground antialiased selection:bg-accent selection:text-foreground">
      
      {/* LEFT MARKETING SIDEBAR (Hidden on mobile) */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-neutral-900 text-white relative overflow-hidden border-r border-border/10">
        
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-primary/10 blur-[120px] pointer-events-none" />

        {/* Top Header */}
        <div className="flex items-center space-x-2.5 z-10">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 border border-white/10 backdrop-blur-md shadow-sm">
            <GraduationCap className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-white">AttendWise</span>
        </div>

        {/* Hero Features list */}
        <div className="my-auto space-y-10 max-w-md z-10">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
              Track terms, simulate leaves, bunk with confidence.
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              AttendWise is a deterministic attendance planner built for students who want full control over their semesters.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Calendar,
                title: "Gemini Calendar & Timetable Import",
                desc: "Upload PDFs or images. Our integration extracts scheduling parameters instantly."
              },
              {
                icon: Compass,
                title: "Safe Bunk Budgeting",
                desc: "Simulate future leave dates. Forecast attendance thresholds before you bunk."
              },
              {
                icon: Sparkles,
                title: "AI Leave Assistant",
                desc: "Ask scheduling questions in natural language. Powered by deterministic checks."
              }
            ].map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div key={idx} className="flex space-x-3.5 items-start">
                  <div className="h-7 w-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white shrink-0 mt-0.5">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white">{feature.title}</h3>
                    <p className="text-[11px] text-neutral-400 mt-0.5 leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Footer info */}
        <div className="flex items-center space-x-2 text-[10px] text-neutral-500 z-10">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Secured with official Google authentication protocol.</span>
        </div>
      </div>

      {/* RIGHT LOGIN FORM SIDE */}
      <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-20 relative">
        <div className="w-full max-w-sm space-y-8 animate-scale-in">
          
          {/* Mobile logo header (Visible only on mobile) */}
          <div className="flex flex-col items-center text-center space-y-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              <GraduationCap className="h-5 w-5 text-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight">Sign in to AttendWise</h2>
              <p className="text-xs text-muted-foreground">Plan your attendance terms smarter.</p>
            </div>
          </div>

          <div className="hidden lg:block space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight">Sign In</h2>
            <p className="text-xs text-muted-foreground">Access your academic term dashboard.</p>
          </div>

          {/* Form wrapper */}
          <div className="space-y-6">
            {error && (
              <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3.5 text-xs text-destructive leading-relaxed font-semibold animate-scale-in">
                {error}
              </div>
            )}

            {/* Google Authentication Section */}
            <div className="space-y-2">
              <GoogleSignInButton 
                onSuccess={handleGoogleSuccess}
                onError={(err) => setError(err.message || "Google OAuth failed")}
              />
            </div>

            {/* divider */}
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-border/80"></div>
              <span className="flex-shrink mx-4 text-[10px] text-muted-foreground/60 uppercase font-bold tracking-wider">or use your email account</span>
              <div className="flex-grow border-t border-border/80"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                  Email
                </label>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Mail className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                    placeholder="name@university.edu"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Password
                  </label>
                  <Link to="/forgot-password" className="text-[10px] font-semibold text-primary hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <div className="relative rounded-lg">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <Lock className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-neutral-800 focus:outline-none disabled:opacity-50 cursor-pointer active:scale-[0.99]"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-foreground/60" />
                ) : (
                  "Sign In"
                )}
              </button>
            </form>

            <div className="text-center pt-2 border-t border-border/40">
              <p className="text-xs text-muted-foreground">
                Don't have an account?{" "}
                <Link to="/register" className="font-semibold text-foreground hover:underline transition-all">
                  Create Account
                </Link>
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;
