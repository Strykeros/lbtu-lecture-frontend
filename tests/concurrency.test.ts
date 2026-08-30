import { describe, expect, it } from 'vitest';
import { mapPool } from '../server/services/lbtu/concurrency';

describe('mapPool', () => {
  it('runs tasks with bounded concurrency', async () => {
    let active = 0;
    let peak = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await mapPool(items, 2, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n * 2;
    });

    expect(peak).toBeLessThanOrEqual(2);
    expect(peak).toBeGreaterThan(0);
  });
});
