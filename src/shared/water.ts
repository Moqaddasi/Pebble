/** Reminder intervals offered in the popup, in minutes. */
export const WATER_EVERY = [30, 45, 60, 90, 120] as const;
export type WaterEvery = (typeof WATER_EVERY)[number];

/** "Later" asks again after this many minutes. */
export const LATER_MIN = 15;
/** An unanswered reminder waits this long, then the character leaves. */
export const WATER_WAIT_MS = 45_000;

export interface WaterSettings {
  on: boolean;
  everyMin: WaterEvery;
  /** Local "HH:MM"; reminders only between `from` (inclusive) and `to` (exclusive). Equal = all day. */
  from: string;
  to: string;
}

export interface Glasses {
  /** Local calendar day, "YYYY-MM-DD"; empty before the first glass. */
  day: string;
  count: number;
}

export const DEFAULT_WATER: WaterSettings = { on: false, everyMin: 60, from: '09:00', to: '21:00' };

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(v: unknown): v is string {
  return typeof v === 'string' && HHMM.test(v);
}

const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Whether a minute of the day (0–1439) falls inside the window; windows may cross midnight. */
export function inWindow(minuteOfDay: number, from: string, to: string): boolean {
  const a = minutesOf(from);
  const b = minutesOf(to);
  if (a === b) return true;
  return a < b ? minuteOfDay >= a && minuteOfDay < b : minuteOfDay >= a || minuteOfDay < b;
}

/** Epoch ms of the next reminder after `now`, or null when reminders are off. */
export function nextWaterAt(now: Date, water: WaterSettings): number | null {
  if (!water.on) return null;
  const next = new Date(now.getTime() + water.everyMin * 60_000);
  if (inWindow(next.getHours() * 60 + next.getMinutes(), water.from, water.to)) return next.getTime();
  // Outside the window: the next time it opens.
  const open = new Date(now);
  open.setHours(0, minutesOf(water.from), 0, 0);
  if (open.getTime() <= now.getTime()) open.setDate(open.getDate() + 1);
  return open.getTime();
}

export function localDay(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

export function glassesToday(g: Glasses, now: Date): number {
  return g.day === localDay(now) ? g.count : 0;
}

export function addGlass(g: Glasses, now: Date): Glasses {
  return { day: localDay(now), count: glassesToday(g, now) + 1 };
}
