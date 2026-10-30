import { describe, expect, it } from 'vitest';
import { ACTIVITIES, RECENT_LIMIT, planVisit, rememberVisit, visitKey, type Visit } from '../src/shared/behavior';
import { rollTraits, type Traits } from '../src/shared/personality';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const cat: Traits = { ...rollTraits('cat', seeded(1)), energy: 0.5, sociability: 0.35, boldness: 0.5, favoriteActivity: 'groom' };
const dog: Traits = { ...rollTraits('dog', seeded(2)), energy: 0.5, sociability: 0.8, boldness: 0.5, favoriteActivity: 'sniff' };

function many(n: number, traits: Traits, hour: number, opts: { sayHi?: boolean; seed?: number } = {}): Visit[] {
  const rng = seeded(opts.seed ?? 7);
  const out: Visit[] = [];
  for (let i = 0; i < n; i++) out.push(planVisit(rng, { traits, hour, bond: 0, sayHi: opts.sayHi ?? false, recent: [] }));
  return out;
}

const share = (vs: Visit[], pred: (v: Visit) => boolean) => vs.filter(pred).length / vs.length;
const stays = (vs: Visit[]) => vs.filter((v) => v.kind === 'stay');

describe('library', () => {
  it('has no performing-for-the-user acts', () => {
    for (const act of ['dance', 'juggle', 'read', 'hum', 'spin', 'waveCursor', 'sneeze']) {
      expect(ACTIVITIES as readonly string[]).not.toContain(act);
    }
  });
});

describe('planVisit', () => {
  it('often just passes through instead of stopping', () => {
    const p = share(many(2000, cat, 11), (v) => v.kind === 'pass');
    expect(p).toBeGreaterThan(0.35);
    expect(p).toBeLessThan(0.75);
  });

  it('naps and loafs most when energy is low', () => {
    const sleepy = stays(many(2000, { ...cat, energy: 0.15 }, 2));
    expect(share(sleepy, (v) => v.activity === 'nap' || v.activity === 'loaf')).toBeGreaterThan(0.5);
  });

  it('only has zoomies when lively at dawn or dusk', () => {
    const lively = { ...cat, energy: 0.9 };
    expect(share(stays(many(3000, lively, 18)), (v) => v.activity === 'zoomies')).toBeGreaterThan(0.02);
    expect(share(stays(many(3000, lively, 12)), (v) => v.activity === 'zoomies')).toBe(0);
    expect(share(stays(many(3000, { ...cat, energy: 0.2 }, 18)), (v) => v.activity === 'zoomies')).toBe(0);
  });

  it('acts like its temperament: cats groom more, dogs sniff more', () => {
    const c = stays(many(3000, { ...cat, favoriteActivity: 'stretch' }, 11));
    const d = stays(many(3000, { ...dog, favoriteActivity: 'stretch' }, 11));
    expect(share(c, (v) => v.activity === 'groom')).toBeGreaterThan(share(d, (v) => v.activity === 'groom'));
    expect(share(d, (v) => v.activity === 'sniff')).toBeGreaterThan(share(c, (v) => v.activity === 'sniff'));
  });

  it('kneads only as a cat, and both temperaments roll over sometimes', () => {
    const c = stays(many(3000, { ...cat, favoriteActivity: 'stretch' }, 11));
    const d = stays(many(3000, { ...dog, favoriteActivity: 'stretch' }, 11));
    expect(share(c, (v) => v.activity === 'knead')).toBeGreaterThan(0.03);
    expect(share(d, (v) => v.activity === 'knead')).toBe(0);
    expect(share(c, (v) => v.activity === 'roll')).toBeGreaterThan(0.02);
    expect(share(d, (v) => v.activity === 'roll')).toBeGreaterThan(0.02);
  });

  it('sometimes stalks the cursor on arrival, but only as a cat', () => {
    const c = stays(many(3000, cat, 11));
    expect(share(c, (v) => v.stalk)).toBeGreaterThan(0.15);
    expect(share(c, (v) => v.stalk)).toBeLessThan(0.35);
    expect(share(stays(many(3000, dog, 11)), (v) => v.stalk)).toBe(0);
    for (const v of many(2000, cat, 11)) if (v.kind === 'pass') expect(v.stalk).toBe(false);
  });

  it('does its favorite thing more often', () => {
    const fav = stays(many(3000, { ...cat, favoriteActivity: 'watch' }, 11));
    const other = stays(many(3000, { ...cat, favoriteActivity: 'stretch' }, 11));
    expect(share(fav, (v) => v.activity === 'watch')).toBeGreaterThan(share(other, (v) => v.activity === 'watch') * 1.4);
  });

  it('settles near its favorite spot', () => {
    for (const v of stays(many(500, { ...cat, favoriteSpot: 0.2 }, 11))) {
      expect(v.spot).toBeGreaterThanOrEqual(0.05);
      expect(v.spot).toBeLessThanOrEqual(0.4);
    }
  });

  it('never says hello unless the user turned it on, and only murmurs rarely', () => {
    const off = many(3000, cat, 11, { sayHi: false });
    expect(share(off, (v) => v.speech === 'hello')).toBe(0);
    expect(share(stays(off), (v) => v.speech === 'murmur')).toBeLessThan(0.12);
    const on = stays(many(3000, cat, 11, { sayHi: true }));
    const hello = share(on, (v) => v.speech === 'hello');
    expect(hello).toBeGreaterThan(0.08);
    expect(hello).toBeLessThan(0.22);
  });

  it('never talks while just passing through', () => {
    for (const v of many(2000, cat, 11, { sayHi: true })) if (v.kind === 'pass') expect(v.speech).toBe('none');
  });

  it('stays between 20 seconds and 90 seconds', () => {
    for (const v of stays(many(500, cat, 11))) {
      expect(v.durationMs).toBeGreaterThanOrEqual(20_000);
      expect(v.durationMs).toBeLessThanOrEqual(90_000);
    }
  });

  it('never repeats a stay within the recent window', () => {
    const rng = seeded(42);
    let recent: string[] = [];
    for (let i = 0; i < 400; i++) {
      const v = planVisit(rng, { traits: cat, hour: 11, bond: 0, sayHi: false, recent });
      if (v.kind === 'stay') expect(recent).not.toContain(visitKey(v));
      recent = rememberVisit(recent, v);
    }
    expect(recent.length).toBeLessThanOrEqual(RECENT_LIMIT);
  });
});
