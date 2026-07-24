import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, CheckCircle2, XCircle, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col items-center justify-center p-6 font-sans">
      <div className="max-w-md w-full border border-border bg-card rounded-xl p-8 shadow-[0_2px_8px_rgba(0,0,0,0.02)] space-y-6 text-center">
        
        {/* Logo/Header */}
        <div className="space-y-1">
          <h2 className="text-sm font-semibold tracking-tight text-muted-foreground uppercase">AttendWise</h2>
          <h1 className="text-xl font-bold tracking-tight">Account Verification</h1>
        </div>

        {verifying ? (
          <div className="space-y-3 py-6 flex flex-col items-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground/60" />
            <p className="text-xs text-muted-foreground">Verifying email authenticity...</p>
          </div>
        ) : success ? (
          <div className="space-y-4 py-4 animate-scale-in">
            <div className="mx-auto h-11 w-11 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-foreground">Email Verified Successfully</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your account is now activated. You can sign in using your email and password.
              </p>
            </div>
            <Link
              to="/login"
              className="inline-flex w-full items-center justify-center rounded-lg bg-primary py-2 px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-neutral-800 transition-all space-x-1.5"
            >
              <span>Continue to Login</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-4 animate-scale-in">
            <div className="mx-auto h-11 w-11 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center text-destructive">
              <XCircle className="h-5 w-5" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold text-destructive">Verification Failed</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {error}
              </p>
            </div>
            <div className="pt-2">
              <Link to="/login" className="text-xs font-semibold text-primary hover:underline">
                Back to Login
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default VerifyEmail;
