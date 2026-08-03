import React, { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

function stagger(i: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: i * 0.05,
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  };
}

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
    <div className="space-y-4">
      {/* Heading */}
      <motion.div {...stagger(0)} className="space-y-0.5">
        <h2 className="text-[23px] font-black tracking-tight text-zinc-900 leading-tight">
          Verify Email
        </h2>
        <p className="text-[12px] text-zinc-500 font-medium">
          Activating your AttendWise account.
        </p>
      </motion.div>

      <div className="space-y-4">
        {verifying ? (
          <div className="space-y-4 py-8 flex flex-col items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            <p className="text-[12px] text-zinc-500 font-semibold">Verifying authenticity...</p>
          </div>
        ) : success ? (
          <div className="space-y-4 py-2 text-center animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
              <span className="text-xl font-bold">✓</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-black text-zinc-900 tracking-tight">Verified successfully</h3>
              <p className="text-[12px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
                Your account is now activated. You can sign in using your email and password.
              </p>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-[12px] bg-zinc-900 h-10 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] hover:bg-zinc-800 transition-colors"
            >
              <span>Continue to Login</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-4 py-2 text-center animate-scale-in">
            <div className="mx-auto h-12 w-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-650">
              <span className="text-xl font-bold">✕</span>
            </div>
            <div className="space-y-1">
              <h3 className="text-[15px] font-black text-red-650 tracking-tight">Verification failed</h3>
              <p className="text-[12px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
                {error}
              </p>
            </div>
            <Link
              to="/login"
              className="flex w-full items-center justify-center rounded-[12px] bg-zinc-900 h-10 text-[12px] font-bold text-white shadow-[0_2px_8px_rgba(15,23,42,0.1)] hover:bg-zinc-800 transition-colors"
            >
              <span>Back to Login</span>
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </div>
        )}
      </div>

      {/* Security Info Card */}
      <motion.div {...stagger(2)} className="pt-2">
        <div className="h-px bg-zinc-200/50 mb-2.5" />
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-medium">
          <span>🔒 Your data stays private.</span>
          <span className="text-zinc-300">Protected with secure authentication.</span>
        </div>
      </motion.div>
    </div>
  );
};

export default VerifyEmail;
