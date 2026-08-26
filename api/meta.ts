import type { VercelRequest, VercelResponse } from '@vercel/node';
import { loadScheduleMetaResponse } from '../server/handlers/scheduleHandler.js';

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
    const refresh = req.query?.refresh;
    const force =
      refresh === '1' ||
      refresh === 'true' ||
      (Array.isArray(refresh) && (refresh[0] === '1' || refresh[0] === 'true'));
    const data = await loadScheduleMetaResponse({ force });
    res.setHeader('Cache-Control', 'public, max-age=120');
    res.status(200).json(data);
  } catch (err) {
    console.error(
      '[schedule] meta failed:',
      err instanceof Error ? err.message : err,
    );
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Metadata could not be loaded',
    });
  }
}
