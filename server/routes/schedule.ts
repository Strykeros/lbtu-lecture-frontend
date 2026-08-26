import { Router } from 'express';
import {
  ScheduleQueryError,
  loadScheduleMetaResponse,
  loadScheduleResponse,
  parseScheduleQuery,
  scheduleErrorPayload,
} from '../handlers/scheduleHandler.js';

export const scheduleRouter = Router();

scheduleRouter.get('/meta', async (req, res) => {
  try {
    const force =
      req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await loadScheduleMetaResponse({ force });
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data);
  } catch (err) {
    console.error(
      '[schedule] meta failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Metadata could not be loaded',
    });
  }
});

// Back-compat alias for older clients
scheduleRouter.get('/schedule/meta', async (req, res) => {
  try {
    const force =
      req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await loadScheduleMetaResponse({ force });
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.json(data);
  } catch (err) {
    console.error(
      '[schedule] meta failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Metadata could not be loaded',
    });
  }
});

scheduleRouter.get('/schedule', async (req, res) => {
  try {
    const query = parseScheduleQuery(
      req.query as Record<string, string | string[] | undefined>,
    );
    const data = await loadScheduleResponse(query);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.json(data);
  } catch (err) {
    if (err instanceof ScheduleQueryError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(
      '[schedule] fetch failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(503).json(scheduleErrorPayload(err));
  }
});
