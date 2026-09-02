import type { ProgramCode } from '../types/schedule';

const PROGRAM_LABELS: Record<
  ProgramCode,
  { short: string; name: string; selectLabel: string }
> = {
  G0108: {
    short: 'EKO · Ekonomika',
    name: 'Ekonomika Maģistra',
    selectLabel: 'G0108 - Ekonomika Maģistra',
  },
  G0405: {
    short: 'LInž · Lauksaimn. inž.',
    name: 'Lauksaimniecības inženierzinātne Maģistra',
    selectLabel: 'G0405 - Lauksaimniecības inženierzinātne Maģistra',
  },
};

export function programShortLabel(code: ProgramCode, apiName?: string): string {
  const base = PROGRAM_LABELS[code]?.short ?? code;
  if (!apiName) return base;
  const namePart = apiName.replace(/\s*Maģistra\s*$/i, '').trim();
  if (code === 'G0108') return `EKO · ${namePart}`;
  if (code === 'G0405') return `LInž · ${namePart}`;
  return `${code} · ${namePart}`;
}

export function programSelectLabel(code: ProgramCode, apiName?: string): string {
  if (apiName) return `${code} - ${apiName}`;
  return PROGRAM_LABELS[code]?.selectLabel ?? code;
}

export function formatSemesterLabel(semester: string): string {
  const n = semester.replace(/\D/g, '');
  return n ? `${n}. semestris` : semester;
}
