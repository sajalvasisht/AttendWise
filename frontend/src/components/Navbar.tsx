import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { LogOut, Search } from "lucide-react";
import { SearchOverlay } from "./SearchOverlay";
import { NotificationCenter } from "./NotificationCenter";
import { AttendWiseLogo } from "./AttendWiseLogo";

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const linkClass = (path: string) => `
    text-xs font-bold px-3.5 py-2 rounded-[12px] transition-all duration-200
    ${isActive(path) 
      ? "bg-zinc-900 text-white shadow-[0_2px_8px_rgba(15,23,42,0.12)]" 
      : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100/60"
    }
  `;

  return (
    <header className="border-b border-zinc-100 bg-white/95 backdrop-blur-md sticky top-0 z-50 shadow-[0_1px_3px_rgba(15,23,42,0.01)]">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link to="/dashboard" className="flex items-center space-x-2.5 group">
            <AttendWiseLogo size={30} bg="#0f172a" color="#ffffff" />
            <span className="font-bold text-sm tracking-tight text-zinc-950">
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

        <div className="flex items-center space-x-4">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="h-9 w-9 rounded-xl border border-zinc-200/60 bg-white hover:bg-zinc-50 flex items-center justify-center text-zinc-400 hover:text-zinc-800 transition-all cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
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
                className="h-8 w-8 rounded-full object-cover border border-zinc-200 group-hover:border-zinc-400 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
              />
            ) : (
              <div className="h-8 w-8 rounded-full bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center justify-center text-xs font-bold uppercase group-hover:border-zinc-450 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                {(user?.full_name || user?.email || "U")[0]}
              </div>
            )}
            <span className="hidden sm:inline text-xs text-zinc-500 group-hover:text-zinc-900 font-bold transition-colors">
              {user?.full_name || user?.email}
            </span>
          </Link>

          <button
            onClick={logout}
            className="flex items-center space-x-1.5 text-xs text-zinc-400 hover:text-zinc-700 transition-colors py-2 px-3 rounded-xl hover:bg-zinc-100/60 cursor-pointer font-bold"
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
