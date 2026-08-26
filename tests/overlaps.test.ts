import { describe, expect, it } from 'vitest';
import type { LectureEvent } from '../src/types/schedule';
import {
  WEEK_MIN_CARD_WIDTH_PX,
  assignOverlapColumns,
  dayColumnMinWidthPx,
  eventsOverlap,
  groupOverlappingClusters,
  maxOverlapColumns,
  overlapHorizontalStyle,
} from '../src/lib/calendar/overlaps';

function event(
  partial: Pick<LectureEvent, 'id' | 'startTime' | 'endTime' | 'courseName'> &
    Partial<LectureEvent>,
): LectureEvent {
  return {
    programCode: 'G0108',
    programName: 'Ekonomika',
    semester: '3',
    courseCode: null,
    date: '2026-09-03',
    weekday: 'Ceturtdiena',
    lectureType: null,
    groupInfo: null,
    subgroup: null,
    directionCode: null,
    directionName: null,
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

describe('eventsOverlap', () => {
  it('detects identical intervals as overlapping', () => {
    const a = event({
      id: 'a',
      startTime: '13:00',
      endTime: '14:30',
      courseName: 'A',
    });
    const b = event({
      id: 'b',
      startTime: '13:00',
      endTime: '14:30',
      courseName: 'B',
    });
    expect(eventsOverlap(a, b)).toBe(true);
  });

  it('detects partial overlaps', () => {
    const a = event({
      id: 'a',
      startTime: '13:00',
      endTime: '14:30',
      courseName: 'A',
    });
    const b = event({
      id: 'b',
      startTime: '13:30',
      endTime: '15:00',
      courseName: 'B',
    });
    expect(eventsOverlap(a, b)).toBe(true);
  });

  it('does not treat adjacent intervals as overlapping', () => {
    const a = event({
      id: 'a',
      startTime: '13:00',
      endTime: '14:00',
      courseName: 'A',
    });
    const b = event({
      id: 'b',
      startTime: '14:00',
      endTime: '15:00',
      courseName: 'B',
    });
    expect(eventsOverlap(a, b)).toBe(false);
  });
});

describe('assignOverlapColumns', () => {
  it('places two identical-time lectures in separate columns', () => {
    const positioned = assignOverlapColumns([
      event({
        id: 'mgmt',
        startTime: '13:00',
        endTime: '14:30',
        courseName: 'Starptautiskais menedžments',
      }),
      event({
        id: 'env',
        startTime: '13:00',
        endTime: '14:30',
        courseName: 'Vides ekonomika',
      }),
    ]);

    expect(positioned).toHaveLength(2);
    expect(new Set(positioned.map((p) => p.column)).size).toBe(2);
    expect(positioned.every((p) => p.columnCount === 2)).toBe(true);
  });

  it('assigns three concurrent lectures three columns', () => {
    const positioned = assignOverlapColumns([
      event({ id: 'a', startTime: '09:00', endTime: '10:30', courseName: 'A' }),
      event({ id: 'b', startTime: '09:00', endTime: '10:30', courseName: 'B' }),
      event({ id: 'c', startTime: '09:00', endTime: '10:30', courseName: 'C' }),
    ]);

    expect(positioned.map((p) => p.column).sort()).toEqual([0, 1, 2]);
    expect(positioned.every((p) => p.columnCount === 3)).toBe(true);
  });

  it('handles chained overlaps without stacking into one column', () => {
    const positioned = assignOverlapColumns([
      event({ id: 'a', startTime: '13:00', endTime: '14:30', courseName: 'A' }),
      event({ id: 'b', startTime: '13:00', endTime: '14:00', courseName: 'B' }),
      event({ id: 'c', startTime: '14:00', endTime: '15:30', courseName: 'C' }),
    ]);

    const byId = Object.fromEntries(positioned.map((p) => [p.event.id, p]));
    expect(byId.a!.column).not.toBe(byId.b!.column);
    expect(byId.a!.column).not.toBe(byId.c!.column);
    // B ends when C starts — they may share a column
    expect(byId.a!.columnCount).toBeGreaterThanOrEqual(2);
  });

  it('keeps non-overlapping events in a single column', () => {
    const positioned = assignOverlapColumns([
      event({ id: 'a', startTime: '09:00', endTime: '10:00', courseName: 'A' }),
      event({ id: 'b', startTime: '11:00', endTime: '12:00', courseName: 'B' }),
    ]);

    expect(positioned.every((p) => p.column === 0)).toBe(true);
    expect(positioned.every((p) => p.columnCount === 1)).toBe(true);
  });
});

describe('groupOverlappingClusters', () => {
  it('groups simultaneous lectures into one cluster', () => {
    const clusters = groupOverlappingClusters([
      event({
        id: 'mgmt',
        startTime: '13:00',
        endTime: '14:30',
        courseName: 'Starptautiskais menedžments',
      }),
      event({
        id: 'env',
        startTime: '13:00',
        endTime: '14:30',
        courseName: 'Vides ekonomika',
      }),
      event({
        id: 'later',
        startTime: '15:00',
        endTime: '16:30',
        courseName: 'Later',
      }),
    ]);

    expect(clusters).toHaveLength(2);
    expect(clusters[0]).toHaveLength(2);
    expect(clusters[1]).toHaveLength(1);
  });
});

describe('overlapHorizontalStyle', () => {
  it('splits a day column into equal non-overlapping widths', () => {
    expect(overlapHorizontalStyle(0, 2, 4)).toEqual({
      left: 'calc(0% + 2px)',
      width: 'calc(50% - 4px)',
    });
    expect(overlapHorizontalStyle(1, 2, 4)).toEqual({
      left: 'calc(50% + 2px)',
      width: 'calc(50% - 4px)',
    });
  });
});

describe('dayColumnMinWidthPx', () => {
  it('keeps a readable base width with no overlap', () => {
    expect(dayColumnMinWidthPx(1)).toBeGreaterThanOrEqual(150);
  });

  it('expands so each simultaneous card keeps the min width', () => {
    const forTwo = dayColumnMinWidthPx(2);
    expect(forTwo).toBeGreaterThanOrEqual(
      2 * (WEEK_MIN_CARD_WIDTH_PX + 4),
    );
    expect(dayColumnMinWidthPx(3)).toBeGreaterThan(forTwo);
  });
});

describe('maxOverlapColumns', () => {
  it('reports concurrent columns for simultaneous lectures', () => {
    expect(
      maxOverlapColumns([
        event({
          id: 'a',
          startTime: '13:00',
          endTime: '14:30',
          courseName: 'A',
        }),
        event({
          id: 'b',
          startTime: '13:00',
          endTime: '14:30',
          courseName: 'B',
        }),
      ]),
    ).toBe(2);
  });
});
