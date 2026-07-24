import React, { useState, useEffect, useRef } from "react";
import { Search, X, BookOpen, Calendar, CheckSquare, Compass, Loader2 } from "lucide-react";
import { subjectService } from "../services/subject";
import { calendarService } from "../services/calendar";
import { semesterService } from "../services/semester";
import { useNavigate } from "react-router-dom";

interface SearchOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  category: "Subject" | "Event" | "Attendance" | "Plan";
  title: string;
  subtitle: string;
  link: string;
}

export const SearchOverlay: React.FC<SearchOverlayProps> = ({ isOpen, onClose }) => {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Cached data for local instant search
  const [subjects, setSubjects] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setResults([]);
      fetchSearchPool();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Handle hotkeys (Esc to close)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const fetchSearchPool = async () => {
    setLoading(true);
    try {
      const sems = await semesterService.list();
      const active = sems.find((s) => s.is_active) || sems[sems.length - 1];
      if (active) {
        // Load data in parallel
        const [subjs, evs] = await Promise.all([
          subjectService.list(active.id),
          calendarService.list(active.id),
        ]);
        setSubjects(subjs);
        setEvents(evs);
      }
    } catch (err) {
      console.error("Failed to load search index pool:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const lowerQuery = query.toLowerCase();
    const searchHits: SearchResult[] = [];

    // 1. Search Subjects
    subjects.forEach((sub) => {
      if (
        sub.name.toLowerCase().includes(lowerQuery) ||
        (sub.code && sub.code.toLowerCase().includes(lowerQuery)) ||
        (sub.faculty && sub.faculty.toLowerCase().includes(lowerQuery))
      ) {
        searchHits.push({
          id: `sub-${sub.id}`,
          category: "Subject",
          title: `${sub.name} (${sub.code || "No Code"})`,
          subtitle: `Faculty: ${sub.faculty || "Not set"} | Min Required: ${sub.min_attendance_percent}%`,
          link: "/summary",
        });
      }
    });

    // 2. Search Calendar Events
    events.forEach((ev) => {
      if (
        ev.description?.toLowerCase().includes(lowerQuery) ||
        ev.event_type.toLowerCase().includes(lowerQuery)
      ) {
        searchHits.push({
          id: `event-${ev.id}`,
          category: "Event",
          title: ev.description || "Academic Event",
          subtitle: `${ev.date} | Type: ${ev.event_type.toUpperCase()}`,
          link: "/tracker",
        });
      }
    });

    setResults(searchHits.slice(0, 10)); // Limit to top 10 results
  }, [query, subjects, events]);

  const handleResultClick = (link: string) => {
    onClose();
    navigate(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-start justify-center p-4 sm:p-10 pt-16 sm:pt-28">
      
      {/* Search Card Container */}
      <div className="max-w-xl w-full border border-border bg-card rounded-xl shadow-2xl flex flex-col overflow-hidden max-h-[75vh] animate-scale-in">
        
        {/* Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-border/80 relative">
          <Search className="h-4.5 w-4.5 text-muted-foreground mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search subjects, events, plans..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm text-foreground outline-none border-none placeholder:text-muted-foreground/60 w-full"
          />
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/50 mr-2" />
          ) : (
            query && (
              <button onClick={() => setQuery("")} className="mr-2 text-muted-foreground hover:text-foreground cursor-pointer">
                <X className="h-3.5 w-3.5" />
              </button>
            )
          )}
          <button
            onClick={onClose}
            className="rounded bg-muted hover:bg-accent border border-border/80 px-1.5 py-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-all cursor-pointer font-bold"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[150px]">
          {results.length > 0 ? (
            <div className="space-y-1.5">
              {results.map((res) => {
                const CategoryIcon =
                  res.category === "Subject"
                    ? BookOpen
                    : res.category === "Event"
                    ? Calendar
                    : res.category === "Plan"
                    ? Compass
                    : CheckSquare;

                return (
                  <button
                    key={res.id}
                    onClick={() => handleResultClick(res.link)}
                    className="w-full rounded-lg hover:bg-muted/80 p-3 text-left flex items-start space-x-3 transition-colors cursor-pointer group"
                  >
                    <div className="h-7 w-7 rounded bg-secondary border border-border flex items-center justify-center text-muted-foreground shrink-0 group-hover:text-foreground group-hover:border-foreground/10">
                      <CategoryIcon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-foreground truncate">{res.title}</h4>
                        <span className="text-[9px] uppercase tracking-wider text-muted-foreground bg-secondary px-1.5 py-0.5 rounded border border-border">
                          {res.category}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{res.subtitle}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : query.trim() ? (
            <div className="text-center py-12 space-y-1 text-muted-foreground animate-fade-in">
              <p className="text-xs font-bold">No results found</p>
              <p className="text-[10px]">Try searching for subjects or exams by name.</p>
            </div>
          ) : (
            <div className="text-center py-12 space-y-2 text-muted-foreground animate-fade-in">
              <Search className="h-6 w-6 mx-auto opacity-30" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold">Search AttendWise</p>
                <p className="text-[10px]">Type to find subjects, holidays, or simulated leaves instantly.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
