import { useMemo } from 'react';
import type { LectureEvent } from '../../types/schedule';
import { addDaysIso, formatDayHeading, todayIso } from '../../lib/dates';
import { LectureCard } from './LectureCard';
import './AgendaList.css';

interface Props {
  fromDate: string;
  events: LectureEvent[];
  onSelect: (event: LectureEvent) => void;
}

export function AgendaList({ fromDate, events, onSelect }: Props) {
  const upcoming = useMemo(() => {
    const end = addDaysIso(fromDate, 21);
    return events
      .filter((e) => e.date >= fromDate && e.date <= end)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime),
      );
  }, [events, fromDate]);

  const grouped = useMemo(() => {
    const map = new Map<string, LectureEvent[]>();
    for (const e of upcoming) {
      const list = map.get(e.date) ?? [];
      list.push(e);
      map.set(e.date, list);
    }
    return [...map.entries()];
  }, [upcoming]);

  if (grouped.length === 0) {
    return (
      <div className="empty-day">
        <p>Tuvākajā laikā lekciju nav.</p>
      </div>
    );
  }

  const today = todayIso();

  return (
    <div className="agenda-list">
      {grouped.map(([date, dayEvents]) => (
        <section key={date} className="agenda-list__day">
          <h3>
            {formatDayHeading(date)}
            {date === today ? ' · Šodien' : ''}
          </h3>
          <div className="agenda-list__events">
            {dayEvents.map((event) => (
              <LectureCard key={event.id} event={event} onSelect={onSelect} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
