import React, { useState } from "react";
import { MessageSquare, X, Bug, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const BUG_REPORT_URL = (import.meta as any).env?.VITE_FEEDBACK_BUG_URL || "https://forms.gle/bug-placeholder";
const FEATURE_SUGGEST_URL = (import.meta as any).env?.VITE_FEEDBACK_FEATURE_URL || "https://forms.gle/feature-placeholder";

export const FeedbackSystem: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <motion.button
        onClick={() => setIsOpen(true)}
        whileHover={{ scale: 1.05, y: -2 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-45 h-11 px-4 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold text-xs flex items-center space-x-2 shadow-[0_8px_30px_rgb(0,0,0,0.12)] cursor-pointer select-none border border-zinc-800 transition-colors"
      >
        <MessageSquare className="h-4 w-4" />
        <span>Feedback</span>
      </motion.button>

      {/* Modal Dialog */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/20 backdrop-blur-[3px] p-6">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={() => setIsOpen(false)} />

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="bg-white rounded-[28px] border border-zinc-200/50 max-w-sm w-full p-8 shadow-[0_20px_50px_rgba(15,23,42,0.12)] space-y-6 relative z-10"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-6 right-6 p-1.5 rounded-xl text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                <X className="h-4.5 w-4.5" />
              </button>

              <div className="space-y-2.5">
                <div className="h-10 w-10 rounded-full bg-zinc-50 flex items-center justify-center text-zinc-800">
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-black text-zinc-900 leading-tight">
                    Help Improve AttendWise
                  </h3>
                  <p className="text-[12px] text-zinc-500 leading-relaxed font-medium">
                    Your feedback directly improves AttendWise. Report bugs, confusing workflows, or suggest new features.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <a
                  href={BUG_REPORT_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-between px-4 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500" />
                    Report Bug
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold font-mono">→</span>
                </a>

                <a
                  href={FEATURE_SUGGEST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-11 rounded-xl border border-zinc-200 hover:bg-zinc-50 flex items-center justify-between px-4 text-xs font-bold text-zinc-700 transition-colors cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Suggest Feature
                  </span>
                  <span className="text-[10px] text-zinc-400 font-semibold font-mono">→</span>
                </a>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
