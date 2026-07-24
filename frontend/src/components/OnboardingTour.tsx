import React, { useState, useEffect } from "react";
import { ChevronRight, ChevronLeft, X, Sparkles } from "lucide-react";

interface TourStep {
  targetSelector: string;
  title: string;
  description: string;
  position: "top" | "bottom" | "left" | "right";
}

export const OnboardingTour: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  
  const steps: TourStep[] = [
    {
      targetSelector: 'a[href="/dashboard"]',
      title: "Dashboard",
      description: "Welcome to your AttendWise workspace! Get a real-time summary of today's schedule, attendance health, upcoming exams, and planner warnings.",
      position: "bottom"
    },
    {
      targetSelector: 'a[href="/tracker"]',
      title: "Daily Tracker",
      description: "Log your attendance for conducted lectures. Marked classes seed your statistics, helping you monitor present/absent counts.",
      position: "bottom"
    },
    {
      targetSelector: 'a[href="/summary"]',
      title: "Attendance Summary",
      description: "Analyze individual subject statistics, check how many 'safe bunks' you have left, and configure minimum attendance targets.",
      position: "bottom"
    },
    {
      targetSelector: 'a[href="/planner"]',
      title: "Leave Planner",
      description: "Simulate future absences before you take them. Our engine projects attendance safely without touching live database records.",
      position: "bottom"
    },
    {
      targetSelector: 'a[href="/assistant"]',
      title: "AI Leave Assistant",
      description: "Ask scheduling and leave questions in natural language. Plan bunks and analyze attendance using interactive Gemini-powered logic.",
      position: "bottom"
    },
    {
      targetSelector: 'a[href="/settings"]',
      title: "Settings & Customization",
      description: "Start new semesters, switch color themes (Light/Dark/System), replace timelines, or manage your account details.",
      position: "bottom"
    }
  ];

  useEffect(() => {
    // Check if user has already completed the tour
    const completed = localStorage.getItem("onboarding_tour_completed");
    const setupCompleted = localStorage.getItem("wizard_setup_completed") === "true";
    
    // Automatically trigger if setup is finished and tour wasn't completed
    if (setupCompleted && completed !== "true") {
      setIsOpen(true);
      setCurrentStep(0);
    }

    // Custom event listener to replay tour anytime from Settings
    const handleReplay = () => {
      setIsOpen(true);
      setCurrentStep(0);
    };
    window.addEventListener("replay-product-tour", handleReplay);
    return () => window.removeEventListener("replay-product-tour", handleReplay);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      setCoords(null);
      return;
    }

    const updateCoords = () => {
      const step = steps[currentStep];
      const element = document.querySelector(step.targetSelector);
      if (element) {
        const rect = element.getBoundingClientRect();
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height
        });
        // Scroll target into view gently
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        // Target element not found on page, center tooltip on screen
        setCoords(null);
      }
    };

    updateCoords();
    window.addEventListener("resize", updateCoords);
    window.addEventListener("scroll", updateCoords);
    return () => {
      window.removeEventListener("resize", updateCoords);
      window.removeEventListener("scroll", updateCoords);
    };
  }, [isOpen, currentStep]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem("onboarding_tour_completed", "true");
    setIsOpen(false);
  };

  if (!isOpen) return null;

  const currentStepData = steps[currentStep];

  // Calculate tooltip placement style
  let tooltipStyle: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    zIndex: 9999
  };

  if (coords) {
    const space = 12;
    if (currentStepData.position === "bottom") {
      tooltipStyle = {
        position: "absolute",
        top: `${coords.top + coords.height + space}px`,
        left: `${coords.left + coords.width / 2}px`,
        transform: "translateX(-50%)",
        zIndex: 9999
      };
    }
  }

  return (
    <>
      {/* Background Spotlight Overlay */}
      <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-[1px] pointer-events-auto" onClick={handleComplete} />

      {/* Spotlight highlight overlay */}
      {coords && (
        <div
          className="absolute z-50 rounded-lg pointer-events-none ring-[9999px] ring-black/45 transition-all duration-300 shadow-[0_0_15px_rgba(255,255,255,0.4)]"
          style={{
            top: `${coords.top - 4}px`,
            left: `${coords.left - 4}px`,
            width: `${coords.width + 8}px`,
            height: `${coords.height + 8}px`
          }}
        />
      )}

      {/* Tooltip Box */}
      <div
        className="w-80 bg-card border border-border rounded-xl p-5 shadow-2xl space-y-4 animate-scale-in text-foreground"
        style={tooltipStyle}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/60 pb-2.5">
          <div className="flex items-center space-x-1.5 text-primary">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-wider">{currentStepData.title}</span>
          </div>
          <button onClick={handleComplete} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body Description */}
        <p className="text-xs leading-relaxed text-muted-foreground">
          {currentStepData.description}
        </p>

        {/* Footer controls */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-muted-foreground font-semibold">
            {currentStep + 1} of {steps.length}
          </span>

          <div className="flex items-center space-x-2">
            {currentStep > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center h-7 w-7 rounded-lg border border-border bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={handleNext}
              className="rounded-lg bg-primary py-1 px-3 text-xs font-bold text-primary-foreground hover:bg-neutral-800 transition-all cursor-pointer flex items-center space-x-0.5"
            >
              <span>{currentStep === steps.length - 1 ? "Finish" : "Next"}</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
