import type { CharacterId, Pose } from './catalog';
import { HERO_ENTRANCES, HERO_EXITS, heroWeights, type Hero, type HeroActivity, type HeroEntrance, type HeroExit } from './heroes';
import { energyAt, type Traits } from './personality';

// Quiet, self-directed behaviors: Pip lives its own life and lets you notice it, like a real pet.
export const ENTRANCES = ['walk', 'peek', 'saunter'] as const;
export const ACTIVITIES = [
  'wander', 'lookAround', 'groom', 'stretch', 'nap', 'loaf', 'sniff', 'watch', 'zoomies', 'knead', 'roll',
  'scratch', 'ladybug', 'sunbeam', 'chaseTail', 'dig', 'pounce',
] as const;
export const LINE_KINDS = ['greeting', 'timeOfDay'] as const;
export const EXITS = ['walkAway', 'tiptoe', 'curlUp'] as const;

export type Entrance = (typeof ENTRANCES)[number];
export type Activity = (typeof ACTIVITIES)[number];
export type LineKind = (typeof LINE_KINDS)[number];
export type Exit = (typeof EXITS)[number];

/** Rest pose between activities: eyes on its own world, not on the user. */
export const REST_POSE: Pose = 'away';

export const RECENT_LIMIT = 20;
const MIN_STAY_MS = 20_000;
const MAX_STAY_MS = 90_000;
const HELLO_CHANCE = 0.15;
const MURMUR_CHANCE = 0.06;
const STALK_CHANCE = 0.25;

export interface Visit {
  /** `pass`: strolls across the bottom edge without stopping. `stay`: settles at a spot for a while. */
  kind: 'pass' | 'stay';
  entrance: Entrance | HeroEntrance;
  activity: Activity | HeroActivity;
  exit: Exit | HeroExit;
  lineKind: LineKind;
  /** `hello` only when the user opted in; `murmur` is Pip talking to itself, no name. */
  speech: 'none' | 'hello' | 'murmur';
  /** Cats only: on arrival, eyes lock onto the cursor, a butt-wiggle, a tiny pounce that misses. */
  stalk: boolean;
  /** Edge it arrives from. */
  side: 'left' | 'right';
  /** Where it settles along the bottom edge, 0 left … 1 right (stays only). */
  spot: number;
  /** Energy right now, 0–1: sets walking speed and how lively it looks. */
  energy: number;
  /** How long a stay lasts; passes take as long as the walk. */
  durationMs: number;
}

export interface PlanInput {
  traits: Traits;
  hour: number;
  /** 0–1; not used to seek the user, only carried for touch tolerance. */
  bond: number;
  sayHi: boolean;
  recent: readonly string[];
  /** A costumed character plans from its own personality; Classic (default) from cat/dog. */
  character?: CharacterId;
}

export function visitKey(v: Pick<Visit, 'kind' | 'entrance' | 'activity' | 'exit' | 'lineKind'>): string {
  return [v.kind, v.entrance, v.activity, v.exit, v.lineKind].join('|');
}

type Weights<K extends string> = Partial<Record<K, number>>;

function weighted<K extends string>(w: Weights<K>, rng: () => number): K {
  const entries = Object.entries(w).filter(([, v]) => (v as number) > 0) as [K, number][];
  const total = entries.reduce((s, [, v]) => s + v, 0);
  let r = rng() * total;
  for (const [k, v] of entries) {
    r -= v;
    if (r < 0) return k;
  }
  return entries[entries.length - 1][0];
}

const dawnOrDusk = (hour: number) => (hour >= 5 && hour < 8) || (hour >= 17 && hour < 20);

/** How likely each activity is right now, for this Pip. */
export function activityWeights(t: Traits, energy: number, hour: number): Record<Activity, number> {
  const restful = (1.8 - energy * 1.6) ** 2; // strongly preferred when tired
  const active = 0.3 + energy * 1.4; // high when lively
  const w: Record<Activity, number> = {
    wander: active,
    lookAround: 0.5 + energy * 0.8,
    groom: 0.6 + energy * 0.6,
    stretch: 0.5 + energy * 0.5,
    nap: restful * 1.4,
    loaf: restful * 1.2,
    sniff: active * 0.8,
    watch: active * 0.9,
    zoomies: energy > 0.65 && dawnOrDusk(hour) ? 0.35 : 0,
    // Kneading: a relaxed, content cat (iCatCare). Rolling over: a relaxed social roll / belly-up.
    knead: 0.4 + restful * 0.2,
    roll: 0.35 + energy * 0.2,
    scratch: 0.35 + energy * 0.2,
    ladybug: 0.45,
    sunbeam: 0.15 + restful * 0.5,
    // Dogs only (below): chasing its own tail, digging.
    chaseTail: energy > 0.5 ? 0.35 : 0.1,
    dig: 0.35,
    pounce: 0.25 + energy * 0.5,
  };
  if (t.temperament === 'cat') {
    w.groom *= 1.6;
    w.loaf *= 1.3;
    w.watch *= 1.3;
    w.sniff *= 0.5;
    w.ladybug *= 1.2;
    w.sunbeam *= 1.4;
    w.chaseTail = 0;
    w.dig = 0;
  } else {
    w.knead = 0;
    w.sniff *= 1.8;
    w.wander *= 1.4;
    w.groom *= 0.5;
  }
  w[t.favoriteActivity] *= 2;
  return w;
}

