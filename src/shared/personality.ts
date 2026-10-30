import { ACTIVITIES, type Activity } from './behavior';

export type Temperament = 'cat' | 'dog';

/** Who this particular Pip is. Rolled once per install; it doesn't drift day to day. */
export interface Traits {
  temperament: Temperament;
  /** 0 lazy … 1 lively. */
  energy: number;
  /** 0 aloof … 1 affectionate. */
  sociability: number;
  /** 0 shy … 1 bold. */
  boldness: number;
  /** Where along the bottom edge it likes to settle, 0 left … 1 right. */
  favoriteSpot: number;
  favoriteActivity: Activity;
}

/** How relaxed Pip has become around the user. Grows slowly with gentle petting. */
export interface Bond {
  value: number;
  /** Gained since the start of `day`, capped per day. */
  gainedToday: number;
  /** Day number (epoch days) that `gainedToday` belongs to. */
  day: number;
}

const between = (rng: () => number, lo: number, hi: number) => lo + rng() * (hi - lo);
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const CAT_FAVORITES: Activity[] = ['groom', 'loaf', 'watch', 'nap', 'stretch', 'knead'];
const DOG_FAVORITES: Activity[] = ['sniff', 'wander', 'lookAround', 'nap', 'stretch', 'roll'];

/**
 * Rolls a new individual. Cats come out more aloof and calmer than dogs, but every Pip
 * is different. Pass `keep` to carry the favorite spot over when the temperament changes.
 */
export function rollTraits(temperament: Temperament, rng: () => number, keep?: Pick<Traits, 'favoriteSpot'>): Traits {
  const cat = temperament === 'cat';
  const favorites = cat ? CAT_FAVORITES : DOG_FAVORITES;
  return {
    temperament,
    energy: cat ? between(rng, 0.2, 0.7) : between(rng, 0.4, 0.95),
    sociability: cat ? between(rng, 0.1, 0.6) : between(rng, 0.5, 0.95),
    boldness: between(rng, 0.1, 0.9),
    // Off to one side, clear of the middle of the page where people read.
    favoriteSpot: keep?.favoriteSpot ?? (rng() < 0.5 ? between(rng, 0.06, 0.26) : between(rng, 0.74, 0.94)),
    favoriteActivity: favorites[Math.min(favorites.length - 1, Math.floor(rng() * favorites.length))],
  };
}

/** True when stored data looks like a complete Traits object. */
export function isTraits(t: unknown): t is Traits {
  const v = t as Traits | null;
  return (
    !!v &&
    (v.temperament === 'cat' || v.temperament === 'dog') &&
    [v.energy, v.sociability, v.boldness, v.favoriteSpot].every((n) => typeof n === 'number') &&
    (ACTIVITIES as readonly string[]).includes(v.favoriteActivity)
  );
}

/**
 * Energy right now: the Pip's own level shaped by a daily rhythm. Quieter in the early
 * afternoon and at night, brighter in the morning; cats also perk up around dusk.
 */
export function energyAt(hour: number, t: Traits): number {
  let shift = 0;
  if (hour >= 23 || hour < 6) shift = -0.35;
  else if (hour >= 13 && hour < 16) shift = -0.2;
  else if (hour >= 7 && hour < 10) shift = 0.15;
  if (t.temperament === 'cat' && hour >= 17 && hour < 20) shift += 0.2;
  return clamp01(t.energy + shift);
}

const BOND_STEP = 0.02;
const BOND_DAILY_CAP = 0.06;
const BOND_FADE_PER_DAY = 0.005;

export const epochDay = (now: number) => Math.floor(now / 86_400_000);

/** One gentle petting session that Pip accepted. */
export function applyPetting(b: Bond, now: number): Bond {
  const day = epochDay(now);
  const gained = day === b.day ? b.gainedToday : 0;
  const step = Math.max(0, Math.min(BOND_STEP, BOND_DAILY_CAP - gained));
  return { value: clamp01(b.value + step), gainedToday: gained + step, day };
}

/** The bond fades a little for each day without petting. */
export function decayBond(b: Bond, days: number): Bond {
  return { ...b, value: clamp01(b.value - BOND_FADE_PER_DAY * days) };
}

/** Three words for the popup, e.g. ["sleepy", "independent", "curious"]. */
export function traitWords(t: Traits): [string, string, string] {
  const energy = t.energy < 0.4 ? 'sleepy' : t.energy > 0.7 ? 'lively' : 'easygoing';
  const social = t.sociability < 0.4 ? 'independent' : t.sociability > 0.7 ? 'affectionate' : 'friendly';
  const bold = t.boldness < 0.35 ? 'shy' : t.boldness > 0.65 ? 'bold' : 'curious';
  return [energy, social, bold];
}

/** Berry unlocks once Pip has been petted on this many different days. */
export const BERRY_DAYS = 3;

/** Notes that Pip was petted today (each calendar day counts once). */
export function recordPettingDay(days: readonly number[], now: number): number[] {
  const today = epochDay(now);
  return days.includes(today) ? [...days] : [...days, today].slice(-10);
}

export function earnedBerry(days: readonly number[]): boolean {
  return new Set(days).size >= BERRY_DAYS;
}
