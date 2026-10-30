import { describe, expect, it } from 'vitest';
import { addGlass, glassesToday, inWindow, localDay, nextWaterAt } from '../src/shared/water';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
const water = (over: Partial<{ on: boolean; everyMin: 30 | 45 | 60 | 90 | 120; from: string; to: string }> = {}) => ({
  on: true,
  everyMin: 60 as const,
  from: '09:00',
  to: '21:00',
  ...over,
});

describe('nextWaterAt', () => {
  it('is one interval away inside the window', () => {
    expect(nextWaterAt(at(26, 10), water())).toBe(at(26, 11).getTime());
  });
  it('waits for tomorrow’s window when the next one would land after it', () => {
    expect(nextWaterAt(at(26, 20, 30), water())).toBe(at(27, 9).getTime());
  });
  it('starts at the window opening before it', () => {
    expect(nextWaterAt(at(26, 7), water())).toBe(at(26, 9).getTime());
  });
  it('handles a window across midnight', () => {
    const w = water({ from: '22:00', to: '02:00' });
    expect(nextWaterAt(at(26, 23), w)).toBe(at(27, 0).getTime());
    expect(nextWaterAt(at(27, 1, 30), w)).toBe(at(27, 22).getTime());
  });
  it('treats from = to as all day', () => {
    expect(nextWaterAt(at(26, 3), water({ from: '00:00', to: '00:00' }))).toBe(at(26, 4).getTime());
  });
  it('is null when reminders are off', () => {
    expect(nextWaterAt(at(26, 10), water({ on: false }))).toBeNull();
  });
});

describe('inWindow', () => {
  it('includes the start and excludes the end', () => {
    expect(inWindow(9 * 60, '09:00', '21:00')).toBe(true);
    expect(inWindow(21 * 60, '09:00', '21:00')).toBe(false);
  });
});

describe('glasses', () => {
  it('counts today only', () => {
    const now = at(26, 12);
    expect(localDay(now)).toBe('2026-10-26');
    expect(glassesToday({ day: '2026-10-25', count: 5 }, now)).toBe(0);
    expect(glassesToday({ day: '2026-10-26', count: 5 }, now)).toBe(5);
  });
  it('starts a new day at 1 and adds within a day', () => {
    expect(addGlass({ day: '2026-10-25', count: 5 }, at(26, 0, 5))).toEqual({ day: '2026-10-26', count: 1 });
    expect(addGlass({ day: '2026-10-26', count: 2 }, at(26, 23))).toEqual({ day: '2026-10-26', count: 3 });
  });
});
