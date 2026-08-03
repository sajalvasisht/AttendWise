import React, { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { GoogleSignInButton } from "../components/GoogleSignInButton";
import { motion } from "framer-motion";
import api from "../services/api";

// Per-element stagger animation: rises 6px, staggered by 55ms
function stagger(i: number) {
  return {
    initial: { opacity: 0, y: 6 },
    animate: { opacity: 1, y: 0 },
    transition: {
      delay: i * 0.055,
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1] as any,
    },
  };
}

// Custom input dynamic styles
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

const Login: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(false);

  const [emailFocused,    setEmailFocused]    = useState(false);
  const [emailHovered,    setEmailHovered]    = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [passwordHovered, setPasswordHovered] = useState(false);

  const redirectAfterLogin = async () => {
    try {
      const { data } = await api.get("/semesters");
      navigate(data.find((s: any) => s.is_active) ? "/dashboard" : "/welcome");
    } catch {
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
      setError(
        err.response?.data?.detail ||
        "Failed to sign in. Please verify your credentials."
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
      setError(
        err.response?.data?.detail ||
        "Google authentication failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">

      {/* Heading */}
      <motion.div {...stagger(0)} className="space-y-0.5">
        <h2 className="text-[23px] font-black tracking-tight text-zinc-900 leading-tight">
          Welcome back
        </h2>
        <p className="text-[12px] text-zinc-500 font-medium">
          Sign in to continue to your dashboard.
        </p>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl px-4.5 py-3 text-[11px] text-red-650 font-medium"
          style={{
            background: "rgba(239,68,68,0.04)",
            border: "1px solid rgba(239,68,68,0.1)",
          }}
        >
          {error}
        </motion.div>
      )}

      {/* Google Sign-In */}
      <motion.div {...stagger(1)} className="w-full">
        <GoogleSignInButton
          onSuccess={handleGoogleSuccess}
          onError={(err) => setError(err.message || "Google OAuth failed")}
        />
      </motion.div>

      {/* Elegant Divider */}
      <motion.div {...stagger(2)} className="relative flex items-center gap-3">
        <div className="flex-grow h-px bg-zinc-200/50" />
        <span
          className="text-[9.5px] font-bold tracking-widest uppercase"
          style={{ color: "rgba(15,23,42,0.3)" }}
        >
          Continue with email
        </span>
        <div className="flex-grow h-px bg-zinc-200/50" />
      </motion.div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">

        {/* Email */}
        <motion.div {...stagger(3)} className="space-y-1">
          <label
            htmlFor="email"
            className="block text-[9px] font-semibold tracking-widest text-zinc-400 uppercase"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            onMouseEnter={() => setEmailHovered(true)}
            onMouseLeave={() => setEmailHovered(false)}
            disabled={loading}
            style={inputStyle(emailFocused, emailHovered)}
            className="block w-full rounded-[12px] py-2.5 px-3.5 text-[12px] text-zinc-800 placeholder:text-zinc-300 transition-all duration-150"
            placeholder="name@university.edu"
          />
        </motion.div>

        {/* Password */}
        <motion.div {...stagger(4)} className="space-y-1">
          <div className="flex justify-between items-center">
            <label
              htmlFor="password"
              className="block text-[9px] font-semibold tracking-widest text-zinc-400 uppercase"
            >
              Password
            </label>
            <Link
              to="/forgot-password"
              className="text-[9.5px] font-bold text-emerald-600 hover:text-emerald-700 transition-colors duration-150"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPwd ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
              onMouseEnter={() => setPasswordHovered(true)}
              onMouseLeave={() => setPasswordHovered(false)}
              disabled={loading}
              style={inputStyle(passwordFocused, passwordHovered)}
              className="block w-full rounded-[12px] py-2.5 pl-3.5 pr-10 text-[12px] text-zinc-800 placeholder:text-zinc-300 transition-all duration-150"
              placeholder="Enter your password"
            />
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPwd(!showPwd)}
              disabled={loading}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-300 hover:text-zinc-500 transition-colors duration-150 cursor-pointer disabled:opacity-50"
            >
              {showPwd ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>
        </motion.div>

        {/* Sign In Button */}
        <motion.div {...stagger(5)} className="pt-1">
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
                <span>Sign in</span>
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

      {/* Create Account Inline CTA */}
      <motion.div {...stagger(6)} className="text-center pt-1.5">
        <p className="text-[11.5px] text-zinc-500 font-medium">
          New here?{" "}
          <Link
            to="/register"
            className="font-bold text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-0.5 transition-colors group"
          >
            <span>Create account</span>
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

      {/* Security Info Card (Separated by subtle line) */}
      <motion.div {...stagger(7)} className="pt-2">
        <div className="h-px bg-zinc-200/50 mb-2.5" />
        <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-400 font-medium">
          <span>🔒 Your data stays private.</span>
          <span className="text-zinc-300">Protected with secure authentication.</span>
        </div>
      </motion.div>

    </div>
  );
};

export default Login;
