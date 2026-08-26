import * as cheerio from 'cheerio';
import type { ProgramCode, StudyDirection } from '../../../src/types/schedule.js';
import { resolveLbtuUrl } from './parseIndex.js';

/**
 * Discover novirzieni (apakšprogrammas) from a semester schedule page.
 * Uses href query `p_virz`. Skips "Visas apakšprog.".
 */
export function parseDirectionsFromSchedulePage(
  html: string,
  programCode: ProgramCode,
  semester: string,
): StudyDirection[] {
  const $ = cheerio.load(html);
  const results: StudyDirection[] = [];
  const seen = new Set<string>();

  $('a[href]').each((_, a) => {
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

    if (urlObj.searchParams.get('p_prog') !== programCode) return;
    const virzId = urlObj.searchParams.get('p_virz');
    if (!virzId) return;

    const label = $(a).text().replace(/\s+/g, ' ').trim();
    if (!label || /visas\s+apak/i.test(label)) return;

    const parsed = parseDirectionLabel(label);
    if (!parsed) return;

    const key = `${programCode}|${semester}|${parsed.code}`;
    if (seen.has(key)) return;
    seen.add(key);

    results.push({
      code: parsed.code,
      name: parsed.name,
      programCode,
      semester,
      sourceUrl: abs,
    });
  });

  return results.sort((a, b) => a.code.localeCompare(b.code, 'lv'));
}

/** @deprecated alias */
export const parseSubprogramsFromSchedulePage = (
  html: string,
  programCode: ProgramCode,
  semester = '',
) => parseDirectionsFromSchedulePage(html, programCode, semester);

export function parseDirectionLabel(
  label: string,
): { code: string; name: string } | null {
  const text = label.replace(/\s+/g, ' ').trim();
  if (!text || /visas\s+apak/i.test(text)) return null;

  const m = text.match(
    /^([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]+)\s*[-–—]\s*(.+)$/u,
  );
  if (m) {
    return { code: m[1]!, name: m[2]!.trim() };
  }

  if (/^[A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]{2,16}$/u.test(text)) {
    return { code: text, name: text };
  }

  return null;
}

/** @deprecated */
export const parseSubprogramLabel = parseDirectionLabel;

export function extractSubprogramCodeFromCell(text: string): string | null {
  const spaced = text.match(
    /(?:^|[\s>])([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]{1,15})\s+a\.prg\./iu,
  );
  if (spaced) return spaced[1]!;

  const glued = text.match(
    /(?:Lekcija|Prakt\.?darbi|Lab\.?darbi|Seminārs)([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž][A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]{1,15})\s+a\.prg\./iu,
  );
  if (glued) return glued[1]!;

  const fallback = text.match(
    /([A-Za-zĀČĒĢĪĶĻŅŠŪŽāčēģīķļņšūž0-9]{2,16})\s+a\.prg\./iu,
  );
  return fallback?.[1] ?? null;
}
