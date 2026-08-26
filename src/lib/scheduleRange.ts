import type { CalendarView } from '../hooks/useCalendarNavigation';
import {
  addDaysIso,
  formatIso,
  parseIsoDate,
  startOfWeekMonday,
} from './dates';

export interface DateRange {
  from: string;
  to: string;
}

/** Visible calendar window requested from the API for the active view. */
export function visibleScheduleRange(
  view: CalendarView,
  selectedDate: string,
): DateRange {
  if (view === 'today' || view === 'week') {
    // Today desktop also shows the week grid — fetch the week.
    const weekStart = startOfWeekMonday(selectedDate);
    return { from: weekStart, to: addDaysIso(weekStart, 6) };
  }

  if (view === 'month') {
    const { y, m } = parseIsoDate(selectedDate);
    const first = formatIso(y, m, 1);
    const gridStart = startOfWeekMonday(first);
    return { from: gridStart, to: addDaysIso(gridStart, 41) };
  }

  // Agenda: ~31 days forward from the selected date
  return { from: selectedDate, to: addDaysIso(selectedDate, 30) };
}

export function adjacentWeekRanges(weekStart: string): {
  previous: DateRange;
  next: DateRange;
} {
  const prevStart = addDaysIso(weekStart, -7);
  const nextStart = addDaysIso(weekStart, 7);
  return {
    previous: { from: prevStart, to: addDaysIso(prevStart, 6) },
    next: { from: nextStart, to: addDaysIso(nextStart, 6) },
  };
}
