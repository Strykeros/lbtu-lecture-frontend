import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { ProgramCode } from '../../../src/types/schedule.js';
import {
  expandWeekdayDates,
  filterWeekPattern,
  parseDateRange,
  parseLbtuDate,
  parseLbtuTimeRange,
} from './dates.js';
import { weekdayIndexFromHeader, weekdayNameFromIndex } from './constants.js';
import { normalizeLecture, parseCourseTitle, type DraftOccurrence } from './normalize.js';
import type { LectureEvent } from '../../../src/types/schedule.js';
import { extractSubprogramCodeFromCell } from './parseSubprograms.js';

export interface ParseScheduleContext {
  programCode: ProgramCode;
  programName: string;
  semester: string;
  sourceUrl: string;
  /** Novirziens of this page (from p_virz fetch). Null when semester has no novirzieni. */
  directionCode?: string | null;
  directionName?: string | null;
}

interface BlockDraft {
  courseCode: string | null;
  courseName: string;
  lectureType: string | null;
  groupInfo: string | null;
  subgroup: string | null;
  lecturer: string | null;
  locationRaw: string | null;
  dates: string[];
  dateSources: string[];
  weekPattern: string | null;
  rawDetails: string[];
}

/**
 * Parse one LBTU weekday×time timetable HTML page into lecture events.
 * Malformed cells are skipped without failing the whole page.
 */
export function parseSchedulePage(
  html: string,
  ctx: ParseScheduleContext,
): LectureEvent[] {
  const $ = cheerio.load(html);
  const table = $('table').first();
  if (!table.length) return [];

  const headerRow = table.find('tr').first();
  const weekdayByCol: Array<number | null> = [];
  headerRow.children('td, th').each((i, cell) => {
    if (i === 0) {
      weekdayByCol[i] = null;
      return;
    }
    const text = $(cell).text().replace(/\s+/g, ' ').trim();
    weekdayByCol[i] = weekdayIndexFromHeader(text);
  });

  const drafts: DraftOccurrence[] = [];

  table.find('tr').slice(1).each((_, tr) => {
    try {
      const cells = $(tr).children('td, th');
      if (cells.length < 2) return;

      const timeText = $(cells[0]).text().replace(/\s+/g, ' ').trim();
      const times = parseLbtuTimeRange(timeText);
      if (!times) return;

      cells.each((colIdx, cell) => {
        if (colIdx === 0) return;
        const weekdayIndex = weekdayByCol[colIdx];
        if (weekdayIndex == null) return;

        try {
          const blocks = splitCellIntoBlocks($, cell);
          for (const block of blocks) {
            const expanded = expandBlockDates(block, weekdayIndex);
            for (let i = 0; i < expanded.dates.length; i++) {
              drafts.push({
                programCode: ctx.programCode,
                programName: ctx.programName,
                semester: ctx.semester,
                courseCode: block.courseCode,
                courseName: block.courseName,
                date: expanded.dates[i]!,
                startTime: times.startTime,
                endTime: times.endTime,
                lectureType: block.lectureType,
                groupInfo: block.groupInfo,
                subgroup: block.subgroup,
                directionCode: ctx.directionCode ?? null,
                directionName: ctx.directionName ?? null,
                lecturer: block.lecturer,
                locationRaw: block.locationRaw,
                sourceUrl: ctx.sourceUrl,
                rawDetails: block.rawDetails.length
                  ? block.rawDetails.join(' · ')
                  : null,
                weekPattern: block.weekPattern,
                dateSource:
                  expanded.dateSources[i] ?? block.dateSources[0] ?? null,
              });
            }
          }
        } catch {
          // Skip malformed cell
        }
      });
    } catch {
      // Skip malformed row
    }
  });

  return drafts.map(normalizeLecture);
}

function expandBlockDates(
  block: BlockDraft,
  weekdayIndex: number,
): { dates: string[]; dateSources: string[] } {
  const dates: string[] = [];
  const dateSources: string[] = [];

  for (const source of block.dateSources) {
    const range = parseDateRange(source);
    if (range) {
      let expanded = expandWeekdayDates(range.start, range.end, weekdayIndex);
      expanded = filterWeekPattern(expanded, block.weekPattern);
      for (const d of expanded) {
        dates.push(d);
        dateSources.push(source);
      }
      continue;
    }
    const single = parseLbtuDate(source);
    if (single) {
      dates.push(single);
      dateSources.push(source);
    }
  }

  return { dates, dateSources };
}

