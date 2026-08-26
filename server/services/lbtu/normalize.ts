import { createHash } from 'node:crypto';
import type {
  LectureEvent,
  ProgramCode,
} from '../../../src/types/schedule.js';
import { parseLocation } from './location.js';
import { weekdayFromIsoDate } from './dates.js';

export interface DraftOccurrence {
  programCode: ProgramCode;
  programName: string;
  semester: string;
  courseCode: string | null;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  lectureType: string | null;
  groupInfo: string | null;
  subgroup: string | null;
  directionCode: string | null;
  directionName: string | null;
  lecturer: string | null;
  locationRaw: string | null;
  sourceUrl: string;
  rawDetails: string | null;
  weekPattern: string | null;
  dateSource: string | null;
}

export function normalizeLecture(draft: DraftOccurrence): LectureEvent {
  const loc = parseLocation(draft.locationRaw);
  const id = buildEventId(draft);

  return {
    id,
    programCode: draft.programCode,
    programName: draft.programName,
    semester: draft.semester,
    courseCode: draft.courseCode,
    courseName: draft.courseName.trim(),
    date: draft.date,
    startTime: draft.startTime,
    endTime: draft.endTime,
    weekday: weekdayFromIsoDate(draft.date),
    lectureType: draft.lectureType,
    groupInfo: draft.groupInfo,
    subgroup: draft.subgroup,
    directionCode: draft.directionCode,
    directionName: draft.directionName,
    lecturer: draft.lecturer?.trim() || null,
    locationRaw: loc.locationRaw || null,
    room: loc.room,
    floor: loc.floor,
    building: loc.building,
    address: loc.address,
    sourceUrl: draft.sourceUrl,
    rawDetails: draft.rawDetails,
    weekPattern: draft.weekPattern,
    dateSource: draft.dateSource,
  };
}

/** Content key used for cross-novirziens dedupe when showing "Visi novirzieni". */
export function lectureContentKey(event: {
  programCode: string;
  semester: string;
  courseCode: string | null;
  courseName: string;
  date: string;
  startTime: string;
  endTime: string;
  lecturer: string | null;
  locationRaw: string | null;
}): string {
  return [
    event.programCode,
    event.semester,
    event.courseCode ?? event.courseName,
    event.date,
    event.startTime,
    event.endTime,
    event.lecturer ?? '',
    event.locationRaw ?? '',
  ].join('|');
}

/**
 * Stable id includes direction so the same shared course from BiznVUzn and
 * Ilgspe pages remain distinct until the UI dedupes for "Visi novirzieni".
 */
export function buildEventId(draft: DraftOccurrence): string {
  const key = [
    draft.programCode,
    draft.semester,
    draft.directionCode ?? '',
    draft.courseCode ?? '',
    draft.courseName,
    draft.date,
    draft.startTime,
    draft.endTime,
    draft.lecturer ?? '',
    draft.locationRaw ?? '',
    draft.lectureType ?? '',
  ].join('|');

  return createHash('sha1').update(key).digest('hex').slice(0, 16);
}

export function parseCourseTitle(raw: string): {
  courseCode: string | null;
  courseName: string;
} {
  const text = raw.replace(/\s+/g, ' ').trim();
  const m = text.match(
    /^([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž]{2,8}\d{2,4}[A-Za-z0-9]*)\s+(.+)$/u,
  );
  if (m) {
    return { courseCode: m[1]!, courseName: m[2]!.trim() };
  }
  return { courseCode: null, courseName: text };
}
