import { useMemo, useRef } from 'react';
import type { LectureEvent } from '../../types/schedule';
import {
  formatDayHeading,
  formatStartsIn,
  nowInRiga,
  timeToMinutes,
  todayIso,
} from '../../lib/dates';
import { locationSummary } from '../../lib/location';
import { groupOverlappingClusters } from '../../lib/calendar/overlaps';
import { LectureCard } from './LectureCard';
import { MobileDateStrip } from './MobileDateStrip';
import './DayAgenda.css';

interface Props {
  selectedDate: string;
  weekStart: string;
  events: LectureEvent[];
  onSelectDate: (date: string) => void;
  onSelectEvent: (event: LectureEvent) => void;
  showNextUp?: boolean;
  onSwipeDay?: (direction: -1 | 1) => void;
}

export function DayAgenda({
  selectedDate,
  weekStart,
  events,
  onSelectDate,
  onSelectEvent,
  showNextUp,
  onSwipeDay,
}: Props) {
  const touchX = useRef<number | null>(null);
  const dayEvents = useMemo(
    () =>
      events
        .filter((e) => e.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [events, selectedDate],
  );

  const clusters = useMemo(
    () => groupOverlappingClusters(dayEvents),
    [dayEvents],
  );

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of events) {
      map[e.date] = (map[e.date] ?? 0) + 1;
    }
    return map;
  }, [events]);

  const nextUp = useMemo(() => {
    if (!showNextUp || selectedDate !== todayIso()) return null;
    const { time } = nowInRiga();
    const nowMin = timeToMinutes(time);
    return (
      dayEvents.find((e) => timeToMinutes(e.endTime) > nowMin) ?? null
    );
  }, [dayEvents, selectedDate, showNextUp]);

  return (
    <section
      className="day-agenda"
      onTouchStart={(e) => {
        touchX.current = e.changedTouches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null || !onSwipeDay) return;
        const x = e.changedTouches[0]?.clientX ?? touchX.current;
        const delta = x - touchX.current;
        if (Math.abs(delta) > 50) onSwipeDay(delta < 0 ? 1 : -1);
        touchX.current = null;
      }}
    >
      <MobileDateStrip
        selectedDate={selectedDate}
        weekStart={weekStart}
        onSelect={onSelectDate}
        eventCounts={counts}
      />

      <h2 className="day-agenda__heading">{formatDayHeading(selectedDate)}</h2>

      {nextUp && (
        <div className="next-up">
          <p className="next-up__label">Nākamā lekcija</p>
          <p className="next-up__time">{nextUp.startTime}</p>
          <p className="next-up__title">{nextUp.courseName}</p>
          <p className="next-up__meta">{locationSummary(nextUp)}</p>
          <p className="next-up__eta">
            {formatStartsIn(nowInRiga().time, nextUp.startTime)}
          </p>
        </div>
      )}

      {dayEvents.length === 0 ? (
        <div className="empty-day">
          <p>
            {selectedDate === todayIso()
              ? 'Šodien lekciju nav 🎉'
              : 'Šajā dienā lekciju nav.'}
          </p>
        </div>
      ) : (
        <div className="day-agenda__list">
          {clusters.map((group) => {
            const time = group[0]!.startTime;
            return (
              <div key={`${time}-${group.map((e) => e.id).join('-')}`} className="day-agenda__slot">
                <div className="day-agenda__slot-time" aria-hidden>
                  {time}
                </div>
                <div
                  className="day-agenda__overlap-group"
                  style={{
                    gridTemplateColumns: `repeat(${group.length}, minmax(180px, 1fr))`,
                  }}
                >
                  {group.map((event) => (
                    <LectureCard
                      key={event.id}
                      event={event}
                      onSelect={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
