import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadScheduleOptionsResponse } from '../../server/handlers/scheduleHandler.js';
import { optionsCacheControl } from '../../server/lib/timing.js';

export const config = {
  maxDuration: 30,
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
    const force =
      req.query.refresh === '1' || req.query.refresh === 'true';
    const data = await loadScheduleOptionsResponse({ force });
    res.setHeader('Cache-Control', optionsCacheControl(force));
    res.status(200).json(data);
  } catch (err) {
    console.error(
      '[schedule] options failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Options could not be loaded',
    });
  }
}
