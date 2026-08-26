import { useMemo } from 'react';
import type { LectureEvent } from '../../types/schedule';
import {
  addDaysIso,
  formatDayShort,
  formatWeekRange,
  minutesBetween,
  timeToMinutes,
  todayIso,
} from '../../lib/dates';
import {
  WEEK_CARD_GAP_PX,
  WEEK_MIN_CARD_WIDTH_PX,
  WEEK_TIME_GUTTER_PX,
  assignOverlapColumns,
  dayColumnMinWidthPx,
  maxOverlapColumns,
  overlapHorizontalStyle,
} from '../../lib/calendar/overlaps';
import { LectureCard } from './LectureCard';
import './WeekCalendar.css';

const DAY_START = 8 * 60; // 08:00
const DAY_END = 21 * 60; // 21:00
const PX_PER_MIN = 1.15;

interface Props {
  weekStart: string;
  events: LectureEvent[];
  onSelect: (event: LectureEvent) => void;
}

/** Content-driven floor so titles/time/room are not clipped by short slots. */
function compactContentMinHeight(event: LectureEvent): number {
  const titleCharsPerLine = 15;
  const titleLines = Math.min(
    4,
    Math.max(1, Math.ceil(event.courseName.length / titleCharsPerLine)),
  );
  const padding = 14;
  const badge = 13;
  const gaps = 6;
  const title = titleLines * 15;
  const time = 14;
  const room = event.room ? 15 : 0;
  return padding + badge + gaps + title + time + room;
}

export function WeekCalendar({ weekStart, events, onSelect }: Props) {
  const today = todayIso();
  const hours = Array.from(
    { length: (DAY_END - DAY_START) / 60 },
    (_, i) => DAY_START / 60 + i,
  );
  const totalHeight = (DAY_END - DAY_START) * PX_PER_MIN;

  const dayLayouts = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => addDaysIso(weekStart, i));
    return days.map((date) => {
      const dayEvents = events.filter((e) => e.date === date);
      const laidOut = assignOverlapColumns(dayEvents);
      const maxCols = maxOverlapColumns(dayEvents);
      const minWidth = dayColumnMinWidthPx(maxCols);
      return { date, laidOut, minWidth };
    });
  }, [weekStart, events]);

  const gridTemplateColumns = `${WEEK_TIME_GUTTER_PX}px ${dayLayouts
    .map((d) => `minmax(${d.minWidth}px, 1fr)`)
    .join(' ')}`;
  const gridMinWidth =
    WEEK_TIME_GUTTER_PX + dayLayouts.reduce((sum, d) => sum + d.minWidth, 0);

  return (
    <div className="week-calendar">
      <p className="week-calendar__title">{formatWeekRange(weekStart)}</p>
      <div className="week-calendar__scroll">
        <div
          className="week-calendar__grid"
          style={{
            ['--week-height' as string]: `${totalHeight}px`,
            gridTemplateColumns,
            minWidth: `${gridMinWidth}px`,
          }}
        >
          <div className="week-calendar__corner" />
          {dayLayouts.map(({ date }) => {
            const { weekday, day } = formatDayShort(date);
            return (
              <div
                key={date}
                className={`week-calendar__dayhead ${date === today ? 'is-today' : ''}`}
              >
                <span>{weekday}</span>
                <strong>{day}</strong>
              </div>
            );
          })}

          <div className="week-calendar__times" style={{ height: totalHeight }}>
            {hours.map((h) => (
              <div
                key={h}
                className="week-calendar__hour"
                style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
              >
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {dayLayouts.map(({ date, laidOut }) => (
            <div
              key={date}
              className="week-calendar__col"
              style={{ height: totalHeight }}
            >
              {hours.map((h) => (
                <div
                  key={h}
                  className="week-calendar__line"
                  style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}
                />
              ))}
              {laidOut.map(({ event, column, columnCount }) => {
                const start = timeToMinutes(event.startTime);
                const top = (start - DAY_START) * PX_PER_MIN;
                const durationHeight =
                  Math.max(minutesBetween(event.startTime, event.endTime), 30) *
                  PX_PER_MIN;
                const minHeight = Math.max(
                  durationHeight,
                  compactContentMinHeight(event),
                  72,
                );
                const horizontal = overlapHorizontalStyle(
                  column,
                  columnCount,
                  WEEK_CARD_GAP_PX,
                );

                return (
                  <div
                    key={event.id}
                    className="week-calendar__event"
                    style={{
                      top,
                      minHeight,
                      height: 'auto',
                      left: horizontal.left,
                      width: horizontal.width,
                      minWidth: WEEK_MIN_CARD_WIDTH_PX,
                    }}
                  >
                    <LectureCard event={event} onSelect={onSelect} compact />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