/**
 * Plans one appearance from who this Pip is, how much energy it has right now and the time
 * of day. Most of the time Pip is going about its business; it never plans to seek the user.
 */
export function planVisit(rng: () => number, input: PlanInput): Visit {
  if (input.character && input.character !== 'pip') return planHeroVisit(rng, input, input.character);
  const { traits: t, hour } = input;
  const energy = energyAt(hour, t);

  // Aloof and middling-energy Pips mostly wander through; very tired ones stop to nap.
  let passChance = 0.42 + (1 - t.sociability) * 0.15 + (energy > 0.3 && energy < 0.75 ? 0.1 : 0);
  if (energy < 0.2) passChance = 0.3;
  const kind: Visit['kind'] = rng() < Math.min(0.7, passChance) ? 'pass' : 'stay';

  const entrance = weighted<Entrance>({ walk: 1, peek: t.boldness < 0.35 ? 1.5 : 0.3, saunter: 1.4 - energy }, rng);
  const exit = weighted<Exit>({ walkAway: 1, tiptoe: t.boldness < 0.35 ? 1 : 0.3, curlUp: energy < 0.35 ? 1.2 : 0.2 }, rng);
  const lineKind = weighted<LineKind>({ greeting: 1, timeOfDay: 1 }, rng);
  const side: Visit['side'] = rng() < 0.5 ? 'left' : 'right';
  const spot = Math.min(0.94, Math.max(0.06, t.favoriteSpot + (rng() - 0.5) * 0.16));

  const weights = activityWeights(t, energy, hour);
  let activity = weighted(weights, rng);
  if (kind === 'stay') {
    // Never the same stay as one of the last few.
    const seen = new Set(input.recent);
    const pool = { ...weights };
    while (seen.has(visitKey({ kind, entrance, activity, exit, lineKind })) && Object.values(pool).some((v) => v > 0)) {
      pool[activity] = 0;
      if (!Object.values(pool).some((v) => v > 0)) break;
      activity = weighted(pool, rng);
    }
  }

  let speech: Visit['speech'] = 'none';
  if (kind === 'stay') {
    const r = rng();
    if (input.sayHi && r < HELLO_CHANCE) speech = 'hello';
    else if (r > 1 - MURMUR_CHANCE) speech = 'murmur';
  }

  const stalk = kind === 'stay' && t.temperament === 'cat' && energy > 0.25 && rng() < STALK_CHANCE;

  // Lazy Pips linger a little longer (usually asleep).
  const length = MIN_STAY_MS + rng() * (MAX_STAY_MS - MIN_STAY_MS) * (1.1 - energy * 0.3);
  return {
    kind,
    entrance,
    activity,
    exit,
    lineKind,
    speech,
    stalk,
    side,
    spot,
    energy,
    durationMs: kind === 'stay' ? Math.round(Math.min(MAX_STAY_MS, length)) : 0,
  };
}

/** A character's visit: its own activities, mostly its own way in and out, lingering a bit more. */
function planHeroVisit(rng: () => number, input: PlanInput, hero: Hero): Visit {
  const { traits: t, hour } = input;
  const energy = energyAt(hour, t);
  const kind: Visit['kind'] = rng() < 0.3 ? 'pass' : 'stay';
  const entrance = rng() < 0.7 ? HERO_ENTRANCES[hero] : 'walk';
  const exit = rng() < 0.6 ? HERO_EXITS[hero] : 'walkAway';
  const activity = weighted(heroWeights(hero, energy), rng) as HeroActivity;
  const side: Visit['side'] = rng() < 0.5 ? 'left' : 'right';
  const spot = Math.min(0.94, Math.max(0.06, t.favoriteSpot + (rng() - 0.5) * 0.16));
  let speech: Visit['speech'] = 'none';
  if (kind === 'stay') {
    const r = rng();
    if (input.sayHi && r < HELLO_CHANCE) speech = 'hello';
    else if (r > 1 - MURMUR_CHANCE * 2) speech = 'murmur';
  }
  const length = MIN_STAY_MS + rng() * (MAX_STAY_MS - MIN_STAY_MS);
  return {
    kind,
    entrance,
    activity,
    exit,
    lineKind: weighted<LineKind>({ greeting: 1, timeOfDay: 1 }, rng),
    speech,
    stalk: false,
    side,
    spot,
    energy,
    durationMs: kind === 'stay' ? Math.round(Math.min(MAX_STAY_MS, length)) : 0,
  };
}

/** Appends a visit to the history, keeping the last RECENT_LIMIT keys. */
export function rememberVisit(recent: readonly string[], v: Visit): string[] {
  return [...recent, visitKey(v)].slice(-RECENT_LIMIT);
}
