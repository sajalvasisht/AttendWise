import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../services/auth";
import { Loader2, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

// Stagger sequence matching Login.tsx
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

// Input border/bg/shadow matching Login.tsx
function inputStyle(focused: boolean, hovered: boolean): React.CSSProperties {
  return {
    border: `1px solid ${
      focused
        ? "rgba(15,23,42,0.3)"
        : hovered
        ? "rgba(15,23,42,0.14)"
        : "rgba(15,23,42,0.08)"
    }`,
    backgroundColor: focused ? "#ffffff" : hovered ? "#ffffff" : "#fafafa",
    boxShadow: focused
      ? "0 0 0 3px rgba(15,23,42,0.04), 0 1px 2px rgba(15,23,42,0.02)"
      : "none",
    transition:
      "border-color 180ms ease, background-color 180ms ease, box-shadow 180ms ease",
    outline: "none",
  };
}

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

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
    <div className="space-y-4">
      {success ? (
        <div className="space-y-4 py-4 text-center animate-scale-in">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
            <span className="text-xl font-bold">✓</span>
          </div>
          <div className="space-y-1">
            <h3 className="text-[16px] font-black text-zinc-900 tracking-tight">
              Check your inbox
            </h3>
            <p className="text-[12px] text-zinc-500 leading-relaxed max-w-xs mx-auto">
              If the email exists in our system, we have sent a secure password reset link to your address.
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
      ) : (
        <>
          {/* Heading */}
          <motion.div {...stagger(0)} className="space-y-0.5">
            <h2 className="text-[23px] font-black tracking-tight text-zinc-900 leading-tight">
              Forgot password
            </h2>
            <p className="text-[12px] text-zinc-500 font-medium">
              Send a secure password reset link to your email.
            </p>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.2 }}
                className="rounded-xl px-4 py-3 text-[11px] text-red-650 font-medium"
                style={{
                  background: "rgba(239,68,68,0.04)",
                  border: "1px solid rgba(239,68,68,0.1)",
                }}
              >
                {error}
              </motion.div>
            )}

            {/* Email Address */}
            <motion.div {...stagger(1)} className="space-y-1">
              <label
                htmlFor="email"
                className="block text-[9px] font-semibold tracking-widest text-zinc-400 uppercase"
              >
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                disabled={loading}
                style={inputStyle(focused, hovered)}
                className="block w-full rounded-[12px] py-2.5 px-3.5 text-[12px] text-zinc-800 placeholder:text-zinc-350 transition-all duration-150"
                placeholder="name@university.edu"
              />
            </motion.div>

            {/* Submit Button */}
            <motion.div {...stagger(2)} className="pt-1">
              <motion.button
                type="submit"
                disabled={loading}
                whileHover={!loading
                  ? { y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" }
                  : undefined
                }
                whileTap={!loading
                  ? { y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" }
                  : undefined
                }
                transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                className="flex w-full items-center justify-center rounded-[12px] bg-zinc-900 text-white text-[12px] font-bold cursor-pointer disabled:opacity-50 h-10 select-none"
                style={{ boxShadow: "0 2px 6px rgba(15,23,42,0.1)" }}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                ) : (
                  <motion.span 
                    className="flex items-center gap-1.5"
                    initial="rest"
                    whileHover="hover"
                    animate="rest"
                  >
                    <span>Send reset link</span>
                    <motion.span
                      variants={{ rest: { x: 0 }, hover: { x: 4 } }}
                      transition={{ duration: 0.18, ease: "easeOut" }}
                      className="inline-flex"
                    >
                      <ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />
                    </motion.span>
                  </motion.span>
                )}
              </motion.button>
            </motion.div>
          </form>
        </>
      )}

      {/* Switcher */}
      <motion.div {...stagger(3)} className="text-center pt-1.5">
        <p className="text-[11.5px] text-zinc-500 font-medium">
          Remember your password?{" "}
          <Link
            to="/login"
            className="font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5 transition-colors group"
          >
            <span>Sign in</span>
            <motion.span
              className="inline-block"
              initial={{ x: 0 }}
              whileHover={{ x: 3 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              →
            </motion.span>
          </Link>
        </p>
      </motion.div>

      {/* Security Info Card */}
      <motion.div {...stagger(4)} className="pt-2">
        <div className="h-px bg-zinc-200/50 mb-2.5" />
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-medium">
          <span>🔒 Your data stays private.</span>
          <span className="text-zinc-300">Protected with secure authentication.</span>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
