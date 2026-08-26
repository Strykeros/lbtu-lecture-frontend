import { describe, expect, it } from 'vitest';
import {
  MAX_SCHEDULE_RANGE_DAYS,
  parseScheduleQuery,
} from '../server/handlers/scheduleHandler';
import { filterEventsByQuery } from '../server/services/lbtu/getSchedule';
import type { LectureEvent } from '../src/types/schedule';
import { visibleScheduleRange } from '../src/lib/scheduleRange';

function event(
  partial: Pick<LectureEvent, 'id' | 'date' | 'startTime' | 'endTime' | 'courseName'> &
    Partial<LectureEvent>,
): LectureEvent {
  return {
    programCode: 'G0108',
    programName: 'Ekonomika',
    semester: '3',
    courseCode: null,
    weekday: 'Pirmdiena',
    lectureType: null,
    groupInfo: null,
    subgroup: null,
    directionCode: 'BiznVUzn',
    directionName: 'Bizness',
    lecturer: null,
    locationRaw: null,
    room: null,
    floor: null,
    building: null,
    address: null,
    sourceUrl: 'https://example.test',
    rawDetails: null,
    weekPattern: null,
    dateSource: null,
    ...partial,
  };
}

describe('parseScheduleQuery', () => {
  it('defaults to the current week when from/to are omitted', () => {
    const parsed = parseScheduleQuery({});
    expect(parsed.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(parsed.from <= parsed.to).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(() =>
      parseScheduleQuery({ from: '14-09-2026', to: '2026-09-20' }),
    ).toThrow(/YYYY-MM-DD/);
  });

  it('rejects oversized ranges', () => {
    expect(() =>
      parseScheduleQuery({ from: '2026-01-01', to: '2026-12-31' }),
    ).toThrow(new RegExp(String(MAX_SCHEDULE_RANGE_DAYS)));
  });

  it('parses a valid week query', () => {
    expect(
      parseScheduleQuery({
        from: '2026-09-14',
        to: '2026-09-20',
        program: 'G0108',
        semester: '3',
        direction: 'BiznVUzn',
      }),
    ).toEqual({
      force: false,
      from: '2026-09-14',
      to: '2026-09-20',
      program: 'G0108',
      semester: '3',
      direction: 'BiznVUzn',
    });
  });
});

describe('filterEventsByQuery', () => {
  const sample = [
    event({
      id: 'a',
      date: '2026-09-15',
      startTime: '09:00',
      endTime: '10:30',
      courseName: 'A',
      directionCode: 'BiznVUzn',
    }),
    event({
      id: 'b',
      date: '2026-09-22',
      startTime: '09:00',
      endTime: '10:30',
      courseName: 'B',
      directionCode: 'BiznVUzn',
    }),
    event({
      id: 'c',
      date: '2026-09-15',
      startTime: '09:00',
      endTime: '10:30',
      courseName: 'A',
      directionCode: 'Ilgspe',
      locationRaw: 'same',
    }),
  ];

  it('keeps only events inside the date range', () => {
    const events = filterEventsByQuery(sample, {
      from: '2026-09-14',
      to: '2026-09-20',
      direction: 'BiznVUzn',
    });
    expect(events.map((e) => e.id)).toEqual(['a']);
  });

  it('dedupes across directions when direction=all', () => {
    const events = filterEventsByQuery(
      [
        event({
          id: '1',
          date: '2026-09-15',
          startTime: '09:00',
          endTime: '10:30',
          courseName: 'Shared',
          directionCode: 'BiznVUzn',
          locationRaw: '105',
        }),
        event({
          id: '2',
          date: '2026-09-15',
          startTime: '09:00',
          endTime: '10:30',
          courseName: 'Shared',
          directionCode: 'Ilgspe',
          locationRaw: '105',
        }),
      ],
      { from: '2026-09-14', to: '2026-09-20' },
    );
    expect(events).toHaveLength(1);
  });
});

describe('visibleScheduleRange', () => {
  it('uses the week for today/week views', () => {
    // 2026-09-17 is Thursday → week Mon 14 – Sun 20
    expect(visibleScheduleRange('today', '2026-09-17')).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
    });
    expect(visibleScheduleRange('week', '2026-09-17')).toEqual({
      from: '2026-09-14',
      to: '2026-09-20',
    });
  });

  it('limits agenda to about a month', () => {
    expect(visibleScheduleRange('agenda', '2026-09-14')).toEqual({
      from: '2026-09-14',
      to: '2026-10-14',
    });
  });
});
