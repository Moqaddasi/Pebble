import { FREQUENCIES } from './catalog';
import type { Settings } from './storage';

export const MIN_DELAY_MINUTES = 3;
/** How long to wait before re-checking when a visit was skipped (snooze, focus, page). */
export const RETRY_MINUTES = 5;
export const SNOOZE_MS = 60 * 60 * 1000;
export const IDLE_PLAY_MS = 20 * 60 * 1000;

/** Minutes until the next visit: mean 60 / visitsPerHour, jittered ±40%. */
export function nextDelayMinutes(frequency: number, rng: () => number): number {
  const f = FREQUENCIES[Math.min(5, Math.max(1, frequency)) - 1];
  const mean = 60 / f.perHour;
  return Math.max(MIN_DELAY_MINUTES, mean * (0.6 + rng() * 0.8));
}

export type SkipReason = 'not-onboarded' | 'quiet' | 'snoozed' | 'excluded' | 'no-page';

/** Why the pet should stay home right now, or null if it may visit `host`. */
export function skipReason(s: Settings, now: number, host: string | null): SkipReason | null {
  if (!s.onboarded) return 'not-onboarded';
  if (s.quiet) return 'quiet';
  if (s.snoozeUntil > now) return 'snoozed';
  if (!host) return 'no-page';
  if (s.excludedHosts.includes(host)) return 'excluded';
  return null;
}
