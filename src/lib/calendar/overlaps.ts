import type { LectureEvent } from '../../types/schedule';
import { timeToMinutes } from '../dates';

export interface PositionedEvent {
  event: LectureEvent;
  column: number;
  columnCount: number;
}

/** True when time intervals intersect (touching endpoints do not overlap). */
export function eventsOverlap(a: LectureEvent, b: LectureEvent): boolean {
  return (
    timeToMinutes(a.startTime) < timeToMinutes(b.endTime) &&
    timeToMinutes(b.startTime) < timeToMinutes(a.endTime)
  );
}

function sortByTime(events: LectureEvent[]): LectureEvent[] {
  return [...events].sort(
    (a, b) =>
      timeToMinutes(a.startTime) - timeToMinutes(b.startTime) ||
      timeToMinutes(a.endTime) - timeToMinutes(b.endTime) ||
      a.courseName.localeCompare(b.courseName, 'lv') ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Assign each event a horizontal column so overlapping intervals never share a column.
 * `columnCount` is the width of the connected overlap cluster (max columns used).
 */
export function assignOverlapColumns(events: LectureEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  const sorted = sortByTime(events);
  const columns = new Array<number>(sorted.length).fill(0);

  for (let i = 0; i < sorted.length; i++) {
    const used = new Set<number>();
    for (let j = 0; j < i; j++) {
      if (eventsOverlap(sorted[i]!, sorted[j]!)) {
        used.add(columns[j]!);
      }
    }
    let col = 0;
    while (used.has(col)) col += 1;
    columns[i] = col;
  }

  // Connected components of overlapping events share one columnCount.
  const parent = sorted.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur]!;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (eventsOverlap(sorted[i]!, sorted[j]!)) union(i, j);
    }
  }

  const clusterMax = new Map<number, number>();
  for (let i = 0; i < sorted.length; i++) {
    const root = find(i);
    clusterMax.set(root, Math.max(clusterMax.get(root) ?? 0, columns[i]! + 1));
  }

  return sorted.map((event, i) => ({
    event,
    column: columns[i]!,
    columnCount: clusterMax.get(find(i)) ?? 1,
  }));
}

/**
 * Partition events into connected overlap clusters, ordered by earliest start.
 * Non-overlapping clusters remain separate.
 */
export function groupOverlappingClusters(events: LectureEvent[]): LectureEvent[][] {
  const positioned = assignOverlapColumns(events);
  if (positioned.length === 0) return [];

  const n = positioned.length;
  const parent = positioned.map((_, i) => i);
  const find = (i: number): number => {
    let root = i;
    while (parent[root] !== root) root = parent[root]!;
    let cur = i;
    while (parent[cur] !== cur) {
      const next = parent[cur]!;
      parent[cur] = root;
      cur = next;
    }
    return root;
  };
  const union = (a: number, b: number) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (eventsOverlap(positioned[i]!.event, positioned[j]!.event)) {
        union(i, j);
      }
    }
  }

  const clusters = new Map<number, LectureEvent[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    const list = clusters.get(root) ?? [];
    list.push(positioned[i]!.event);
    clusters.set(root, list);
  }

  return [...clusters.values()].sort(
    (a, b) =>
      timeToMinutes(a[0]!.startTime) - timeToMinutes(b[0]!.startTime) ||
      a[0]!.id.localeCompare(b[0]!.id),
  );
}

/** Readable week-card floor width (px). Day columns expand to fit N × this. */
export const WEEK_MIN_CARD_WIDTH_PX = 130;
/** Base day-column floor when there is no overlap. */
export const WEEK_DAY_BASE_MIN_PX = 150;
export const WEEK_CARD_GAP_PX = 4;
export const WEEK_TIME_GUTTER_PX = 56;

/** Absolute left/width inside a day column for a packed overlap column. */
export function overlapHorizontalStyle(
  column: number,
  columnCount: number,
  gapPx = WEEK_CARD_GAP_PX,
): { left: string; width: string } {
  const count = Math.max(columnCount, 1);
  const col = Math.min(Math.max(column, 0), count - 1);
  const width = 100 / count;
  return {
    left: `calc(${col * width}% + ${gapPx / 2}px)`,
    width: `calc(${width}% - ${gapPx}px)`,
  };
}

/**
 * Minimum day-column width so each simultaneous card keeps WEEK_MIN_CARD_WIDTH_PX
 * after per-card horizontal gaps from overlapHorizontalStyle.
 */
export function dayColumnMinWidthPx(maxOverlapColumns: number): number {
  const cols = Math.max(1, maxOverlapColumns);
  // width% - gap >= min  ⇒  column >= cols * (min + gap)
  const needed = cols * (WEEK_MIN_CARD_WIDTH_PX + WEEK_CARD_GAP_PX);
  return Math.max(WEEK_DAY_BASE_MIN_PX, needed);
}

/** Max concurrent columns across all overlap clusters for a day. */
export function maxOverlapColumns(events: LectureEvent[]): number {
  const positioned = assignOverlapColumns(events);
  if (positioned.length === 0) return 1;
  return Math.max(1, ...positioned.map((p) => p.columnCount));
}
