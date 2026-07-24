import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, KeyRound, CheckCircle2, ArrowRight } from "lucide-react";

const ResetPassword: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError("Verification token missing. Please use the link sent to your email.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await authService.resetPassword(token, newPassword);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.detail || "Failed to reset password. The link may have expired.");
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
          <h1 className="text-xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-xs text-muted-foreground">
            Enter your new secure password below to activate your account access.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 py-4 text-center animate-scale-in">
            <div className="mx-auto h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-foreground">Password Reset Successfully</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your credentials have been updated. You can now login with your new password.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 transition-all space-x-1.5"
            >
              <span>Go to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-destructive/15 bg-destructive/5 p-3 text-xs text-destructive">
                <span>{error}</span>
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background py-2 pl-10 pr-3 text-xs text-foreground outline-none focus:border-foreground/20 focus:ring-1 focus:ring-foreground/5 transition-all"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Confirm New Password
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground/60" />
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
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
                  <span>Saving credentials...</span>
                </>
              ) : (
                <span>Change Password</span>
              )}
            </button>
          </form>
        )}

      </div>
    </div>
  );
};

export default ResetPassword;
