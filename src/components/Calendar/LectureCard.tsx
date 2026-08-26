import type { CSSProperties } from 'react';
import type { LectureEvent } from '../../types/schedule';
import { locationSummary } from '../../lib/location';
import './LectureCard.css';

interface Props {
  event: LectureEvent;
  onSelect: (event: LectureEvent) => void;
  compact?: boolean;
  style?: CSSProperties;
}

export function LectureCard({ event, onSelect, compact, style }: Props) {
  const abbr = event.programCode === 'G0108' ? 'Eko' : 'LInž';

  const badge =
    compact && event.directionCode
      ? `${abbr} · ${event.directionCode}`
      : abbr;

  const roomLine =
    event.room && event.building
      ? `${event.room} · ${event.building}`
      : event.room;

  const tooltip = [
    event.courseName,
    `${event.startTime}–${event.endTime}`,
    locationSummary(event),
    event.directionCode && event.directionName
      ? `${event.directionCode} - ${event.directionName}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <button
      type="button"
      className={`lecture-card program-${event.programCode.toLowerCase()} ${compact ? 'is-compact' : ''}`}
      style={style}
      onClick={() => onSelect(event)}
      title={tooltip}
    >
      <span className="lecture-card__badge" aria-label={event.programName}>
        {badge}
      </span>
      <span className="lecture-card__title">{event.courseName}</span>
      <span className="lecture-card__time">
        {event.startTime}–{event.endTime}
      </span>
      {!compact && (
        <span className="lecture-card__meta">
          📍 {locationSummary(event) || 'Vieta nav norādīta'}
        </span>
      )}
      {compact && roomLine && (
        <span className="lecture-card__meta">{roomLine}</span>
      )}
    </button>
  );
}
