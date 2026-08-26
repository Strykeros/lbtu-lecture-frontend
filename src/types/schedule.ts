export type ProgramCode = 'G0108' | 'G0405';

/** LBTU apakšprogramma / novirziens */
export interface StudyDirection {
  code: string;
  name: string;
  programCode: ProgramCode;
  semester: string;
  sourceUrl: string;
}

export interface ProgramInfo {
  code: ProgramCode;
  name: string;
  /** @deprecated use top-level directions; kept for older clients */
  subprograms?: Array<{ code: string; name: string; programCode: ProgramCode }>;
}

export interface LectureEvent {
  id: string;

  programCode: ProgramCode;
  programName: string;

  semester: string;

  courseCode: string | null;
  courseName: string;

  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm

  weekday: string;

  lectureType: string | null;
  groupInfo: string | null;
  subgroup: string | null;

  /** Novirziens this event was parsed from (null = no novirzieni for that semester). */
  directionCode: string | null;
  directionName: string | null;

  lecturer: string | null;

  locationRaw: string | null;

  room: string | null;
  floor: string | null;
  building: string | null;
  address: string | null;

  sourceUrl: string;

  rawDetails: string | null;
  weekPattern: string | null;
  dateSource: string | null;
}

export interface ScheduleResponse {
  updatedAt: string;
  source: string;
  /** Inclusive range echoed from the request when present */
  from?: string;
  to?: string;
  count?: number;
  programs: ProgramInfo[];
  /** All discovered novirzieni across programs/semesters */
  directions: StudyDirection[];
  events: LectureEvent[];
  stale?: boolean;
  error?: string;
}

export interface ScheduleMetaSemester {
  semester: string;
  directions: Array<{ code: string; name: string }>;
}

export interface ScheduleMetaProgram {
  code: ProgramCode;
  name: string;
  semesters: ScheduleMetaSemester[];
}

export interface ScheduleMetaResponse {
  updatedAt: string;
  source: string;
  programs: ScheduleMetaProgram[];
}
