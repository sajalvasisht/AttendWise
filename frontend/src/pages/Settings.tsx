import React, { useState, useEffect } from "react";
import Navbar from "../components/Navbar";
import { useAuth } from "../hooks/useAuth";
import { useTheme } from "../context/ThemeContext";
import type { Theme } from "../context/ThemeContext";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import api from "../services/api";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings as SettingsIcon,
  Sun,
  Moon,
  Laptop,
  AlertTriangle,
  Trash2,
  Calendar,
  Layers,
  KeyRound,
  RotateCcw,
  Sparkles,
  Shield,
  Loader2,
  CheckCircle2,
  Compass,
} from "lucide-react";

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

const Settings: React.FC = () => {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSem, setActiveSem] = useState<Semester | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Change Password state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPass, setChangingPass] = useState(false);

  // Focus states
  const [oldFocused, setOldFocused] = useState(false);
  const [oldHovered, setOldHovered] = useState(false);
  const [newFocused, setNewFocused] = useState(false);
  const [newHovered, setNewHovered] = useState(false);
  const [confirmFocused, setConfirmFocused] = useState(false);
  const [confirmHovered, setConfirmHovered] = useState(false);

  const [delFocused, setDelFocused] = useState(false);
  const [delHovered, setDelHovered] = useState(false);

  // Dialog states
  const [showRestartConfirm, setShowRestartConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showNewSemConfirm, setShowNewSemConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const isGoogleUser = !!user?.google_id;

  useEffect(() => {
    loadSemesters();
  }, []);

  const loadSemesters = async () => {
    try {
      const list = await semesterService.list();
      setSemesters(list);
      const active = list.find((s) => s.is_active);
      setActiveSem(active || list[list.length - 1] || null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleActivateSemester = async (semId: number) => {
    setLoading(true);
    setError(null);
    try {
      await api.post(`/semesters/${semId}/activate`);
      setSuccessMsg("Active semester switched successfully.");
      await loadSemesters();
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to switch semester.");
    } finally {
      setLoading(false);
      setTimeout(() => setSuccessMsg(null), 3000);
    }
  };

  const handleRestartSetup = async () => {
    if (!activeSem) return;
    setLoading(true);
    try {
      await semesterService.delete(activeSem.id);
      setShowRestartConfirm(false);
      navigate("/setup?mode=restart");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to restart setup.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText.toLowerCase() !== "delete my account") {
      setError("Please type 'delete my account' to confirm account deletion.");
      return;
    }
    setLoading(true);
    try {
      await api.delete("/auth/me");
      logout();
      navigate("/login");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to delete account.");
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setChangingPass(true);
    try {
      await api.post("/auth/change-password", {
        old_password: oldPassword,
        new_password: newPassword,
      });
      setSuccessMsg("Password updated successfully.");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "Failed to change password.");
    } finally {
      setChangingPass(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col font-sans">
      <Navbar />

      <main className="flex-grow max-w-4xl mx-auto w-full px-6 py-14 space-y-12">
        
        {/* Header */}
        <div className="flex items-center space-x-3.5 border-b border-zinc-150/60 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-zinc-200/50 bg-white shadow-sm">
            <SettingsIcon className="h-5 w-5 text-zinc-700" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-zinc-900">Settings & Profile</h1>
            <p className="text-xs text-zinc-500 font-semibold mt-1">Manage your account credentials, semesters, and appearance preferences.</p>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="rounded-xl border border-red-500/15 bg-red-50/50 p-4 text-xs text-red-650 flex items-start space-x-2 animate-scale-in">
            <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-red-500" />
            <span className="font-semibold leading-relaxed">{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="rounded-xl border border-emerald-500/15 bg-emerald-50/50 p-4 text-xs text-emerald-650 flex items-start space-x-2 animate-scale-in">
            <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-500" />
            <span className="font-semibold leading-relaxed">{successMsg}</span>
          </div>
        )}

        {/* PROFILE SECTION */}
        <section className="premium-card p-6 space-y-6">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
            <User className="h-4.5 w-4.5 text-zinc-300" />
            <span>User Profile</span>
          </h2>
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt="Profile Avatar"
                className="h-20 w-20 rounded-full border border-zinc-200 object-cover shadow-sm"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 flex items-center justify-center text-3xl font-black uppercase shadow-sm">
                {(user?.full_name || user?.email || "U")[0]}
              </div>
            )}

            <div className="flex-grow space-y-2.5 w-full text-center md:text-left">
              <div>
                <h3 className="text-base font-extrabold text-zinc-800">{user?.full_name || "AttendWise User"}</h3>
                <p className="text-xs text-zinc-400 font-semibold">{user?.email}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                <div className="flex items-center justify-center md:justify-start space-x-2 text-zinc-450 font-semibold">
                  <Shield className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Provider: </span>
                  <span className="font-bold text-zinc-700">{isGoogleUser ? "Google Account" : "Email / Password"}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start space-x-2 text-zinc-450 font-semibold">
                  <Calendar className="h-3.5 w-3.5 text-zinc-300" />
                  <span>Joined: </span>
                  <span className="font-bold text-zinc-700">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* APPEARANCE SECTION */}
        <section className="premium-card p-6 space-y-4">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Appearance & Theme</h2>
          <p className="text-xs text-zinc-500 font-semibold">Select how AttendWise appears on your device. Your settings persist automatically.</p>
          
          <div className="grid grid-cols-3 gap-3">
            {[
              { id: "light", label: "Light", icon: Sun },
              { id: "dark", label: "Dark", icon: Moon },
              { id: "system", label: "System", icon: Laptop },
            ].map((themeOpt) => {
              const Icon = themeOpt.icon;
              const isActive = theme === themeOpt.id;
              return (
                <button
                  key={themeOpt.id}
                  onClick={() => setTheme(themeOpt.id as Theme)}
                  className={`flex flex-col items-center justify-center py-3.5 rounded-xl border text-xs font-bold space-y-1.5 transition-all cursor-pointer shadow-sm ${
                    isActive
                      ? "bg-zinc-900 text-white border-zinc-900 shadow-[0_2px_8px_rgba(15,23,42,0.1)]"
                      : "bg-white text-zinc-500 border-zinc-200 hover:text-zinc-800 hover:bg-zinc-50"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" />
                  <span>{themeOpt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SEMESTER MANAGEMENT SECTION */}
        <section className="premium-card p-6 space-y-6">
          <div className="flex justify-between items-center border-b border-zinc-100 pb-4">
            <div>
              <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
                <Layers className="h-4.5 w-4.5 text-zinc-300" />
                <span>Semester Management</span>
              </h2>
              <p className="text-xs text-zinc-500 font-semibold mt-1">Configure your semesters, timelines, timetables, and calendars.</p>
            </div>
            
            <button
              onClick={() => setShowNewSemConfirm(true)}
              className="rounded-xl bg-zinc-900 py-2 px-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm select-none"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start New Semester</span>
            </button>
          </div>

          {/* Current Semester Card */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Active Semester</h3>
            {activeSem ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50/20 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-sm font-bold text-zinc-800">{activeSem.name}</h4>
                  <p className="text-xs text-zinc-400 font-semibold mt-0.5">
                    {activeSem.start_date} to {activeSem.end_date}
                  </p>
                </div>
                
                {/* Active Semester Quick Options */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("/manage-setup")}
                    className="rounded-xl bg-zinc-900 py-2 px-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all cursor-pointer shadow-sm"
                  >
                    Manage Setup
                  </button>
                  <button
                    onClick={() => navigate("/initialize-attendance")}
                    className="rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 px-3.5 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 transition-all cursor-pointer shadow-sm"
                  >
                    Initialize Attendance
                  </button>
                  <button
                    onClick={() => setShowRestartConfirm(true)}
                    className="rounded-xl border border-red-200 bg-red-50/40 text-red-650 px-3.5 py-2 text-xs font-bold hover:bg-red-50 transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>Reset Setup</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-xs text-zinc-400 border border-dashed border-zinc-200 rounded-xl bg-white italic font-semibold">
                No active semester set up. Click "Start New Semester" to get started.
              </div>
            )}
          </div>

          {/* Semesters History */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Semester History</h3>
            <div className="space-y-3">
              {semesters.map((sem) => (
                <div
                  key={sem.id}
                  className={`rounded-xl border p-4.5 flex justify-between items-center bg-white ${
                    sem.is_active ? "border-zinc-300 shadow-sm" : "border-zinc-200/80"
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-zinc-800 flex items-center space-x-2">
                      <span>{sem.name}</span>
                      {sem.is_active && (
                        <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[8px] px-2 py-0.5 font-bold uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-zinc-450 font-semibold mt-1">
                      {sem.start_date} to {sem.end_date}
                    </p>
                  </div>

                  {!sem.is_active && (
                    <button
                      onClick={() => handleActivateSemester(sem.id)}
                      disabled={loading}
                      className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs font-bold text-zinc-600 hover:text-zinc-800 transition-all cursor-pointer shadow-sm disabled:opacity-50"
                    >
                      Make Active
                    </button>
                  )}
                </div>
              ))}
              {semesters.length === 0 && (
                <p className="text-xs text-zinc-400 text-center py-4 italic font-semibold">No historical semester records available.</p>
              )}
            </div>
          </div>
        </section>

        {/* SECURITY & ACCOUNT SECTION */}
        <section className="premium-card p-6 space-y-6">
          <h2 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center space-x-2">
            <KeyRound className="h-4.5 w-4.5 text-zinc-300" />
            <span>Account Security</span>
          </h2>

          {/* Change Password form (Email accounts only) */}
          {!isGoogleUser ? (
            <form onSubmit={handleChangePassword} className="space-y-4 border-b border-zinc-100 pb-6">
              <h3 className="text-xs font-bold text-zinc-700">Change Password</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="password"
                  required
                  placeholder="Old Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  onFocus={() => setOldFocused(true)}
                  onBlur={() => setOldFocused(false)}
                  onMouseEnter={() => setOldHovered(true)}
                  onMouseLeave={() => setOldHovered(false)}
                  style={inputStyle(oldFocused, oldHovered)}
                  className="rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-300 transition-all duration-150"
                />
                <input
                  type="password"
                  required
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  onFocus={() => setNewFocused(true)}
                  onBlur={() => setNewFocused(false)}
                  onMouseEnter={() => setNewHovered(true)}
                  onMouseLeave={() => setNewHovered(false)}
                  style={inputStyle(newFocused, newHovered)}
                  className="rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-300 transition-all duration-150"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setConfirmFocused(true)}
                  onBlur={() => setConfirmFocused(false)}
                  onMouseEnter={() => setConfirmHovered(true)}
                  onMouseLeave={() => setConfirmHovered(false)}
                  style={inputStyle(confirmFocused, confirmHovered)}
                  className="rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-300 transition-all duration-150"
                />
              </div>
              <button
                type="submit"
                disabled={changingPass}
                className="rounded-xl bg-zinc-900 py-2 px-3.5 text-xs font-bold text-white hover:bg-zinc-800 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1.5 shadow-sm"
              >
                {changingPass && <Loader2 className="h-3.5 w-3.5 animate-spin text-white/60" />}
                <span>Save Password</span>
              </button>
            </form>
          ) : (
            <div className="rounded-xl bg-zinc-50 p-4 border border-zinc-200/60 text-xs text-zinc-500 font-semibold leading-relaxed">
              Your account is secured via **Google OAuth**. Password changes are managed through Google.
            </div>
          )}

          {/* Help & Support */}
          <div className="border-t border-zinc-100 pt-6 space-y-4">
            <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Help & Support</h3>
            
            {/* Interactive Product Tour */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/20 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-zinc-800">Interactive Product Tour</h4>
                <p className="text-[11px] text-zinc-450 font-semibold leading-relaxed mt-0.5">
                  Replay the interactive walkthrough highlighting the application's core planning features.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("replay-product-tour"));
                  setSuccessMsg("Product tour started.");
                }}
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-650 hover:text-zinc-800 hover:bg-zinc-50 transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Sparkles className="h-4 w-4 text-zinc-400" />
                <span>Replay Tour</span>
              </button>
            </div>

            {/* Welcome Onboarding Guide */}
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/20 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-zinc-800">Welcome Guide</h4>
                <p className="text-[11px] text-zinc-450 font-semibold leading-relaxed mt-0.5">
                  Review the slide introduction guide detailing AttendWise tracking and planning core engines.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/welcome")}
                className="rounded-xl border border-zinc-200 bg-white px-3.5 py-2 text-xs font-bold text-zinc-650 hover:text-zinc-800 hover:bg-zinc-50 transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Compass className="h-4 w-4 text-zinc-400" />
                <span>Open Guide</span>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-bold text-red-500 uppercase tracking-widest">Danger Zone</h3>
            <div className="rounded-xl border border-red-150 bg-red-50/30 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-red-650">Delete Account</h4>
                <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mt-0.5">
                  Permanently delete your AttendWise account and purge all semester, subject, and attendance history. This action is irreversible.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-xl bg-red-600 hover:bg-red-700 py-2 px-4 text-xs font-bold text-white transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm"
              >
                <Trash2 className="h-4 w-4 text-white/80" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* CONFIRM NEW SEMESTER DIALOG */}
      {showNewSemConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[3px] flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-zinc-200/50 bg-white rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-5 animate-scale-in text-[#0f172a]">
            <h3 className="text-base font-black text-zinc-800">Start New Semester?</h3>
            <p className="text-[12px] text-zinc-550 leading-relaxed">
              This will create a new semester timeline. Your current active semester and all its attendance logs will remain stored as read-only historical records.
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowNewSemConfirm(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewSemConfirm(false);
                  navigate("/setup?mode=new");
                }}
                className="rounded-xl bg-zinc-900 py-2.5 px-4 text-xs font-bold text-white hover:bg-zinc-800 cursor-pointer shadow-sm"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESTART DIALOG */}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[3px] flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-zinc-200/50 bg-white rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-5 animate-scale-in text-[#0f172a]">
            <div className="flex items-center space-x-2.5 text-red-650">
              <AlertTriangle className="h-5.5 w-5.5 text-red-500" />
              <h3 className="text-base font-black">Reset Active Semester Setup?</h3>
            </div>
            <p className="text-[12px] text-zinc-550 leading-relaxed">
              This will permanently delete the current active semester, all configured subjects, timetable slots, and marked attendance records. **This action cannot be undone.**
            </p>
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleRestartSetup}
                className="rounded-xl bg-red-600 py-2.5 px-4 text-xs font-bold text-white hover:bg-red-700 cursor-pointer shadow-sm"
              >
                Yes, Reset Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ACCOUNT DIALOG */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-zinc-950/20 backdrop-blur-[3px] flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-zinc-200/50 bg-white rounded-[28px] p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-5 animate-scale-in text-[#0f172a]">
            <h3 className="text-base font-black text-red-650">Delete Account Permanently?</h3>
            <p className="text-[12px] text-zinc-555 leading-relaxed">
              To proceed, please type <span className="font-bold text-zinc-900">delete my account</span> in the input box below. This will delete all user data and credentials permanently.
            </p>
            <input
              type="text"
              placeholder="delete my account"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              onFocus={() => setDelFocused(true)}
              onBlur={() => setDelFocused(false)}
              onMouseEnter={() => setDelHovered(true)}
              onMouseLeave={() => setDelHovered(false)}
              style={inputStyle(delFocused, delHovered)}
              className="w-full rounded-xl py-2.5 px-3.5 text-xs text-zinc-800 placeholder:text-zinc-300 outline-none transition-all duration-150"
            />
            <div className="flex justify-end space-x-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-xl border border-zinc-200 px-4 py-2.5 text-xs font-bold text-zinc-600 hover:bg-zinc-50 cursor-pointer transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== "delete my account"}
                className="rounded-xl bg-red-600 py-2.5 px-4 text-xs font-bold text-white hover:bg-red-700 cursor-pointer disabled:opacity-40 shadow-sm"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
