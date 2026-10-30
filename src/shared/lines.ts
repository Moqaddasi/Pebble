import type { CharacterId } from './catalog';
import type { LineKind } from './behavior';

/** A bubble line; the user's name goes between `before` and `after`, highlighted. */
export interface Line {
  before: string;
  after: string;
}

export interface LineContext {
  /** Local hour, 0–23. */
  hour: number;
}

const L = (before: string, after: string): Line => ({ before, after });

function pick<T>(list: readonly T[], rng: () => number): T {
  return list[Math.min(list.length - 1, Math.floor(rng() * list.length))];
}

const GREETINGS = [
  L('Hi, ', '! Just popping by.'),
  L('Oh! Hi, ', '. Didn’t see you there.'),
  L('Hey, ', '! Nice tab.'),
  L('Hello, ', '!'),
];

function timeOfDay(hour: number, rng: () => number): Line {
  // Just a hello for the time of day; no advice, nothing asked of the user.
  if (hour >= 5 && hour < 12) return pick([L('Morning, ', '.'), L('Good morning, ', '!')], rng);
  if (hour >= 12 && hour < 17) return pick([L('Afternoon, ', '.'), L('Good afternoon, ', '!')], rng);
  if (hour >= 17 && hour < 23) return pick([L('Evening, ', '.'), L('Good evening, ', '!')], rng);
  return pick([L('Late one, ', '.'), L('Up late too, ', '?')], rng);
}

export function renderLine(kind: LineKind, ctx: LineContext, rng: () => number): Line {
  switch (kind) {
    case 'greeting':
      return pick(GREETINGS, rng);
    case 'timeOfDay':
      return timeOfDay(ctx.hour, rng);
  }
}

/** Pip talking to itself: no name, nothing asked of the user. */
const MURMURS = ['hm…', 'mm…', 'mrrp.', '…'];

export function murmur(rng: () => number): Line {
  return L(pick(MURMURS, rng), '');
}

/** A line that may or may not use the user's name (`named`). */
export interface WaterLine extends Line {
  named: boolean;
}

// Parodies in each character's voice; `{user}` is the user's name, `{pet}` the pet's.
const WATER: Record<CharacterId, readonly string[]> = {
  pip: ['Sip of water, {user}?', 'I brought you some water.', 'Water break?'],
  vader: ['I find your lack of water… disturbing.', '{user}, I am your water reminder.', 'Drink. It is your destiny.'],
  spider: ['My {pet}-sense is tingling… you’re thirsty!', 'With great screen time comes great hydration.', 'Just hanging around. Grab some water?'],
  bat: ['I’m not the hero you deserve. I’m the water you need.', 'The night is long, {user}. Drink.', 'Water. Now.'],
};

const DRANK: Record<CharacterId, readonly string[]> = {
  pip: ['Yay!', 'Nice one, {user}.'],
  vader: ['Impressive. Most impressive.', 'The Force is strong with you.'],
  spider: ['Thwip! That’s my hero.', 'Nailed it!'],
  bat: ['Good. The city is safe.', '…Well done.'],
};

function fill(text: string, petName: string): WaterLine {
  const t = text.replaceAll('{pet}', petName);
  const i = t.indexOf('{user}');
  return i < 0 ? { before: t, after: '', named: false } : { before: t.slice(0, i), after: t.slice(i + '{user}'.length), named: true };
}

export function waterLine(c: CharacterId, petName: string, rng: () => number): WaterLine {
  return fill(pick(WATER[c], rng), petName);
}

export function drankLine(c: CharacterId, petName: string, rng: () => number): WaterLine {
  return fill(pick(DRANK[c], rng), petName);
}