function splitCellIntoBlocks(
  $: cheerio.CheerioAPI,
  cell: AnyNode,
): BlockDraft[] {
  const html = $(cell).html() ?? '';
  if (!html.trim()) return [];

  const parts = html.split(/<b>\s*<a\s+href="/i);
  const blocks: BlockDraft[] = [];

  for (let i = 1; i < parts.length; i++) {
    const chunk = `<b><a href="${parts[i]}`;
    try {
      const block = parseBlockHtml(chunk);
      if (block) blocks.push(block);
    } catch {
      // skip block
    }
  }

  return blocks;
}

function parseBlockHtml(chunkHtml: string): BlockDraft | null {
  const $b = cheerio.load(`<div id="root">${chunkHtml}</div>`);
  const root = $b('#root');

  const courseLink = root.find('a').first();
  const courseTitle = courseLink.text().replace(/\s+/g, ' ').trim();
  if (!courseTitle) return null;
  const { courseCode, courseName } = parseCourseTitle(courseTitle);

  let lectureType: string | null = null;
  const typeBold = root
    .find('b')
    .filter((_, el) => {
      const t = $b(el).text().trim();
      return /Lekcija|Prakt\.?darbi|Lab\.?darbi|Seminārs|sem\./i.test(t);
    })
    .first();
  if (typeBold.length) {
    const boldText = typeBold.text().trim();
    const parentHtml = root.html() ?? '';
    const typeMatch = parentHtml.match(
      /<\/a><\/b>\s*([A-C])\s*<b>([^<]+)<\/b>/i,
    );
    if (typeMatch) {
      lectureType = `${typeMatch[1]} ${typeMatch[2]}`.trim();
    } else {
      lectureType = boldText;
    }
  }

  const weekPattern = extractWeekPattern(root.text());

  const italics = root
    .find('i')
    .map((_, el) => $b(el).text().replace(/\s+/g, ' ').trim())
    .get()
    .filter(Boolean);

  const dateSources: string[] = [];
  const rawDetails: string[] = [];
  let locationFromItalic: string | null = null;

  for (const it of italics) {
    if (parseLbtuDate(it) || parseDateRange(it)) {
      dateSources.push(it);
      continue;
    }
    if (looksLikeLocation(it)) {
      locationFromItalic = it;
      continue;
    }
    rawDetails.push(it);
  }

  let groupInfo: string | null = null;
  let subgroup: string | null = null;
  const fullText = normalizeWhitespace(root.text());
  const cellSub = extractSubprogramCodeFromCell(fullText);
  if (cellSub) {
    groupInfo = `${cellSub} a.prg.`;
  }

  root.find('span').each((_, el) => {
    const t = $b(el).text().replace(/\s+/g, ' ').trim();
    if (!t) return;
    for (const line of t.split(/\s+/)) {
      if (/^G\d{4}/.test(line) || /\(PLK\)/.test(line)) {
        rawDetails.push(line);
      }
    }
    if (/G\d{4}/.test(t)) {
      subgroup = t;
    }
  });

  const { lecturer, locationRaw } = extractLecturerAndLocation(
    root,
    locationFromItalic,
  );

  if (dateSources.length === 0) return null;

  return {
    courseCode,
    courseName,
    lectureType,
    groupInfo,
    subgroup,
    lecturer,
    locationRaw,
    dates: [],
    dateSources,
    weekPattern,
    rawDetails: unique(rawDetails),
  };
}

function extractWeekPattern(text: string): string | null {
  const m = text.match(/(\d)\s*\.\s*ned\./i);
  return m ? `${m[1]}.ned.` : null;
}

function looksLikeLocation(text: string): boolean {
  return /aud\.?|stāvs|iela|bulvāris|IITF|ESAF|Pils/i.test(text);
}

function extractLecturerAndLocation(
  root: cheerio.Cheerio<AnyNode>,
  locationFromItalic: string | null,
): { lecturer: string | null; locationRaw: string | null } {
  const html = root.html() ?? '';
  const withoutTags = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const lines = withoutTags
    .split(/<br\s*\/?>/i)
    .map((l) =>
      cheerio
        .load(`<div>${l}</div>`)('div')
        .text()
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter((l) => l.length > 0);

  let lecturer: string | null = null;
  let locationRaw: string | null = locationFromItalic;

  for (const line of lines) {
    if (parseLbtuDate(line) || parseDateRange(line)) continue;
    if (/a\.prg\./i.test(line)) continue;
    if (/^\d\.ned/i.test(line)) continue;
    if (/lekc\.|pr\.d\.|sem\./i.test(line)) continue;
    if (/^G\d{4}/.test(line)) continue;
    if (looksLikeLocation(line)) {
      if (!locationRaw) locationRaw = line;
      continue;
    }
    if (/^[A-C]$/.test(line)) continue;
    if (/Lekcija|Prakt\.?darbi|Lab\.?darbi/i.test(line) && line.length < 40) {
      continue;
    }
    if (/^[A-Za-zĀ-ž]{2,8}\d{2,4}/u.test(line) && line.length > 12) continue;

    if (
      /^[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž\s\-']+$/u.test(
        line,
      ) &&
      line.length >= 3 &&
      line.length < 80
    ) {
      lecturer = line;
    }
  }

  return { lecturer, locationRaw };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

export function describeWeekday(index: number): string {
  return weekdayNameFromIndex(index);
}
