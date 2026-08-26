import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  ScheduleQueryError,
  loadScheduleResponse,
  parseScheduleQuery,
  scheduleErrorPayload,
} from '../server/handlers/scheduleHandler.js';

export const config = {
  maxDuration: 60,
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const query = parseScheduleQuery(
      (req.query ?? {}) as Record<string, string | string[] | undefined>,
    );
    const data = await loadScheduleResponse(query);
    res.setHeader('Cache-Control', 'public, max-age=60');
    res.status(200).json(data);
  } catch (err) {
    if (err instanceof ScheduleQueryError) {
      res.status(err.status).json({ error: err.message });
      return;
    }
    console.error(
      '[schedule] fetch failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json(scheduleErrorPayload(err));
  }
}
