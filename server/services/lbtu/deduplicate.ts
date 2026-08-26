import type { LectureEvent } from '../../../src/types/schedule.js';
import { lectureContentKey } from './normalize.js';

export function deduplicateEvents(events: LectureEvent[]): LectureEvent[] {
  const seen = new Map<string, LectureEvent>();

  for (const event of events) {
    if (!seen.has(event.id)) {
      seen.set(event.id, event);
    }
  }

  return [...seen.values()].sort(compareEvents);
}

/** Collapse identical lectures that only differ by novirziens source. */
export function deduplicateAcrossDirections(
  events: LectureEvent[],
): LectureEvent[] {
  const seen = new Map<string, LectureEvent>();
  for (const event of events) {
    const key = lectureContentKey(event);
    if (!seen.has(key)) {
      seen.set(key, event);
    }
  }
  return [...seen.values()].sort(compareEvents);
}

function compareEvents(a: LectureEvent, b: LectureEvent): number {
  const byDate = a.date.localeCompare(b.date);
  if (byDate !== 0) return byDate;
  const byTime = a.startTime.localeCompare(b.startTime);
  if (byTime !== 0) return byTime;
  return a.courseName.localeCompare(b.courseName, 'lv');
}
