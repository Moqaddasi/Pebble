import { describe, expect, it } from 'vitest';
import { planVisit, type Visit } from '../src/shared/behavior';
import { HERO_ACTIVITIES, HERO_ENTRANCES, HERO_EXITS } from '../src/shared/heroes';
import { rollTraits, type Traits } from '../src/shared/personality';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const traits: Traits = { ...rollTraits('cat', seeded(3)), energy: 0.6 };
const plan = (character: 'pip' | 'vader' | 'spider' | 'bat', n = 1000, t = traits): Visit[] => {
  const rng = seeded(11);
  return Array.from({ length: n }, () => planVisit(rng, { traits: t, hour: 11, bond: 0, sayHi: false, recent: [], character }));
};

describe('hero personalities', () => {
  for (const c of ['vader', 'spider', 'bat'] as const) {
    it(`${c} only does its own things`, () => {
      const vs = plan(c);
      for (const v of vs) {
        expect(HERO_ACTIVITIES[c]).toContain(v.activity);
        expect(['walk', HERO_ENTRANCES[c]]).toContain(v.entrance);
        expect(['walkAway', HERO_EXITS[c]]).toContain(v.exit);
        expect(v.stalk).toBe(false);
      }
      // Its signature moves actually show up.
      expect(vs.filter((v) => v.entrance === HERO_ENTRANCES[c]).length).toBeGreaterThan(300);
      expect(new Set(vs.map((v) => v.activity)).size).toBe(HERO_ACTIVITIES[c].length);
    });
  }

  it('Classic Pip never does hero things', () => {
    const heroish = new Set(Object.values(HERO_ACTIVITIES).flat().filter((a) => a !== 'nap' && a !== 'patrol'));
    for (const v of plan('pip')) expect(heroish.has(v.activity as never)).toBe(false);
  });
});

describe('more Classic behaviors', () => {
  it('cats never chase their tail or dig; dogs sometimes do', () => {
    const cats = plan('pip', 3000);
    expect(cats.some((v) => v.activity === 'chaseTail' || v.activity === 'dig')).toBe(false);
    const dogTraits: Traits = { ...rollTraits('dog', seeded(4)), energy: 0.8 };
    const dogs = plan('pip', 3000, dogTraits);
    expect(dogs.some((v) => v.activity === 'chaseTail')).toBe(true);
    expect(dogs.some((v) => v.activity === 'dig')).toBe(true);
  });
  it('everyone scratches, watches a ladybug and finds a sunbeam now and then', () => {
    const vs = plan('pip', 3000);
    for (const a of ['scratch', 'ladybug', 'sunbeam']) expect(vs.some((v) => v.activity === a)).toBe(true);
  });
});
