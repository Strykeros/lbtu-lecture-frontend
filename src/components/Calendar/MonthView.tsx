import { useMemo } from 'react';
import type { LectureEvent } from '../../types/schedule';
import {
  addDaysIso,
  formatIso,
  formatMonthYear,
  parseIsoDate,
  startOfWeekMonday,
  todayIso,
} from '../../lib/dates';
import './MonthView.css';

interface Props {
  selectedDate: string;
  events: LectureEvent[];
  onSelectDate: (date: string) => void;
}

export function MonthView({ selectedDate, events, onSelectDate }: Props) {
  const { y, m } = parseIsoDate(selectedDate);
  const first = formatIso(y, m, 1);
  const start = startOfWeekMonday(first);
  const today = todayIso();

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      const { y: ey, m: em } = parseIsoDate(e.date);
      if (ey === y && em === m) {
        map[e.date] = (map[e.date] ?? 0) + 1;
      }
    }
    return map;
  }, [events, y, m]);

  const cells = Array.from({ length: 42 }, (_, i) => addDaysIso(start, i));

  return (
    <section className="month-view">
      <h2>{formatMonthYear(selectedDate)}</h2>
      <div className="month-view__weekdays" aria-hidden>
        {['P', 'O', 'T', 'C', 'Pk', 'S', 'Sv'].map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>
      <div className="month-view__grid">
        {cells.map((date) => {
          const inMonth = parseIsoDate(date).m === m;
          const count = counts[date] ?? 0;
          return (
            <button
              key={date}
              type="button"
              className={[
                'month-view__cell',
                inMonth ? '' : 'is-muted',
                date === selectedDate ? 'is-selected' : '',
                date === today ? 'is-today' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => onSelectDate(date)}
              aria-label={`${date}${count ? `, ${count} lekcijas` : ''}`}
            >
              <span>{parseIsoDate(date).d}</span>
              {count > 0 && <span className="month-view__count">{count}</span>}
            </button>
          );
        })}
      </div>
      <p className="month-view__hint">Izvēlies dienu, lai skatītu tās lekcijas.</p>
    </section>
  );
}
