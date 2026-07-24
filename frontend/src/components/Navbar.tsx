import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { GraduationCap, LogOut, Search } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { NotificationCenter } from "./NotificationCenter";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors
    ${isActive(path) 
      ? "bg-accent text-foreground border border-border/80" 
      : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border border-transparent"
    }
  `;

  return (
    <header className="border-b border-border bg-card sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.01)]">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/dashboard" className="flex items-center space-x-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
              <GraduationCap className="h-4.5 w-4.5 text-foreground" />
            </div>
            <span className="font-semibold text-sm tracking-tight text-foreground">
              AttendWise
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className="flex items-center space-x-1">
            <Link to="/dashboard" className={linkClass("/dashboard")}>Dashboard</Link>
            <Link to="/tracker" className={linkClass("/tracker")}>Daily Tracker</Link>
            <Link to="/summary" className={linkClass("/summary")}>Summary</Link>
            <Link to="/planner" className={linkClass("/planner")}>Leave Planner</Link>
            <Link to="/assistant" className={linkClass("/assistant")}>AI Assistant</Link>
            <Link to="/settings" className={linkClass("/settings")}>Settings</Link>
          </nav>
        </div>

        <div className="flex items-center space-x-3.5">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
            title="Global Search"
          >
            <Search className="h-4 w-4" />
          </button>

          <NotificationCenter />

          <Link to="/settings" className="flex items-center space-x-2.5 group">
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
                alt="Profile"
                className="h-7 w-7 rounded-full object-cover border border-border group-hover:border-foreground/20 transition-all"
              />
            ) : (
              <div className="h-7 w-7 rounded-full bg-accent text-accent-foreground border border-border flex items-center justify-center text-xs font-bold uppercase group-hover:border-foreground/20 transition-all">
                {(user?.full_name || user?.email || "U")[0]}
              </div>
            )}
            <span className="hidden sm:inline text-xs text-muted-foreground group-hover:text-foreground font-semibold transition-colors">
              {user?.full_name || user?.email}
            </span>
          </Link>

          <button
            onClick={logout}
            className="flex items-center space-x-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5 px-2.5 rounded-lg hover:bg-muted cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Logout</span>
          </button>
        </div>
      </div>
      {/* Global Search Overlay */}
      <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </header>
  );
};

export default Navbar;
