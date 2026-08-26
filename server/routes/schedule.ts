import { Router } from 'express';
import type { LectureEvent, ProgramCode } from '../../src/types/schedule.js';
import { getCachedSchedule } from '../cache.js';

export const scheduleRouter = Router();

scheduleRouter.get('/schedule', async (req, res) => {
  try {
    const force = req.query.refresh === '1' || req.query.refresh === 'true';
    const program = typeof req.query.program === 'string' ? req.query.program : null;
    const semester =
      typeof req.query.semester === 'string' ? req.query.semester.replace(/\D/g, '') : null;

    const data = await getCachedSchedule({ force });

    let events: LectureEvent[] = data.events;
    if (program === 'G0108' || program === 'G0405') {
      events = events.filter((e) => e.programCode === (program as ProgramCode));
    }
    if (semester) {
      events = events.filter((e) => e.semester === semester);
    }

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json({ ...data, events });
  } catch (err) {
    res.status(503).json({
      updatedAt: null,
      source: 'https://lais.lbtu.lv/luis/lsarG.html',
      programs: [
        { code: 'G0108', name: 'Ekonomika Maģistra' },
        { code: 'G0405', name: 'Lauksaimniecības inženierzinātne Maģistra' },
      ],
      events: [],
      error: err instanceof Error ? err.message : 'Schedule could not be loaded',
    });
  }
});
