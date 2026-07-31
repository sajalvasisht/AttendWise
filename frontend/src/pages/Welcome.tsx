import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GraduationCap, ChevronRight, ChevronLeft, Calendar, Compass, BarChart3, Bot } from "lucide-react";

interface IntroSlide {
  title: string;
  tagline: string;
  description: string;
  icon: React.ComponentType<any>;
  badgeText: string;
  featureCard: {
    title: string;
    description: string;
    details: string[];
  };
}

const Welcome: React.FC = () => {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides: IntroSlide[] = [
    {
      title: "Welcome to AttendWise",
      tagline: "Track your attendance, plan leaves, and stay above target requirements.",
      description: "AttendWise helps you coordinate weekly schedules, calculate safe absences, and simulate leave dates without manual calculations.",
      icon: GraduationCap,
      badgeText: "Overview",
      featureCard: {
        title: "Intelligent Class Tracker",
        description: "Everything you need to stay on track is centralized in a simple dashboard.",
        details: [
          "Real-time attendance percentage tracking across all courses.",
          "Automatic calendar exception checks (holidays, exams, and leaves).",
          "Clean visual indicators showing if your standing is safe or warning-level."
        ]
      }
    },
    {
      title: "Attendance Margins",
      tagline: "Know exactly how many classes you can safely miss.",
      description: "Monitor overall and course-specific attendance averages and targets automatically. Get rid of spreadsheet calculations.",
      icon: BarChart3,
      badgeText: "Margins",
      featureCard: {
        title: "Absence Forecasts",
        description: "Understand exactly where you stand and what targets you must achieve next.",
        details: [
          "Check course standings: see how many classes you can safely miss.",
          "Get recovery guides: know exactly how many consecutive lectures to attend.",
          "Track detailed statistics: conducted, attended, and cancelled class totals."
        ]
      }
    },
    {
      title: "Smart Leave Planning",
      tagline: "Simulate leave dates and check target updates.",
      description: "Model absences before you take them to verify if you will remain above target requirements.",
      icon: Compass,
      badgeText: "Simulation",
      featureCard: {
        title: "Absence Projections",
        description: "Map leave dates and immediately see the projected impact on your courses.",
        details: [
          "Select start and end dates to run leave planning projections.",
          "Compare pre-simulation standing with future simulated standings.",
          "Receive alerts if a planned absence drops you below target thresholds."
        ]
      }
    },
    {
      title: "Timetable Upload",
      tagline: "Extract schedules from academic documents.",
      description: "Upload your class timetable PDF or image. We generate your semester calendar schedule automatically.",
      icon: Calendar,
      badgeText: "Automation",
      featureCard: {
        title: "Intelligent Timetable Parser",
        description: "Skip manual entry and configure your entire semester calendar in one click.",
        details: [
          "Automatic extraction of recurring weekly timetable slots.",
          "Deduction of academic calendar holidays and exam blocks.",
          "Instant seeding of the monthly schedule tracker grid."
        ]
      }
    },
    {
      title: "AI Academic Assistant",
      tagline: "Ask schedule questions in plain English.",
      description: "Consult the AI assistant to forecast leaves or check dates using natural conversation.",
      icon: Bot,
      badgeText: "AI Assistant",
      featureCard: {
        title: "Conversational Insights",
        description: "Ask questions naturally and get explainable planner calculations in return.",
        details: [
          "Ask queries like: 'Can I miss science tomorrow?' or 'Suggest leaves next week.'",
          "Access persistent, date-grouped conversation records.",
          "Get clean, human-friendly responses backed by actual database logic."
        ]
      }
    }
  ];

  const handleNext = () => {
    if (currentSlide < slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      handleFinishOnboarding();
    }
  };

  const handleBack = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const handleFinishOnboarding = () => {
    localStorage.setItem("wizard_setup_completed", "false"); // Ensure setup wizard runs next
    navigate("/setup?mode=new");
  };

  const activeSlide = slides[currentSlide];
  const IconComponent = activeSlide.icon;

  return (
    <div className="min-h-screen bg-background text-foreground antialiased selection:bg-accent selection:text-foreground flex flex-col justify-center items-center px-6 py-12 relative overflow-hidden">
      
      {/* Decorative Blur Orbs */}
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 h-85 w-85 rounded-full bg-blue-500/5 blur-[120px] pointer-events-none" />

      {/* Outer Wrapper */}
      <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-center z-10">
        
        {/* Left Side: Copy & Narrative (7 cols) */}
        <div className="md:col-span-7 space-y-6">
          <div className="flex items-center space-x-2.5">
            <span className="text-[9px] font-bold text-primary uppercase tracking-widest bg-primary/10 border border-primary/20 px-2.5 py-1 rounded-full">
              {activeSlide.badgeText}
            </span>
            <span className="text-[10px] text-muted-foreground font-semibold">
              Step {currentSlide + 1} of {slides.length}
            </span>
          </div>

          <div className="space-y-3.5">
            <h1 className="text-3xl font-extrabold tracking-tight text-foreground leading-tight">
              {activeSlide.title}
            </h1>
            <p className="text-sm font-semibold text-muted-foreground">
              {activeSlide.tagline}
            </p>
            <p className="text-xs leading-relaxed text-muted-foreground max-w-md">
              {activeSlide.description}
            </p>
          </div>

          {/* Indicators dots */}
          <div className="flex items-center space-x-2 py-2">
            {slides.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlide(idx)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentSlide === idx ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground/45"
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center space-x-4 pt-2">
            {currentSlide > 0 && (
              <button
                onClick={handleBack}
                className="flex items-center justify-center h-9 w-9 rounded-xl border border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition-all cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}

            <button
              onClick={handleNext}
              className="rounded-xl bg-primary py-2.5 px-6 text-xs font-bold text-primary-foreground hover:bg-neutral-800 transition-all cursor-pointer flex items-center space-x-1.5 shadow-sm active:scale-[0.98]"
            >
              <span>{currentSlide === slides.length - 1 ? "Start Onboarding" : "Continue"}</span>
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={handleFinishOnboarding}
              className="text-xs font-bold text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              Skip Walkthrough
            </button>
          </div>
        </div>

        {/* Right Side: Interactive Feature Showcase Card (5 cols) */}
        <div className="md:col-span-5 bg-card border border-border rounded-2xl p-6 shadow-xl space-y-5 animate-scale-in relative overflow-hidden" key={currentSlide}>
          {/* Decorative faint glow */}
          <div className="absolute top-0 right-0 h-24 w-24 rounded-full bg-primary/5 blur-2xl pointer-events-none" />

          {/* Card Header */}
          <div className="flex items-center space-x-3 pb-3 border-b border-border/60">
            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shrink-0">
              <IconComponent className="h-5 w-5" />
            </div>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{activeSlide.featureCard.title}</h3>
          </div>

          {/* Card Description */}
          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeSlide.featureCard.description}
          </p>

          {/* Details list */}
          <ul className="space-y-3 pt-1">
            {activeSlide.featureCard.details.map((detail, idx) => (
              <li key={idx} className="flex items-start space-x-2.5 text-xs text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1.5" />
                <span className="leading-relaxed text-muted-foreground font-medium">{detail}</span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default Welcome;
