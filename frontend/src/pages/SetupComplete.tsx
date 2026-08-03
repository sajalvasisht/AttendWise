import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight } from "lucide-react";
import { AttendWiseLogo } from "../components/AttendWiseLogo";
import { motion } from "framer-motion";

const SetupComplete: React.FC = () => {
  const navigate = useNavigate();

  const handleContinue = () => {
    navigate("/initialize-attendance");
  };

  return (
    <div className="min-h-screen bg-[#fcfdfd] text-[#0f172a] antialiased selection:bg-emerald-100 selection:text-emerald-950 flex flex-col justify-center items-center px-6 py-12">
      
      {/* Background radial highlight */}
      <div className="absolute top-1/4 h-72 w-72 rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />

      {/* Main card */}
      <div className="max-w-md w-full premium-card p-8 text-center space-y-6 animate-scale-in relative">
        
        {/* Brand Icon Header */}
        <div className="flex justify-center">
          <AttendWiseLogo size={42} bg="#0f172a" color="#ffffff" />
        </div>

        {/* Large Success Animation Banner */}
        <div className="space-y-4">
          <div className="mx-auto h-14 w-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-black tracking-tight text-zinc-900">Your Semester is Ready</h2>
            <p className="text-xs text-zinc-500 font-semibold">We've successfully configured your active term timetable and calendar.</p>
          </div>
        </div>

        {/* Explanation text */}
        <p className="text-xs leading-relaxed text-zinc-500 font-semibold bg-zinc-50/50 p-4 border border-zinc-200 rounded-xl">
          Next, you will initialize your current class attendance status. Entering conducted and attended counts up to today activates attendance margin calculations and dashboard indicators.
        </p>

        {/* Primary Action Button */}
        <motion.button
          onClick={handleContinue}
          whileHover={{ y: -1, boxShadow: "0 6px 18px rgba(15,23,42,0.16)" }}
          whileTap={{ y: 0, scale: 0.99, boxShadow: "0 2px 6px rgba(15,23,42,0.08)" }}
          transition={{ duration: 0.16 }}
          className="w-full h-11 rounded-xl bg-zinc-900 text-xs font-bold text-white shadow-sm hover:bg-zinc-800 transition-all cursor-pointer flex items-center justify-center space-x-1.5 select-none"
        >
          <span>Continue to Initialize Attendance</span>
          <ArrowRight className="h-4 w-4" />
        </motion.button>

      </div>
    </div>
  );
};

export default SetupComplete;
