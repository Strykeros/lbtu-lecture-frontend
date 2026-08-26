import { describe, expect, it } from 'vitest';
import {
  expandWeekdayDates,
  filterWeekPattern,
  parseDateRange,
  parseLbtuDate,
  parseLbtuTimeRange,
} from '../server/services/lbtu/dates';
import { parseLocation } from '../server/services/lbtu/location';
import {
  deduplicateAcrossDirections,
  deduplicateEvents,
} from '../server/services/lbtu/deduplicate';
import { normalizeLecture } from '../server/services/lbtu/normalize';
import { parseSchedulePage } from '../server/services/lbtu/parseSchedule';
import { parseIndex } from '../server/services/lbtu/parseIndex';
import {
  parseDirectionLabel,
  parseDirectionsFromSchedulePage,
} from '../server/services/lbtu/parseSubprograms';
import fs from 'node:fs';
import path from 'node:path';

describe('date parsing', () => {
  it('parses DD.MM.YYYY to YYYY-MM-DD', () => {
    expect(parseLbtuDate('26.09.2026')).toBe('2026-09-26');
  });

  it('parses time ranges with dots', () => {
    expect(parseLbtuTimeRange('09.00-10.30')).toEqual({
      startTime: '09:00',
      endTime: '10:30',
    });
  });

  it('expands weekday ranges', () => {
    expect(expandWeekdayDates('2026-09-01', '2026-09-27', 3)).toEqual([
      '2026-09-03',
      '2026-09-10',
      '2026-09-17',
      '2026-09-24',
    ]);
  });

  it('filters 1.ned / 2.ned patterns', () => {
    const dates = ['2026-09-03', '2026-09-10', '2026-09-17', '2026-09-24'];
    expect(filterWeekPattern(dates, '1.ned.')).toEqual([
      '2026-09-03',
      '2026-09-17',
    ]);
  });

  it('parses date ranges', () => {
    expect(parseDateRange('01.09.2026-27.09.2026')).toEqual({
      start: '2026-09-01',
      end: '2026-09-27',
    });
  });
});

describe('location parsing', () => {
  it('keeps raw location and extracts structured fields', () => {
    const loc = parseLocation('308. aud. (3. stāvs), ESAF, Svētes iela 18');
    expect(loc.locationRaw).toBe('308. aud. (3. stāvs), ESAF, Svētes iela 18');
    expect(loc.room).toBe('308. aud.');
    expect(loc.floor).toBe('3. stāvs');
    expect(loc.building).toBe('ESAF');
    expect(loc.address).toBe('Svētes iela 18, Jelgava');
  });
});

describe('multiple dates from one block', () => {
  it('creates two events for two explicit dates', () => {
    const html = `
      <table border="1">
        <tr><td></td><td><b>Sestdiena</b></td></tr>
        <tr>
          <td><b>09.00-10.30</b></td>
          <td>
            <b><a href="/x">VadZ5096 Pārmaiņu procesa vadība </a></b> A <b>Lekcija</b><br />
            <i>26.09.2026</i><br /><i>31.10.2026</i><br />
            <B><SPAN></SPAN></B><br />
            Jankova Līga<br />
            308. aud. (3. stāvs), ESAF, Svētes iela 18
          </td>
        </tr>
      </table>
    `;
    const events = parseSchedulePage(html, {
      programCode: 'G0108',
      programName: 'Ekonomika Maģistra',
      semester: '1',
      sourceUrl: 'https://lais.lbtu.lv/test',
      directionCode: null,
      directionName: null,
    });
    expect(events).toHaveLength(2);
    expect(events.map((e) => e.date).sort()).toEqual([
      '2026-09-26',
      '2026-10-31',
    ]);
  });
});

