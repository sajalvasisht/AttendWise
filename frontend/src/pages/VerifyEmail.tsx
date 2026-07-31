import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, ArrowRight } from "lucide-react";

const VerifyEmail: React.FC = () => {
  const [searchParams] = useSearchParams();
  const [verifying, setVerifying] = useState(true);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get("token");

  useEffect(() => {
    const performVerification = async () => {
      if (!token) {
        setError("No verification token found in URL.");
        setVerifying(false);
        return;
      }

      try {
        await authService.verifyEmail(token);
        setSuccess(true);
      } catch (err: any) {
        console.error(err);
        setError(err.response?.data?.detail || "Verification failed. The token may be invalid or expired.");
      } finally {
        setVerifying(false);
      }
    };

    performVerification();
  }, [token]);

  return (
    <>
      {/* Typographic Header */}
      <div className="space-y-2.5">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 font-sans">Account Verification</h2>
        <p className="text-xs text-zinc-400 font-medium">Activate your AttendWise account.</p>
      </div>

      <div className="space-y-6">
        {verifying ? (
          <div className="space-y-4 py-8 flex flex-col items-center justify-center animate-pulse">
            <Loader2 className="h-7 w-7 animate-spin text-zinc-400" />
            <p className="text-xs text-zinc-500 font-semibold">Verifying email authenticity...</p>
          </div>
        ) : success ? (
          <div className="space-y-4 py-4 text-center animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <span className="text-xl">✓</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-zinc-900">Email Verified Successfully</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Your account is now activated. You can sign in using your email and password.
              </p>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm transition-all space-x-1.5"
            >
              <span>Continue to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-4 text-center animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-600">
              <span className="text-xl">✕</span>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-red-600">Verification Failed</h3>
              <p className="text-xs text-zinc-500 leading-relaxed">
                {error}
              </p>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 shadow-sm transition-all space-x-1.5"
            >
              <span>Back to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>
    </>
  );
};

export default VerifyEmail;
