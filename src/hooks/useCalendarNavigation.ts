import { useCallback, useState } from 'react';
import {
  addDaysIso,
  startOfWeekMonday,
  todayIso,
} from '../lib/dates';

export type CalendarView = 'today' | 'week' | 'agenda' | 'month';

const VIEW_KEY = 'lbtu-calendar-view';
const DATE_KEY = 'lbtu-calendar-date';

function readStoredDate(): string {
  const saved = localStorage.getItem(DATE_KEY);
  if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
    return saved;
  }
  return todayIso();
}

export function useCalendarNavigation() {
  const [selectedDate, setSelectedDateState] = useState(readStoredDate);
  const [view, setViewState] = useState<CalendarView>(() => {
    const saved = localStorage.getItem(VIEW_KEY);
    if (
      saved === 'today' ||
      saved === 'week' ||
      saved === 'agenda' ||
      saved === 'month'
    ) {
      return saved;
    }
    return 'today';
  });

  const setSelectedDate = useCallback((next: string | ((prev: string) => string)) => {
    setSelectedDateState((prev) => {
      const value = typeof next === 'function' ? next(prev) : next;
      localStorage.setItem(DATE_KEY, value);
      return value;
    });
  }, []);

  const setView = useCallback((next: CalendarView) => {
    setViewState(next);
    localStorage.setItem(VIEW_KEY, next);
  }, []);

  const goToday = useCallback(() => {
    setSelectedDate(todayIso());
  }, [setSelectedDate]);

  const goPrev = useCallback(() => {
    setSelectedDate((d) => {
      if (view === 'week') return addDaysIso(startOfWeekMonday(d), -7);
      if (view === 'month') return addDaysIso(d, -28);
      if (view === 'agenda') return addDaysIso(d, -7);
      return addDaysIso(d, -1);
    });
  }, [view, setSelectedDate]);

  const goNext = useCallback(() => {
    setSelectedDate((d) => {
      if (view === 'week') return addDaysIso(startOfWeekMonday(d), 7);
      if (view === 'month') return addDaysIso(d, 28);
      if (view === 'agenda') return addDaysIso(d, 7);
      return addDaysIso(d, 1);
    });
  }, [view, setSelectedDate]);

  return {
    selectedDate,
    setSelectedDate,
    view,
    setView,
    goToday,
    goPrev,
    goNext,
    weekStart: startOfWeekMonday(selectedDate),
  };
}
