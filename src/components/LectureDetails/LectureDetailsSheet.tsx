import { useEffect, useId, useRef } from 'react';
import type { LectureEvent } from '../../types/schedule';
import { formatDayHeading } from '../../lib/dates';
import { mapsUrlForEvent } from '../../lib/location';
import { downloadIcs } from '../../lib/ics';
import './LectureDetailsSheet.css';

interface Props {
  event: LectureEvent | null;
  onClose: () => void;
}

export function LectureDetailsSheet({ event, onClose }: Props) {
  const titleId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!event) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [event, onClose]);

  if (!event) return null;

  const mapsUrl = mapsUrlForEvent(event);
  const shareText = [
    event.courseName,
    `${formatDayHeading(event.date)}, ${event.startTime}–${event.endTime}`,
    event.locationRaw,
    event.lecturer,
  ]
    .filter(Boolean)
    .join('\n');

  const copyAddress = async () => {
    if (!event.locationRaw) return;
    try {
      await navigator.clipboard.writeText(event.locationRaw);
    } catch {
      // ignore
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.courseName, text: shareText });
      } catch {
        // cancelled
      }
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className="sheet-root" role="presentation">
      <button type="button" className="sheet-backdrop" aria-label="Aizvērt" onClick={onClose} />
      <div
        className="sheet-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="sheet-handle" aria-hidden />
        <div className="sheet-header">
          <div>
            <p className="sheet-program">
              {event.programCode === 'G0108' ? 'Eko' : 'LInž'} · {event.programCode}
            </p>
            <h2 id={titleId}>{event.courseName}</h2>
            {event.courseCode && <p className="sheet-code">{event.courseCode}</p>}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Aizvērt"
          >
            ✕
          </button>
        </div>

        <div className="sheet-body">
          <p className="sheet-when">
            {formatDayHeading(event.date)}
            <br />
            {event.startTime}–{event.endTime}
          </p>

          <Detail label="Studiju programma" value={`${event.programCode} ${event.programName}`} />
          <Detail label="Semestris" value={`${event.semester}. semestris`} />
          {event.directionCode && event.directionName && (
            <Detail
              label="Novirziens"
              value={`${event.directionCode} - ${event.directionName}`}
            />
          )}
          {(event.lectureType || event.rawDetails) && (
            <Detail
              label="Tips"
              value={[event.lectureType, event.rawDetails].filter(Boolean).join('\n')}
            />
          )}
          {event.lecturer && <Detail label="Pasniedzējs" value={event.lecturer} />}

          <div className="detail-block">
            <p className="detail-label">Atrašanās vieta</p>
            <p className="detail-value location-block">
              {[event.room, event.floor].filter(Boolean).join(' · ') || null}
              {event.building && (
                <>
                  <br />
                  {event.building}
                </>
              )}
              {event.address && (
                <>
                  <br />
                  {event.address}
                </>
              )}
              {!event.room && !event.building && event.locationRaw}
            </p>
            {event.locationRaw && (
              <p className="detail-raw">{event.locationRaw}</p>
            )}
          </div>

          <div className="sheet-actions">
            {mapsUrl && (
              <a className="sheet-btn primary" href={mapsUrl} target="_blank" rel="noreferrer">
                Atvērt kartē
              </a>
            )}
            {event.locationRaw && (
              <button type="button" className="sheet-btn" onClick={() => void copyAddress()}>
                Kopēt adresi
              </button>
            )}
            <button type="button" className="sheet-btn" onClick={() => downloadIcs(event)}>
              Pievienot kalendāram
            </button>
            <button type="button" className="sheet-btn" onClick={() => void share()}>
              Kopīgot
            </button>
            <a
              className="sheet-btn"
              href={event.sourceUrl}
              target="_blank"
              rel="noreferrer"
            >
              Atvērt LBTU avotu
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-block">
      <p className="detail-label">{label}</p>
      <p className="detail-value">{value}</p>
    </div>
  );
}
