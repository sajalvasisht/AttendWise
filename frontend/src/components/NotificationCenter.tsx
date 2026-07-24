import React, { useState, useEffect, useRef } from "react";
import { Bell, AlertTriangle, AlertCircle, Info, CheckCircle2, Loader2 } from "lucide-react";
import api from "../services/api";

export const NotificationCenter: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [readIds, setReadIds] = useState<string[]>(() => {
    return JSON.parse(localStorage.getItem("read_notifications") || "[]");
  });
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotifications();
    
    // Close dropdown on click outside
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const res = await api.get("/notifications");
      setNotifications(res.data);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = (id: string) => {
    const updated = [...readIds, id];
    setReadIds(updated);
    localStorage.setItem("read_notifications", JSON.stringify(updated));
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((n) => n.id);
    const updated = Array.from(new Set([...readIds, ...allIds]));
    setReadIds(updated);
    localStorage.setItem("read_notifications", JSON.stringify(updated));
  };

  const unreadNotifications = notifications.filter((n) => !readIds.includes(n.id));
  const hasUnread = unreadNotifications.length > 0;

  return (
    <div className="relative" ref={dropdownRef}>
      
      {/* Trigger Icon */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) fetchNotifications();
        }}
        className="relative h-8 w-8 rounded-lg border border-border bg-background hover:bg-muted/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-all cursor-pointer shadow-sm"
      >
        <Bell className="h-4 w-4" />
        {hasUnread && (
          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive border border-card ring-1 ring-destructive/20 animate-pulse" />
        )}
      </button>

      {/* Dropdown Container */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 max-h-[400px] border border-border bg-card rounded-xl shadow-lg flex flex-col z-50 overflow-hidden animate-scale-in">
          
          {/* Header */}
          <div className="px-4 py-3 border-b border-border/80 flex items-center justify-between bg-muted/30">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold text-foreground">Notifications</span>
              {hasUnread && (
                <span className="text-[10px] font-bold bg-destructive/10 text-destructive border border-destructive/20 rounded-full px-1.5 py-0.5">
                  {unreadNotifications.length} new
                </span>
              )}
            </div>
            {hasUnread && (
              <button
                onClick={markAllAsRead}
                className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-border/60">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-10 text-xs text-muted-foreground space-x-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                <span>Checking status...</span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map((n) => {
                const isRead = readIds.includes(n.id);
                
                // Color mapping
                let alertColor = "text-blue-500 bg-blue-500/10 border-blue-500/10";
                let Icon = Info;

                if (n.type === "warning") {
                  alertColor = "text-amber-500 bg-amber-500/10 border-amber-500/10";
                  Icon = AlertTriangle;
                } else if (n.type === "error") {
                  alertColor = "text-destructive bg-destructive/10 border-destructive/10";
                  Icon = AlertCircle;
                } else if (n.type === "success") {
                  alertColor = "text-emerald-600 bg-emerald-500/10 border-emerald-500/10";
                  Icon = CheckCircle2;
                }

                return (
                  <div
                    key={n.id}
                    className={`p-3.5 flex items-start space-x-3 transition-colors ${
                      isRead ? "opacity-60 hover:opacity-100" : "bg-muted/10 hover:bg-muted/20"
                    }`}
                  >
                    <div className={`h-6.5 w-6.5 rounded flex items-center justify-center border shrink-0 ${alertColor}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-bold text-foreground leading-snug">{n.title}</h4>
                        {!isRead && (
                          <button
                            onClick={() => markAsRead(n.id)}
                            className="text-[10px] text-muted-foreground hover:text-foreground font-semibold cursor-pointer"
                          >
                            Mark Read
                          </button>
                        )}
                      </div>
                      <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{n.description}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 space-y-1 text-muted-foreground">
                <p className="text-xs font-bold">All caught up!</p>
                <p className="text-[10px]">No new notifications or warnings.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
