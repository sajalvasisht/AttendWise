import React, { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, ArrowRight } from "lucide-react";

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
    <>
      {/* Typographic Header */}
      <div className="space-y-2.5">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Reset password</h2>
        <p className="text-xs text-zinc-400 font-medium">Create a new secure password for your account.</p>
      </div>

      <div className="space-y-6">
        {success ? (
          <div className="space-y-4 py-4 text-center animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <span className="text-xl">✓</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-zinc-900">Password Reset Successfully</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Your credentials have been updated. You can now login with your new password.
              </p>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm transition-all space-x-1.5"
            >
              <span>Go to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-xl border border-red-500/10 bg-red-950/5 p-4 text-xs text-red-500 leading-relaxed font-semibold animate-scale-in">
                {error}
              </div>
            )}

            {/* New Password */}
            <div className="space-y-1.5">
              <label htmlFor="newPassword" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={loading}
                className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <label htmlFor="confirmPassword" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">
                Confirm Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={loading}
                className="block w-full rounded-xl border border-zinc-200 bg-white py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-400 outline-none transition-all focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 disabled:opacity-50"
                placeholder="••••••••"
              />
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
                  <span>Change Password</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
          </form>
        )}

        {/* Switcher Footer */}
        <div className="text-center pt-4 border-t border-zinc-150/40">
          <p className="text-xs text-zinc-500 font-medium">
            Remember password?{" "}
            <Link to="/login" className="font-bold text-emerald-600 hover:underline transition-all">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  );
};

export default ResetPassword;
