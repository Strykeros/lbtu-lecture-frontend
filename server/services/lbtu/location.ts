export interface ParsedLocation {
  locationRaw: string;
  room: string | null;
  floor: string | null;
  building: string | null;
  address: string | null;
}

const KNOWN_BUILDINGS = [
  'ESAF',
  'IITF',
  'TF',
  'MF',
  'VF',
  'Pils',
  'LLU',
  'LBTU',
  'LF',
  'VBF',
  'Meža fakultāte',
];

/**
 * Tolerant location parser. Always keeps locationRaw intact.
 */
export function parseLocation(raw: string | null | undefined): ParsedLocation {
  const locationRaw = (raw ?? '').replace(/\s+/g, ' ').trim();
  if (!locationRaw) {
    return {
      locationRaw: '',
      room: null,
      floor: null,
      building: null,
      address: null,
    };
  }

  let room: string | null = null;
  let floor: string | null = null;
  let building: string | null = null;
  let address: string | null = null;

  const floorMatch = locationRaw.match(/\(([^)]*stāvs[^)]*)\)/i);
  if (floorMatch) {
    floor = floorMatch[1]!.trim();
  }

  const roomMatch = locationRaw.match(
    /^([^,]+?(?:aud\.?|auditorija|telpa|kab\.?)[^,]*)/i,
  );
  if (roomMatch) {
    room = roomMatch[1]!.replace(/\([^)]*\)/, '').replace(/\s+/g, ' ').trim();
  }

  const parts = locationRaw.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    const cleaned = part.replace(/\([^)]*\)/g, '').trim();
    if (!cleaned) continue;

    if (/iela|bulvāris|bulv\.|prospekts|laukums|iela\b/i.test(cleaned)) {
      address = cleaned;
      continue;
    }

    const known = KNOWN_BUILDINGS.find(
      (b) => cleaned === b || cleaned.toUpperCase() === b.toUpperCase(),
    );
    if (known) {
      building = cleaned;
      continue;
    }

    // Short uppercase faculty/building codes
    if (/^[A-ZĀČĒĢĪĶĻŅŠŪŽ]{2,8}$/u.test(cleaned) && cleaned.length <= 8) {
      building = cleaned;
    }
  }

  // Fallback: if we have 3+ comma parts and no building yet, middle-ish tokens
  if (!building && parts.length >= 2) {
    for (let i = 1; i < parts.length; i++) {
      const p = parts[i]!.replace(/\([^)]*\)/g, '').trim();
      if (!p) continue;
      if (/iela|bulvāris|bulv\.|prospekts|laukums/i.test(p)) continue;
      if (/aud\.?|stāvs/i.test(p)) continue;
      building = p;
      break;
    }
  }

  if (!address && parts.length >= 1) {
    const last = parts[parts.length - 1]!.replace(/\([^)]*\)/g, '').trim();
    if (/iela|bulvāris|bulv\.|prospekts|laukums|\d/.test(last) && last !== building) {
      address = last;
    }
  }

  if (address && !/jelgava/i.test(address)) {
    address = `${address}, Jelgava`;
  }

  return { locationRaw, room, floor, building, address };
}

function withJelgava(query: string): string {
  return /jelgava/i.test(query) ? query : `${query}, Jelgava`;
}

export function mapsSearchUrl(location: ParsedLocation): string | null {
  const query =
    [location.address, location.building, location.locationRaw]
      .filter(Boolean)
      .find((v) => v && /iela|bulv|prospekt|laukums|Jelgava|Čakstes|Svētes|Lielā/i.test(v)) ??
    location.locationRaw;

  if (!query) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(withJelgava(query))}`;
}
