import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link } from "react-router-dom";
import { GraduationCap, Lock, Mail, User as UserIcon, Loader2, CheckCircle2, ArrowRight, Calendar, Compass, Sparkles, ShieldCheck } from "lucide-react";

const Register: React.FC = () => {
  const { register } = useAuth();

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      await register({
        email,
        full_name: fullName || undefined,
        password,
      });
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(
        err.response?.data?.detail || 
        "Failed to register. Please check your details and try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-background text-foreground antialiased selection:bg-accent selection:text-foreground">
      
      {/* LEFT MARKETING PANEL (Hidden on mobile) */}
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

        {/* Hero Features */}
        <div className="my-auto space-y-10 max-w-md z-10">
          <div className="space-y-4">
            <h1 className="text-3xl font-extrabold tracking-tight leading-tight text-white">
              Create an account & start planning terms.
            </h1>
            <p className="text-sm text-neutral-400 leading-relaxed">
              Define subjects, set attendance target percentages, simulate safe bunker budgets, and chat with your AI assistant.
            </p>
          </div>

          <div className="space-y-4">
            {[
              {
                icon: Calendar,
                title: "Dynamic Academic Exceptions",
                desc: "Map college closures, holiday lists, and semester exam break offsets easily."
              },
              {
                icon: Compass,
                title: "Deterministic Predictions",
                desc: "No mock calculations. Projections evaluate exact timetable schedules day-by-day."
              },
              {
                icon: Sparkles,
                title: "AI Attendance Planner",
                desc: "Evaluate safe bunks or simulated leaves using real natural language requests."
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

        {/* Bottom Footer */}
        <div className="flex items-center space-x-2 text-[10px] text-neutral-500 z-10">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Activation required to confirm email integrity.</span>
        </div>
      </div>

      {/* RIGHT SIGN UP SIDE */}
      <div className="flex flex-col items-center justify-center px-6 py-12 lg:px-20 relative">
        <div className="w-full max-w-sm space-y-8 animate-scale-in">
          
          {/* Mobile header */}
          <div className="flex flex-col items-center text-center space-y-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
              <GraduationCap className="h-5 w-5 text-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold tracking-tight">Create an account</h2>
              <p className="text-xs text-muted-foreground">Start planning your semester attendance today.</p>
            </div>
          </div>

          <div className="hidden lg:block space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight">Create Account</h2>
            <p className="text-xs text-muted-foreground">Register details to activate your term workbook.</p>
          </div>

          {/* Form wrapper */}
          {success ? (
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xl text-center space-y-5 animate-scale-in text-foreground">
              <div className="mx-auto h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-bold text-foreground">Verification email sent!</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  We sent an activation link to <span className="font-semibold text-foreground">{email}</span>. Please click the link in your inbox to verify your email address and activate your account.
                </p>
              </div>
              <Link
                to="/login"
                className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 transition-all space-x-1.5 cursor-pointer"
              >
                <span>Go to Login</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {error && (
                <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3.5 text-xs text-destructive leading-relaxed font-semibold animate-scale-in">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label htmlFor="fullName" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Full Name
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <UserIcon className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <input
                      id="fullName"
                      name="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                      placeholder="John Doe"
                    />
                  </div>
                </div>

                {/* Email Field */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Email Address
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

                {/* Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Password
                  </label>
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

                {/* Confirm Password Field */}
                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                    Confirm Password
                  </label>
                  <div className="relative rounded-lg">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                      <Lock className="h-4 w-4 text-muted-foreground/50" />
                    </div>
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="block w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground/50 outline-none transition-all focus:border-primary/40 focus:ring-1 focus:ring-primary/10"
                      placeholder="••••••••"
                    />
                  </div>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="flex w-full items-center justify-center rounded-lg bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-sm transition-all hover:bg-neutral-800 focus:outline-none disabled:opacity-50 cursor-pointer active:scale-[0.99]"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-foreground/60" />
                  ) : (
                    "Create Account"
                  )}
                </button>
              </form>

              <div className="text-center pt-2 border-t border-border/40">
                <p className="text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <Link to="/login" className="font-semibold text-foreground hover:underline transition-all">
                    Sign in
                  </Link>
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default Register;
