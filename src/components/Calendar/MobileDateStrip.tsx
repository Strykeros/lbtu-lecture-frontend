import { addDaysIso, formatDayShort, todayIso } from '../../lib/dates';
import './MobileDateStrip.css';

interface Props {
  selectedDate: string;
  onSelect: (date: string) => void;
  weekStart: string;
  eventCounts?: Record<string, number>;
}

export function MobileDateStrip({
  selectedDate,
  onSelect,
  weekStart,
  eventCounts = {},
}: Props) {
  const today = todayIso();
  const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));

  return (
    <div className="date-strip" role="listbox" aria-label="Nedēļas dienas">
      {days.map((date) => {
        const { weekday, day } = formatDayShort(date);
        const selected = date === selectedDate;
        const isToday = date === today;
        const count = eventCounts[date] ?? 0;
        return (
          <button
            key={date}
            type="button"
            role="option"
            aria-selected={selected}
            className={`date-strip__day ${selected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
            onClick={() => onSelect(date)}
          >
            <span className="date-strip__wd">{weekday}</span>
            <span className="date-strip__num">{day}</span>
            <span
              className={`date-strip__dot ${count > 0 ? 'has-events' : ''}`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}
