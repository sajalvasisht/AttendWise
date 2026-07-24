import React from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, CheckCircle2, ArrowRight } from "lucide-react";

const SetupComplete: React.FC = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate("/initialize-attendance");
  };

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col justify-center items-center px-6 py-12">
      
      {/* Background radial highlight */}
      <div className="absolute top-1/4 h-72 w-72 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="max-w-md w-full border border-border bg-card rounded-2xl p-8 shadow-xl text-center space-y-6 animate-scale-in relative text-foreground">
        
        {/* Brand Icon Header */}
        <div className="flex justify-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background shadow-sm">
            <GraduationCap className="h-5 w-5 text-foreground" />
          </div>
        </div>

        {/* Large Success Animation Banner */}
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-600 animate-pulse">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold tracking-tight text-foreground">Your Semester is Ready</h2>
            <p className="text-xs text-muted-foreground">We've successfully configured your active term timetable and calendar.</p>
          </div>
        </div>

        {/* Explanation text */}
        <p className="text-xs leading-relaxed text-muted-foreground bg-muted/40 p-4 border border-border rounded-xl">
          Next, you will initialize your current class attendance status. Entering conducted and attended counts up to today activates safe bunk simulations and dashboard indicators.
        </p>

        {/* Primary Action Button */}
        <button
          onClick={handleContinue}
          className="w-full rounded-lg bg-primary py-2.5 px-4 text-xs font-bold text-primary-foreground shadow-sm hover:bg-neutral-800 transition-all cursor-pointer flex items-center justify-center space-x-1.5 active:scale-[0.99]"
        >
          <span>Continue to Initialize Attendance</span>
          <ArrowRight className="h-4 w-4" />
        </button>

      </div>
    </div>
  );
};

export default SetupComplete;
