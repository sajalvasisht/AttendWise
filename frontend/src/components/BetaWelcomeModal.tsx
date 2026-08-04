import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export const BetaWelcomeModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasWelcomed = localStorage.getItem("attendwise_beta_welcomed");
    if (!hasWelcomed) {
      setIsOpen(true);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem("attendwise_beta_welcomed", "true");
    setIsOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[3px] p-6">
          {/* Backdrop */}
          <div className="absolute inset-0" onClick={handleDismiss} />

          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="bg-white rounded-[28px] border border-zinc-200/50 max-w-sm w-full p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-6 relative z-10 animate-scale-in"
          >
            {/* Header */}
            <div className="space-y-3">
              <div className="h-10 w-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-900">
                <Sparkles className="h-5 w-5 text-amber-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-zinc-900 leading-tight">
                  Welcome to AttendWise Beta 👋
                </h3>
                <div className="text-[12px] text-zinc-500 leading-relaxed font-medium space-y-2">
                  <p>Thank you for helping test AttendWise.</p>
                  <p>Some features are still being refined.</p>
                  <p>If you encounter any bugs or confusing behaviour, please use the Feedback button.</p>
                  <p className="font-semibold text-zinc-700">Your feedback will directly shape future versions.</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end pt-2">
              <button
                onClick={handleDismiss}
                className="w-full h-10 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs shadow-sm transition-colors cursor-pointer select-none"
              >
                Start Exploring
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
