import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, Mail, CheckCircle2, ArrowRight } from "lucide-react";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setError(null);

    try {
      await authService.forgotPassword(email);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full border border-border bg-card rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-6">
        
        {/* Header */}
        <div className="space-y-1 text-center">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">AttendWise</h2>
          <h1 className="text-xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-xs text-muted-foreground">
            Enter your email address and we'll send you a secure link to reset your password.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 py-4 text-center animate-scale-in">
            <div className="mx-auto h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-foreground">Check your inbox</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If the email exists in our system, we have sent a secure password reset link to your email.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 transition-all space-x-1.5"
            >
              <span>Back to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-3 text-xs text-destructive flex items-center space-x-2">
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <input
                  type="email"
                  required
                  placeholder="name@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-xs text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-primary py-2.5 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 focus:outline-none focus:ring-2 focus:ring-foreground/25 disabled:opacity-50 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Submitting request...</span>
                </>
              ) : (
                <span>Send Reset Link</span>
              )}
            </button>

            <div className="text-center pt-2">
              <Link to="/login" className="text-xs font-semibold text-muted-foreground hover:text-foreground">
                Cancel
              </Link>
            </div>
          </form>
        )}

      </div>
    </div>
  );
};

export default ForgotPassword;
