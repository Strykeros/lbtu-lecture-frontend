# LBTU Lekcijas

Mobile-first lecture calendar for two LBTU master's programs:

- **G0108** Ekonomika Maģistra
- **G0405** Lauksaimniecības inženierzinātne Maģistra

The app scrapes the official LBTU timetable index, discovers every available semester link for those programs, parses weekday×time HTML tables into individual lecture occurrences, and presents them in a Latvian calendar UI.

## Architecture

```text
LBTU website (lais.lbtu.lv)
      ↓
Express API scraper + 15‑min cache
      ↓
normalized LectureEvent JSON
      ↓
React + TypeScript + Vite frontend
      ↓
Today / Week / Agenda / Month views
```

| Layer | Role |
| --- | --- |
| `server/` | Fetch allowlisted LBTU pages, parse HTML with Cheerio, cache, expose `GET /api/schedule` |
| `src/` | React calendar UI, filters, details sheet, maps / ICS helpers |
| `tests/` | Parser unit tests against fixtures and synthetic HTML |

## How the scraper works

1. Fetch `https://lais.lbtu.lv/luis/lsarG.html`
2. Find table rows containing `G0108` / `G0405`
3. Collect semester anchors (`1-sem.`, `3-sem.`, …) — discovered by program code, not hard-coded semester query IDs
4. Fetch each semester timetable page
5. Walk the timetable grid (columns = weekdays, rows = time slots)
6. Split each cell into course blocks
7. Expand every listed date (and weekday ranges like `01.09.2026-27.09.2026`, including `1.ned.` / `2.ned.`) into separate events
8. Normalize location / course / lecturer metadata and deduplicate by stable SHA‑1 id

Only `lais.lbtu.lv` may be fetched (SSRF-safe allowlist). Arbitrary URLs are rejected.

## Data normalization

Each occurrence becomes:

```ts
interface LectureEvent {
  id: string;
  programCode: 'G0108' | 'G0405';
  programName: string;
  semester: string;
  courseCode: string | null;
  courseName: string;
  date: string;      // YYYY-MM-DD (Europe/Riga civil date)
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  weekday: string;
  lectureType: string | null;
  groupInfo: string | null;
  subgroup: string | null;
  lecturer: string | null;
  locationRaw: string | null; // authoritative full location string
  room / floor / building / address: string | null;
  sourceUrl: string;
  rawDetails: string | null;
  weekPattern: string | null;
  dateSource: string | null;
}
```

`locationRaw` is always kept. Structured fields are best-effort and never replace the original string.

## Development

```bash
npm install
npm run dev
```

This starts:

- API on `http://localhost:3001`
- Vite UI on `http://localhost:5173` (proxies `/api` → API)

Other commands:

```bash
npm run test
npm run typecheck
npm run build
npm start          # serves API + built UI (production mode)
```

## Production build

```bash
npm run build
NODE_ENV=production npm start
```

`server/index.ts` serves `dist/` static assets and `/api/*`.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3001` | HTTP port for the Express server |
| `NODE_ENV` | — | Set to `production` to serve the Vite build |

No API keys are required. Google Maps search links are plain `https://www.google.com/maps/search/?api=1&query=…` URLs.

## Cache behaviour

- Server caches the fully parsed schedule for **15 minutes**
- Concurrent requests share one in-flight refresh
- If a refresh fails but a previous cache exists, the API returns that payload with `stale: true`
- The UI shows **Atjaunināts: …** and a retry banner when data is stale
- Do not hammer LBTU: User-Agent is set, requests time out at 20s, and clients should use `/api/schedule` only

Optional force refresh:

```http
GET /api/schedule?refresh=1
```

Filters:

```http
GET /api/schedule?program=G0108
GET /api/schedule?semester=1
```

## Known limitations

- LBTU HTML is legacy and inconsistent; some cells put the room inside `<i>` tags, others after the lecturer
- Date ranges on engineering schedules are expanded onto the column weekday; `1.ned.` / `2.ned.` alternate occurrences within that range
- Shared-group badges (e.g. `G0905(PLK)`) are kept in `rawDetails` / `subgroup`, not as separate calendars
- If LBTU is down and there is no prior cache, the API returns HTTP 503
- UTF‑8 is required end-to-end; fixtures under `fixtures/` are for offline tests

## Deployment options

Any Node host that can make outbound HTTPS requests to `lais.lbtu.lv`:

### Render / Railway / Fly.io

1. Build command: `npm install && npm run build`
2. Start command: `NODE_ENV=production npm start`
3. Expose `PORT` (platform usually injects it)

### Vercel

Prefer a long-running Node server or separate API service. Classic serverless functions can work for `/api/schedule`, but cold starts + Cheerio parsing + multi-page fetch are heavier; a single Express process (Render/Railway) is simpler.

### Docker (example)

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
EXPOSE 3001
CMD ["npm", "start"]
```

## Project layout

```text
server/
  index.ts
  cache.ts
  routes/schedule.ts
  services/lbtu/          # fetch, parse, normalize, dedupe
src/
  components/             # calendar, filters, details sheet
  hooks/
  lib/
  services/scheduleApi.ts
  types/schedule.ts
tests/parser.test.ts
fixtures/                 # offline HTML snapshots for tests
```

## License / attribution

Timetable data belongs to LBTU / LAIS. This project is an unofficial viewer for personal academic use.