describe('novirzieni discovery', () => {
  it('parses labels and ignores Visas apakšprog.', () => {
    expect(parseDirectionLabel('Visas apakšprog.')).toBeNull();
    expect(
      parseDirectionLabel('BiznVUzn-Bizness un viedā uzņēmējdarbība'),
    ).toEqual({
      code: 'BiznVUzn',
      name: 'Bizness un viedā uzņēmējdarbība',
    });
  });

  it('discovers G0108 directions from fixture via p_virz', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'fixtures/g0108-3.html'),
      'utf8',
    );
    const dirs = parseDirectionsFromSchedulePage(html, 'G0108', '3');
    expect(dirs.map((d) => ({ code: d.code, name: d.name, semester: d.semester }))).toEqual([
      {
        code: 'BiznVUzn',
        name: 'Bizness un viedā uzņēmējdarbība',
        semester: '3',
      },
      {
        code: 'Ilgspe',
        name: 'Ilgtspējīga teritorijas attīstība un mārketings',
        semester: '3',
      },
    ]);
    expect(dirs.every((d) => d.sourceUrl.includes('p_virz='))).toBe(true);
  });

  it('keeps G0405 directions isolated from G0108', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'fixtures/g0405-3.html'),
      'utf8',
    );
    const dirs = parseDirectionsFromSchedulePage(html, 'G0405', '3');
    expect(dirs.map((d) => d.code).sort()).toEqual(['MasPrR', 'SpekSr']);
    expect(parseDirectionsFromSchedulePage(html, 'G0108', '3')).toHaveLength(0);
  });

  it('tags events with page direction metadata', () => {
    const html = `
      <table border="1">
        <tr><td></td><td><b>Sestdiena</b></td></tr>
        <tr>
          <td><b>09.00-10.30</b></td>
          <td>
            <b><a href="/x">EkonM026 Sociālā ekonomika </a></b> B <b>Lekcija</b><br />
            <i>19.09.2026</i>
            <B><SPAN></SPAN></B><br />
            Līcīte-Ķurbe Lāsma<br />
            105. aud.
          </td>
        </tr>
      </table>
    `;
    const events = parseSchedulePage(html, {
      programCode: 'G0108',
      programName: 'Ekonomika Maģistra',
      semester: '3',
      sourceUrl: 'https://lais.lbtu.lv/bizn',
      directionCode: 'BiznVUzn',
      directionName: 'Bizness un viedā uzņēmējdarbība',
    });
    expect(events[0]?.directionCode).toBe('BiznVUzn');
    expect(events[0]?.directionName).toBe('Bizness un viedā uzņēmējdarbība');
  });
});

describe('deduplication', () => {
  it('keeps same lecture from two novirzieni distinct by id, but collapses for Visi', () => {
    const base = {
      programCode: 'G0108' as const,
      programName: 'Ekonomika Maģistra',
      semester: '3',
      courseCode: 'Ekon5135',
      courseName: 'Vides ekonomika',
      date: '2026-10-03',
      startTime: '13:00',
      endTime: '14:30',
      lectureType: 'B Lekcija',
      groupInfo: null,
      subgroup: null,
      lecturer: 'Naglis-Liepa Kaspars',
      locationRaw: '308. aud.',
      rawDetails: null,
      weekPattern: null,
      dateSource: '03.10.2026',
    };
    const a = normalizeLecture({
      ...base,
      directionCode: 'BiznVUzn',
      directionName: 'Bizness',
      sourceUrl: 'https://a/bizn',
    });
    const b = normalizeLecture({
      ...base,
      directionCode: 'Ilgspe',
      directionName: 'Ilgtspēja',
      sourceUrl: 'https://a/ilg',
    });
    expect(a.id).not.toBe(b.id);
    expect(deduplicateEvents([a, b])).toHaveLength(2);
    expect(deduplicateAcrossDirections([a, b])).toHaveLength(1);
  });
});

describe('index discovery', () => {
  it('discovers G0108 and G0405 semester links from fixture', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'fixtures/index.html'),
      'utf8',
    );
    const links = parseIndex(html);
    expect(links.map((l) => `${l.programCode}:${l.semester}`).sort()).toEqual([
      'G0108:1',
      'G0108:3',
      'G0405:1',
      'G0405:3',
    ]);
  });
});

describe('fixture schedule sample', () => {
  it('parses VadZ5096 from G0108 fixture', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'fixtures/g0108-1.html'),
      'utf8',
    );
    const events = parseSchedulePage(html, {
      programCode: 'G0108',
      programName: 'Ekonomika Maģistra',
      semester: '1',
      sourceUrl: 'https://lais.lbtu.lv/g0108-1',
    });
    const sample = events.find(
      (e) => e.courseCode === 'VadZ5096' && e.date === '2026-09-26',
    );
    expect(sample).toMatchObject({
      courseCode: 'VadZ5096',
      courseName: 'Pārmaiņu procesa vadība',
      date: '2026-09-26',
      startTime: '09:00',
      endTime: '10:30',
      lecturer: 'Jankova Līga',
      locationRaw: '308. aud. (3. stāvs), ESAF, Svētes iela 18',
    });
  });
});
