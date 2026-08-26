import type { LectureEvent, ProgramInfo, ScheduleResponse } from '../types/schedule';

export async function fetchSchedule(signal?: AbortSignal): Promise<ScheduleResponse> {
  const res = await fetch('/api/schedule', { signal });
  const data = (await res.json()) as ScheduleResponse;
  if (!res.ok && (!data.events || data.events.length === 0)) {
    throw new Error(data.error ?? 'Schedule could not be loaded');
  }
  return normalizeSchedule(data);
}

export async function refreshSchedule(signal?: AbortSignal): Promise<ScheduleResponse> {
  const res = await fetch('/api/schedule?refresh=1', { signal });
  const data = (await res.json()) as ScheduleResponse;
  if (!res.ok && (!data.events || data.events.length === 0)) {
    throw new Error(data.error ?? 'Schedule could not be loaded');
  }
  return normalizeSchedule(data);
}

function normalizeSchedule(data: ScheduleResponse): ScheduleResponse {
  return {
    ...data,
    directions: data.directions ?? [],
    programs: (data.programs ?? []).map(
      (p): ProgramInfo => ({
        ...p,
        subprograms: p.subprograms ?? [],
      }),
    ),
    events: (data.events ?? []).map(
      (e): LectureEvent => ({
        ...e,
        directionCode: e.directionCode ?? null,
        directionName: e.directionName ?? null,
      }),
    ),
  };
}
