import * as cheerio from 'cheerio';
import type { ProgramCode } from '../../../src/types/schedule.js';
import { LBTU_ORIGIN, TARGET_PROGRAMS } from './constants.js';

export interface DiscoveredSemesterLink {
  programCode: ProgramCode;
  programName: string;
  semesterLabel: string; // e.g. "1-sem."
  semester: string; // e.g. "1"
  url: string;
  studyForm?: string; // Pilna laika / Nepilna laika if detectable
}

/**
 * Discover semester schedule links for target programs from the LBTU index page.
 * Matches by program code (p_prog=G0108) so future semester IDs still work.
 */
export function parseIndex(
  html: string,
  programCodes: ProgramCode[] = ['G0108', 'G0405'],
): DiscoveredSemesterLink[] {
  const $ = cheerio.load(html);
  const results: DiscoveredSemesterLink[] = [];
  const seen = new Set<string>();

  $('tr').each((_, tr) => {
    const cells = $(tr).children('td');
    if (cells.length < 2) return;

    const labelText = $(cells[0]).text().replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
    const matchedCode = programCodes.find((code) => {
      const re = new RegExp(`\\b${code}\\b`);
      return re.test(labelText);
    });
    if (!matchedCode) return;

    const meta = TARGET_PROGRAMS[matchedCode];
    const programName =
      labelText.replace(new RegExp(`^\\s*${matchedCode}\\s*`), '').trim() || meta.name;

    // Full-time is typically the 2nd cell; part-time the 3rd. Prefer full-time links.
    const linkCells = [cells[1], cells[2]].filter(Boolean);

    for (const cell of linkCells) {
      $(cell)
        .find('a[href]')
        .each((__, a) => {
          const href = $(a).attr('href');
          if (!href) return;

          const abs = resolveLbtuUrl(href);
          if (!abs) return;

          let urlObj: URL;
          try {
            urlObj = new URL(abs);
          } catch {
            return;
          }

          const prog = urlObj.searchParams.get('p_prog');
          if (prog !== matchedCode) return;

          const label = $(a).text().replace(/\s+/g, ' ').trim();
          const semMatch = label.match(/(\d+)\s*-?\s*sem/i);
          if (!semMatch) return;

          const semester = semMatch[1]!;
          const semesterLabel = label.includes('sem') ? label : `${semester}-sem.`;
          const key = `${matchedCode}|${semester}|${urlObj.searchParams.get('p_nod') ?? ''}|${urlObj.searchParams.get('p_sem') ?? ''}`;
          if (seen.has(key)) return;
          seen.add(key);

          results.push({
            programCode: matchedCode,
            programName: programName || meta.name,
            semesterLabel,
            semester,
            url: abs,
          });
        });
    }
  });

  // Fallback: scan all anchors if table walk missed something
  if (results.length === 0) {
    $('a[href*="p_prog="]').each((_, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      const abs = resolveLbtuUrl(href);
      if (!abs) return;
      let urlObj: URL;
      try {
        urlObj = new URL(abs);
      } catch {
        return;
      }
      const prog = urlObj.searchParams.get('p_prog') as ProgramCode | null;
      if (!prog || !programCodes.includes(prog)) return;
      const label = $(a).text().replace(/\s+/g, ' ').trim();
      const semMatch = label.match(/(\d+)\s*-?\s*sem/i);
      if (!semMatch) return;
      const semester = semMatch[1]!;
      const key = `${prog}|${semester}|${abs}`;
      if (seen.has(key)) return;
      seen.add(key);
      results.push({
        programCode: prog,
        programName: TARGET_PROGRAMS[prog].name,
        semesterLabel: label,
        semester,
        url: abs,
      });
    });
  }

  return results.sort((a, b) => {
    const byProg = a.programCode.localeCompare(b.programCode);
    if (byProg !== 0) return byProg;
    return Number(a.semester) - Number(b.semester);
  });
}

export function resolveLbtuUrl(href: string): string | null {
  try {
    if (href.startsWith('http://') || href.startsWith('https://')) {
      const u = new URL(href);
      if (u.hostname !== 'lais.lbtu.lv') return null;
      return u.toString();
    }
    if (href.startsWith('/')) {
      return `${LBTU_ORIGIN}${href}`;
    }
    // Relative like pub_nod.main?...
    return `${LBTU_ORIGIN}/pls/pub/${href.replace(/^\.\//, '')}`;
  } catch {
    return null;
  }
}
