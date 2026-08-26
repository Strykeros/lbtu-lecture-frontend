import fs from 'node:fs';
import { parseIndex } from '../server/services/lbtu/parseIndex.ts';
import { parseSchedulePage } from '../server/services/lbtu/parseSchedule.ts';
import { deduplicateEvents } from '../server/services/lbtu/deduplicate.ts';
import type { ProgramCode } from '../src/types/schedule.ts';

const indexHtml = fs.readFileSync('./fixtures/index.html', 'utf8');
const links = parseIndex(indexHtml);
console.log(
  'Discovered links:',
  links.map((l) => `${l.programCode} sem ${l.semester} -> ${l.url.slice(0, 80)}`),
);

const pages: Array<{
  file: string;
  meta: {
    programCode: ProgramCode;
    programName: string;
    semester: string;
    sourceUrl: string;
  };
}> = [
  {
    file: 'fixtures/g0108-1.html',
    meta: {
      programCode: 'G0108',
      programName: 'Ekonomika Maģistra',
      semester: '1',
      sourceUrl: 'https://lais.lbtu.lv/g0108-1',
    },
  },
  {
    file: 'fixtures/g0108-3.html',
    meta: {
      programCode: 'G0108',
      programName: 'Ekonomika Maģistra',
      semester: '3',
      sourceUrl: 'https://lais.lbtu.lv/g0108-3',
    },
  },
  {
    file: 'fixtures/g0405-1.html',
    meta: {
      programCode: 'G0405',
      programName: 'Lauksaimniecības inženierzinātne Maģistra',
      semester: '1',
      sourceUrl: 'https://lais.lbtu.lv/g0405-1',
    },
  },
  {
    file: 'fixtures/g0405-3.html',
    meta: {
      programCode: 'G0405',
      programName: 'Lauksaimniecības inženierzinātne Maģistra',
      semester: '3',
      sourceUrl: 'https://lais.lbtu.lv/g0405-3',
    },
  },
];

const all = [];
for (const { file, meta } of pages) {
  const html = fs.readFileSync(file, 'utf8');
  const events = parseSchedulePage(html, meta);
  console.log(file, '->', events.length, 'events');
  all.push(...events);
}

const deduped = deduplicateEvents(all);
console.log('Total deduped:', deduped.length);

const sample = deduped.find(
  (e) => e.courseCode === 'VadZ5096' && e.date === '2026-09-26',
);
console.log('VadZ5096 sample:', JSON.stringify(sample, null, 2));

const g0405 = deduped.filter((e) => e.programCode === 'G0405').slice(0, 5);
console.log(
  'G0405 samples:',
  g0405.map((e) => ({
    course: e.courseName,
    date: e.date,
    time: e.startTime,
    loc: e.locationRaw,
    lecturer: e.lecturer,
    type: e.lectureType,
  })),
);

const withLoc = deduped.filter((e) => e.locationRaw?.includes('Svētes')).length;
const missingLecturer = deduped.filter((e) => !e.lecturer).length;
const missingLoc = deduped.filter((e) => !e.locationRaw).length;
console.log({ withLoc, missingLecturer, missingLoc, total: deduped.length });
