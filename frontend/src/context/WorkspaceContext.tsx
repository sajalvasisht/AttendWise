import React, { createContext, useContext, useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { semesterService } from "../services/semester";
import type { Semester } from "../services/semester";
import { attendanceService } from "../services/attendance";
import type { OverallAttendanceStats, SubjectAttendanceStats, LectureOccurrence } from "../services/attendance";
import { calendarService } from "../services/calendar";
import type { CalendarEvent } from "../services/calendar";
import { useAuth } from "../hooks/useAuth";

interface WorkspaceContextType {
  semester: Semester | null;
  subjects: SubjectAttendanceStats[];
  overallStats: OverallAttendanceStats | null;
  todayLectures: LectureOccurrence[];
  calendarEvents: CalendarEvent[];
  loading: boolean;        // True ONLY on initial cold load when no workspace data exists
  refreshing: boolean;     // True during background refresh
  error: string | null;
  isNoSemester: boolean;
  refreshWorkspace: (force?: boolean) => Promise<void>;
  refreshStats: () => Promise<void>;
  updateAttendanceOptimistic: (occurrenceId: number, newStatus: string) => void;
  setSemesterDirectly: (sem: Semester | null) => void;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

// Session storage keys for instant SPA persistence across page unmount/remount
const STORAGE_KEY_SEM = "attendwise_ws_sem";
const STORAGE_KEY_SUBJS = "attendwise_ws_subjs";
const STORAGE_KEY_OVERALL = "attendwise_ws_overall";
const STORAGE_KEY_TODAY = "attendwise_ws_today";
const STORAGE_KEY_EVENTS = "attendwise_ws_events";

const getStoredJSON = <T,>(key: string, fallback: T): T => {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setStoredJSON = (key: string, data: any) => {
  try {
    if (data !== null && data !== undefined) {
      sessionStorage.setItem(key, JSON.stringify(data));
    } else {
      sessionStorage.removeItem(key);
    }
  } catch {}
};

export const WorkspaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();

  const [semester, setSemester] = useState<Semester | null>(() => getStoredJSON<Semester | null>(STORAGE_KEY_SEM, null));
  const [subjects, setSubjects] = useState<SubjectAttendanceStats[]>(() => getStoredJSON<SubjectAttendanceStats[]>(STORAGE_KEY_SUBJS, []));
  const [overallStats, setOverallStats] = useState<OverallAttendanceStats | null>(() => getStoredJSON<OverallAttendanceStats | null>(STORAGE_KEY_OVERALL, null));
  const [todayLectures, setTodayLectures] = useState<LectureOccurrence[]>(() => getStoredJSON<LectureOccurrence[]>(STORAGE_KEY_TODAY, []));
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => getStoredJSON<CalendarEvent[]>(STORAGE_KEY_EVENTS, []));

  // If we already have stored data in session, initial loading is false!
  const hasExistingData = semester !== null || subjects.length > 0;
  const [loading, setLoading] = useState<boolean>(!hasExistingData);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isNoSemester, setIsNoSemester] = useState<boolean>(false);

  // Request counter to guard against stale out-of-order responses (Request A vs Request B)
  const requestIdRef = useRef<number>(0);
  const lastFetchTimeRef = useRef<number>(0);

  // Clear workspace data on logout / unauthenticated state
  useEffect(() => {
    if (!token || !isAuthenticated) {
      setSemester(null);
      setSubjects([]);
      setOverallStats(null);
      setTodayLectures([]);
      setCalendarEvents([]);
      setLoading(false);
      setRefreshing(false);
      setError(null);
      setIsNoSemester(false);
      sessionStorage.removeItem(STORAGE_KEY_SEM);
      sessionStorage.removeItem(STORAGE_KEY_SUBJS);
      sessionStorage.removeItem(STORAGE_KEY_OVERALL);
      sessionStorage.removeItem(STORAGE_KEY_TODAY);
      sessionStorage.removeItem(STORAGE_KEY_EVENTS);
    }
  }, [token, isAuthenticated]);

  const refreshWorkspace = async (force: boolean = false) => {
    if (!isAuthenticated || !token) return;

    // Throttle background refresh if fetched less than 15s ago unless forced
    const now = Date.now();
    if (!force && hasExistingData && (now - lastFetchTimeRef.current < 15000)) {
      return;
    }

    const currentReqId = ++requestIdRef.current;
    
    // If we don't have any cached data, show initial loading skeleton.
    // If we DO have cached data, keep existing UI visible and set refreshing flag.
    if (!hasExistingData && !semester) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }
    setError(null);

    try {
      const sems = await semesterService.list();

      // Guard: Discard stale out-of-order response
      if (currentReqId !== requestIdRef.current) return;

      // Contract Requirement: ONLY treat user as having no setup when HTTP 200 OK returns []
      if (Array.isArray(sems) && sems.length === 0) {
        setIsNoSemester(true);
        setSemester(null);
        setSubjects([]);
        setOverallStats(null);
        setTodayLectures([]);
        setCalendarEvents([]);
        setLoading(false);
        setRefreshing(false);
        sessionStorage.removeItem(STORAGE_KEY_SEM);
        return;
      }

      setIsNoSemester(false);
      const activeSem = sems.find(s => s.is_active) || sems[sems.length - 1] || sems[0];
      if (!activeSem) {
        setIsNoSemester(true);
        setSemester(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      setSemester(activeSem);
      setStoredJSON(STORAGE_KEY_SEM, activeSem);

      // Fetch primary workspace data in parallel using Promise.allSettled
      const [subjsRes, todayRes, eventsRes, summaryRes] = await Promise.allSettled([
        attendanceService.getSubjectsAttendance(activeSem.id),
        attendanceService.getToday(activeSem.id),
        calendarService.list(activeSem.id),
        attendanceService.getSummary(activeSem.id)
      ]);

      // Guard: Discard stale out-of-order response
      if (currentReqId !== requestIdRef.current) return;

      if (subjsRes.status === "fulfilled") {
        setSubjects(subjsRes.value);
        setStoredJSON(STORAGE_KEY_SUBJS, subjsRes.value);
      }

      if (todayRes.status === "fulfilled") {
        setTodayLectures(todayRes.value);
        setStoredJSON(STORAGE_KEY_TODAY, todayRes.value);
      }

      if (eventsRes.status === "fulfilled") {
        setCalendarEvents(eventsRes.value);
        setStoredJSON(STORAGE_KEY_EVENTS, eventsRes.value);
      }

      if (summaryRes.status === "fulfilled") {
        setOverallStats(summaryRes.value);
        setStoredJSON(STORAGE_KEY_OVERALL, summaryRes.value);
      }

      lastFetchTimeRef.current = Date.now();
    } catch (err: any) {
      // Guard: Discard stale out-of-order response
      if (currentReqId !== requestIdRef.current) return;

      console.error("[WorkspaceContext] Refresh error (preserving existing data):", err);
      // Transient error: DO NOT erase valid stored workspace state or set isNoSemester
      setError("Couldn't refresh workspace data. The server may be starting up.");
    } finally {
      if (currentReqId === requestIdRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  // Trigger initial workspace load on login / mount
  useEffect(() => {
    if (isAuthenticated && token) {
      refreshWorkspace();
    }
  }, [isAuthenticated, token]);

  const updateAttendanceOptimistic = (occurrenceId: number, newStatus: string) => {
    setTodayLectures(prev => prev.map(occ => 
      occ.id === occurrenceId ? { ...occ, attendance_status: newStatus as any } : occ
    ));
  };

  const setSemesterDirectly = (sem: Semester | null) => {
    setSemester(sem);
    setStoredJSON(STORAGE_KEY_SEM, sem);
  };

  const refreshStats = async () => {
    if (!semester) return;
    try {
      const [subjsRes, summaryRes] = await Promise.allSettled([
        attendanceService.getSubjectsAttendance(semester.id),
        attendanceService.getSummary(semester.id)
      ]);
      if (subjsRes.status === "fulfilled") {
        setSubjects(subjsRes.value);
        setStoredJSON(STORAGE_KEY_SUBJS, subjsRes.value);
      }
      if (summaryRes.status === "fulfilled") {
        setOverallStats(summaryRes.value);
        setStoredJSON(STORAGE_KEY_OVERALL, summaryRes.value);
      }
    } catch (e) {
      console.warn("[WorkspaceContext] refreshStats error:", e);
    }
  };

  return (
    <WorkspaceContext.Provider value={{
      semester,
      subjects,
      overallStats,
      todayLectures,
      calendarEvents,
      loading,
      refreshing,
      error,
      isNoSemester,
      refreshWorkspace,
      refreshStats,
      updateAttendanceOptimistic,
      setSemesterDirectly
    }}>
      {children}
    </WorkspaceContext.Provider>
  );
};

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
};
