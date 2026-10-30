import { describe, expect, it } from 'vitest';
import { MIN_DELAY_MINUTES, nextDelayMinutes, skipReason } from '../src/shared/schedule';
import { DEFAULT_SETTINGS } from '../src/shared/storage';

describe('nextDelayMinutes', () => {
  it('averages about 60 / visitsPerHour minutes for 3–4 visits an hour', () => {
    let total = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) total += nextDelayMinutes(3, () => i / n);
    const mean = total / n;
    expect(mean).toBeGreaterThan(15);
    expect(mean).toBeLessThan(19);
  });

  it('stays within ±40% of the mean', () => {
    expect(nextDelayMinutes(1, () => 0)).toBeCloseTo(36);
    expect(nextDelayMinutes(1, () => 0.9999)).toBeCloseTo(84, 0);
  });

  it('never goes below the minimum gap', () => {
    expect(nextDelayMinutes(5, () => 0)).toBeGreaterThanOrEqual(MIN_DELAY_MINUTES);
  });
});

describe('skipReason', () => {
  const ready = { ...DEFAULT_SETTINGS, onboarded: true };
  const now = 1_000_000;

  it('allows a visit for an onboarded, awake pet', () => {
    expect(skipReason(ready, now, 'example.com')).toBeNull();
  });

  it('skips before onboarding, in quiet mode, while snoozed, and on excluded or non-web pages', () => {
    expect(skipReason({ ...ready, onboarded: false }, now, 'example.com')).toBe('not-onboarded');
    expect(skipReason({ ...ready, quiet: true }, now, 'example.com')).toBe('quiet');
    expect(skipReason({ ...ready, snoozeUntil: now + 1 }, now, 'example.com')).toBe('snoozed');
    expect(skipReason({ ...ready, excludedHosts: ['example.com'] }, now, 'example.com')).toBe('excluded');
    expect(skipReason(ready, now, null)).toBe('no-page');
  });
});
