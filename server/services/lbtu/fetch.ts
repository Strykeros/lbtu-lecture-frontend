import { LBTU_ALLOWED_HOST, FETCH_TIMEOUT_MS, USER_AGENT } from './constants.js';

export class LbtuFetchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LbtuFetchError';
  }
}

/**
 * Fetch only allowlisted LBTU URLs (SSRF-safe).
 */
export async function fetchLbtu(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new LbtuFetchError(`Invalid URL: ${url}`);
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== LBTU_ALLOWED_HOST) {
    throw new LbtuFetchError(`Refusing to fetch non-allowlisted host: ${parsed.hostname}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'lv,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      throw new LbtuFetchError(`LBTU HTTP ${res.status} for ${parsed.pathname}`, res.status);
    }

    return await res.text();
  } catch (err) {
    if (err instanceof LbtuFetchError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new LbtuFetchError(`Timeout fetching ${parsed.pathname}`);
    }
    const cause = err instanceof Error ? (err as Error & { cause?: unknown }).cause : undefined;
    const causeDetails =
      cause && typeof cause === 'object'
        ? (() => {
            const c = cause as {
              code?: string;
              syscall?: string;
              hostname?: string;
              message?: string;
            };
            const parts = [
              c.code ? `code=${c.code}` : null,
              c.syscall ? `syscall=${c.syscall}` : null,
              c.hostname ? `host=${c.hostname}` : null,
            ].filter(Boolean);
            if (parts.length > 0) return ` (${parts.join(', ')})`;
            if (c.message) return ` (${c.message})`;
            return '';
          })()
        : '';
    throw new LbtuFetchError(
      `Network error fetching ${parsed.pathname}: ${
        err instanceof Error ? err.message : String(err)
      }${causeDetails}`,
    );
  } finally {
    clearTimeout(timer);
  }
}
