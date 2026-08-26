import type { LectureEvent } from '../types/schedule';

function withJelgava(query: string): string {
  return /jelgava/i.test(query) ? query : `${query}, Jelgava`;
}

export function mapsUrlForEvent(event: LectureEvent): string | null {
  const query =
    [event.address, event.building, event.locationRaw]
      .filter(Boolean)
      .find(
        (v) =>
          v &&
          /iela|bulv|prospekt|laukums|Jelgava|Čakstes|Svētes|Lielā/i.test(v),
      ) ?? event.locationRaw;

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withJelgava(query))}`;
}

export function locationSummary(event: LectureEvent): string {
  const parts = [event.room, event.building].filter(Boolean);
  if (parts.length) return parts.join(' · ');
  return event.locationRaw ?? '';
}
