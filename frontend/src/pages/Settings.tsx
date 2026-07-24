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
      alert("Please type 'delete my account' to confirm.");
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
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground">
      <Navbar />

      <main className="max-w-4xl mx-auto px-6 py-10 space-y-10">
        
        {/* Header */}
        <div className="flex items-center space-x-3.5 border-b border-border/80 pb-6">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card shadow-sm">
            <SettingsIcon className="h-5 w-5 text-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Settings & Profile</h1>
            <p className="text-xs text-muted-foreground">Manage your account credentials, semesters, and appearance preferences.</p>
          </div>
        </div>

        {/* Global Notifications */}
        {error && (
          <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-3 text-xs text-destructive flex items-center space-x-2 animate-scale-in">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        )}
        {successMsg && (
          <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-3 text-xs text-emerald-600 flex items-center space-x-2 animate-scale-in">
            <CheckCircle2 className="h-4 w-4" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* PROFILE SECTION */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center space-x-2">
            <User className="h-4 w-4" />
            <span>User Profile</span>
          </h2>
          <div className="flex flex-col md:flex-row items-center md:items-start space-y-4 md:space-y-0 md:space-x-6">
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt="Profile Avatar"
                className="h-20 w-20 rounded-full border border-border object-cover"
              />
            ) : (
              <div className="h-20 w-20 rounded-full bg-accent text-accent-foreground border border-border flex items-center justify-center text-3xl font-extrabold uppercase">
                {(user?.full_name || user?.email || "U")[0]}
              </div>
            )}

            <div className="flex-1 space-y-2.5 w-full text-center md:text-left">
              <div>
                <h3 className="text-base font-bold text-foreground">{user?.full_name || "AttendWise User"}</h3>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-2">
                <div className="flex items-center justify-center md:justify-start space-x-2 text-muted-foreground">
                  <Shield className="h-3.5 w-3.5" />
                  <span>Provider: </span>
                  <span className="font-semibold text-foreground">{isGoogleUser ? "Google Account" : "Email / Password"}</span>
                </div>
                <div className="flex items-center justify-center md:justify-start space-x-2 text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  <span>Joined: </span>
                  <span className="font-semibold text-foreground">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* APPEARANCE SECTION */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-4">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Appearance & Theme</h2>
          <p className="text-xs text-muted-foreground">Select how AttendWise appears on your device. Your settings persist automatically.</p>
          
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
                  className={`flex flex-col items-center justify-center py-3 rounded-lg border text-xs font-semibold space-y-1.5 transition-all cursor-pointer ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-muted-foreground border-border hover:text-foreground hover:bg-muted/40"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{themeOpt.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* SEMESTER MANAGEMENT SECTION */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <div className="flex justify-between items-center border-b border-border/60 pb-4">
            <div>
              <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center space-x-2">
                <Layers className="h-4 w-4" />
                <span>Semester Management</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Configure your semesters, timelines, timetables, and calendars.</p>
            </div>
            
            <button
              onClick={() => setShowNewSemConfirm(true)}
              className="rounded-lg bg-primary py-1.5 px-3 text-xs font-semibold text-primary-foreground hover:bg-neutral-800 transition-all flex items-center space-x-1 cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Start New Semester</span>
            </button>
          </div>

          {/* Current Semester Card */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Active Semester</h3>
            {activeSem ? (
              <div className="rounded-lg border border-border bg-background p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h4 className="text-sm font-bold text-foreground">{activeSem.name}</h4>
                  <p className="text-xs text-muted-foreground">
                    {activeSem.start_date} to {activeSem.end_date}
                  </p>
                </div>
                
                {/* Active Semester Quick Options */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => navigate("/setup?step=4")}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    Replace Timetable
                  </button>
                  <button
                    onClick={() => navigate("/setup?step=5")}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    Replace Calendar
                  </button>
                  <button
                    onClick={() => navigate("/initialize-attendance")}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-all cursor-pointer"
                  >
                    Initialize Attendance
                  </button>
                  <button
                    onClick={() => setShowRestartConfirm(true)}
                    className="rounded-lg border border-destructive/20 bg-destructive/5 text-destructive px-2.5 py-1.5 text-[11px] font-semibold hover:bg-destructive/10 transition-all cursor-pointer flex items-center space-x-1"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Restart Setup</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-muted-foreground border border-dashed border-border rounded-lg bg-background">
                No active semester set up. Click "Start New Semester" to get started.
              </div>
            )}
          </div>

          {/* Semesters History */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Semester History (Read-Only reference)</h3>
            <div className="space-y-2">
              {semesters.map((sem) => (
                <div
                  key={sem.id}
                  className={`rounded-lg border p-4 flex justify-between items-center bg-background/50 ${
                    sem.is_active ? "border-primary/30" : "border-border"
                  }`}
                >
                  <div>
                    <h4 className="text-xs font-bold text-foreground flex items-center space-x-2">
                      <span>{sem.name}</span>
                      {sem.is_active && (
                        <span className="rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[9px] px-1 py-0.5 font-bold uppercase">
                          Active
                        </span>
                      )}
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {sem.start_date} to {sem.end_date}
                    </p>
                  </div>

                  {!sem.is_active && (
                    <button
                      onClick={() => handleActivateSemester(sem.id)}
                      disabled={loading}
                      className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] font-semibold text-foreground hover:bg-muted transition-all cursor-pointer disabled:opacity-50"
                    >
                      Make Active
                    </button>
                  )}
                </div>
              ))}
              {semesters.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">No historical semester records available.</p>
              )}
            </div>
          </div>
        </section>

        {/* SECURITY & ACCOUNT SECTION */}
        <section className="bg-card border border-border rounded-xl p-6 shadow-sm space-y-6">
          <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center space-x-2">
            <KeyRound className="h-4 w-4" />
            <span>Account Security</span>
          </h2>

          {/* Change Password form (Email accounts only) */}
          {!isGoogleUser ? (
            <form onSubmit={handleChangePassword} className="space-y-4 border-b border-border/60 pb-6">
              <h3 className="text-xs font-semibold text-foreground">Change Password</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="password"
                  required
                  placeholder="Old Password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  className="rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-foreground/20"
                />
                <input
                  type="password"
                  required
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-foreground/20"
                />
                <input
                  type="password"
                  required
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-foreground/20"
                />
              </div>
              <button
                type="submit"
                disabled={changingPass}
                className="rounded-lg bg-primary py-1.5 px-3 text-xs font-semibold text-primary-foreground hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-1"
              >
                {changingPass && <Loader2 className="h-3 w-3 animate-spin" />}
                <span>Save Password</span>
              </button>
            </form>
          ) : (
            <div className="rounded-lg bg-muted/40 p-4 border border-border text-xs text-muted-foreground">
              Your account is secured via **Google OAuth**. Password changes are managed through Google.
            </div>
          )}

          {/* Help & Support */}
          <div className="border-t border-border/60 pt-6 space-y-3">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Help & Support</h3>
            
            {/* Interactive Product Tour */}
            <div className="rounded-lg border border-border bg-background p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">Interactive Product Tour</h4>
                <p className="text-[11px] text-muted-foreground">
                  Replay the interactive walkthrough highlighting the application's core planning features.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("replay-product-tour"));
                  setSuccessMsg("Product tour started.");
                }}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center space-x-1"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Replay Tour</span>
              </button>
            </div>

            {/* Welcome Onboarding Guide */}
            <div className="rounded-lg border border-border bg-background p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-foreground">Welcome Guide</h4>
                <p className="text-[11px] text-muted-foreground">
                  Review the slide introduction guide detailing AttendWise tracking and planning core engines.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate("/welcome")}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition-all cursor-pointer flex items-center space-x-1"
              >
                <Compass className="h-3.5 w-3.5" />
                <span>Open Guide</span>
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-destructive uppercase tracking-wide">Danger Zone</h3>
            <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h4 className="text-xs font-bold text-destructive">Delete Account</h4>
                <p className="text-[11px] text-muted-foreground">
                  Permanently delete your AttendWise account and purge all semester, subject, and attendance history. This action is irreversible.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg bg-destructive hover:bg-destructive-hover py-1.5 px-3.5 text-xs font-bold text-white transition-all cursor-pointer flex items-center space-x-1"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Account</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* CONFIRM NEW SEMESTER DIALOG */}
      {showNewSemConfirm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-border bg-card rounded-xl p-6 shadow-lg space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-foreground">Start New Semester?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will create a new semester timeline. Your current active semester and all its attendance logs will remain stored as read-only historical records.
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowNewSemConfirm(false)}
                className="rounded-lg border border-border bg-card py-1.5 px-3.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowNewSemConfirm(false);
                  navigate("/setup?mode=new");
                }}
                className="rounded-lg bg-primary py-1.5 px-3.5 text-xs font-bold text-primary-foreground hover:bg-neutral-800 cursor-pointer"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM RESTART DIALOG */}
      {showRestartConfirm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-border bg-card rounded-xl p-6 shadow-lg space-y-4 animate-scale-in">
            <div className="flex items-center space-x-2.5 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-sm font-bold">Restart Setup Wizard?</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              This will permanently delete the current active semester, all configured subjects, timetable slots, and marked attendance records. **This action cannot be undone.**
            </p>
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowRestartConfirm(false)}
                className="rounded-lg border border-border bg-card py-1.5 px-3.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleRestartSetup}
                className="rounded-lg bg-destructive py-1.5 px-3.5 text-xs font-bold text-white hover:bg-destructive-hover cursor-pointer"
              >
                Yes, Delete & Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE ACCOUNT DIALOG */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="max-w-md w-full border border-border bg-card rounded-xl p-6 shadow-lg space-y-4 animate-scale-in">
            <h3 className="text-sm font-bold text-destructive">Delete Account Permanently?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To proceed, please type <span className="font-bold text-foreground">delete my account</span> in the input box below. This will delete all user data and credentials permanently.
            </p>
            <input
              type="text"
              placeholder="delete my account"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="w-full rounded-lg border border-border bg-background py-1.5 px-3 text-xs text-foreground outline-none focus:border-destructive/20"
            />
            <div className="flex justify-end space-x-2 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteConfirmText("");
                }}
                className="rounded-lg border border-border bg-card py-1.5 px-3.5 text-xs font-semibold text-foreground hover:bg-muted cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText.toLowerCase() !== "delete my account"}
                className="rounded-lg bg-destructive py-1.5 px-3.5 text-xs font-bold text-white hover:bg-destructive-hover cursor-pointer disabled:opacity-40"
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
