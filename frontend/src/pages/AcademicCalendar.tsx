import React from "react";

export interface EventTypeDefinition {
  value: string;
  label: string;
  category: string;
  default_schedule_effect: "keep_lectures" | "replace_lectures" | "override_timetable" | "KEEP_LECTURES" | "REPLACE_LECTURES" | "OVERRIDE_TIMETABLE";
}

export const EVENT_TYPES: EventTypeDefinition[] = [
  { value: "holiday", label: "Holiday", category: "Holiday", default_schedule_effect: "replace_lectures" },
  { value: "college_closure", label: "Campus Closure", category: "College Closure", default_schedule_effect: "replace_lectures" },
  { value: "exam_day", label: "Examination Session", category: "Assessment", default_schedule_effect: "replace_lectures" },
  { value: "exam_break", label: "Preparatory Break", category: "Assessment", default_schedule_effect: "replace_lectures" },
  { value: "working_day_override", label: "Working Day Override", category: "Working Day Override", default_schedule_effect: "override_timetable" },
  { value: "ST", label: "ST (Sessional Test)", category: "ST", default_schedule_effect: "replace_lectures" },
  { value: "FA", label: "FA (Final Assessment)", category: "FA", default_schedule_effect: "keep_lectures" },
  { value: "CE", label: "CE (Continuous Evaluation)", category: "CE", default_schedule_effect: "keep_lectures" },
];

export const AcademicCalendar: React.FC = () => {
  return null;
};

export default AcademicCalendar;
