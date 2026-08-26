import type { LectureEvent } from '../types/schedule';

export function buildIcs(event: LectureEvent): string {
  const uid = `${event.id}@lbtu-lekcijas`;
  const dtStart = toIcsLocal(event.date, event.startTime);
  const dtEnd = toIcsLocal(event.date, event.endTime);
  const summary = escapeIcs(event.courseName);
  const location = escapeIcs(event.locationRaw ?? '');
  const description = escapeIcs(
    [
      event.courseCode,
      event.lecturer ? `Pasniedzējs: ${event.lecturer}` : null,
      event.lectureType,
      `${event.programCode} ${event.programName}`,
      `Semestris: ${event.semester}`,
      event.sourceUrl,
    ]
      .filter(Boolean)
      .join('\\n'),
  );

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//LBTU Lekcijas//LV',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toIcsUtcNow()}`,
    `DTSTART;TZID=Europe/Riga:${dtStart}`,
    `DTEND;TZID=Europe/Riga:${dtEnd}`,
    `SUMMARY:${summary}`,
    location ? `LOCATION:${location}` : null,
    `DESCRIPTION:${description}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ]
    .filter((l) => l !== null)
    .join('\r\n');
}

export function downloadIcs(event: LectureEvent): void {
  const blob = new Blob([buildIcs(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.courseCode ?? 'lekcija'}-${event.date}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function toIcsLocal(date: string, time: string): string {
  const [y, m, d] = date.split('-');
  const [hh, mm] = time.split(':');
  return `${y}${m}${d}T${hh}${mm}00`;
}

function toIcsUtcNow(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}T${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}Z`;
}

function escapeIcs(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}
