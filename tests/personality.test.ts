import { describe, expect, it } from 'vitest';
import { applyPetting, decayBond, earnedBerry, energyAt, recordPettingDay, rollTraits, traitWords } from '../src/shared/personality';

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

describe('rollTraits', () => {
  it('makes cats more aloof than dogs', () => {
    const rng = seeded(1);
    for (let i = 0; i < 200; i++) {
      const cat = rollTraits('cat', rng);
      const dog = rollTraits('dog', rng);
      expect(cat.sociability).toBeGreaterThanOrEqual(0.1);
      expect(cat.sociability).toBeLessThanOrEqual(0.6);
      expect(dog.sociability).toBeGreaterThanOrEqual(0.5);
      expect(dog.sociability).toBeLessThanOrEqual(0.95);
    }
  });

  it('keeps every trait within 0–1 and picks a favorite spot and activity', () => {
    const t = rollTraits('cat', seeded(9));
    for (const v of [t.energy, t.sociability, t.boldness, t.favoriteSpot]) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(typeof t.favoriteActivity).toBe('string');
  });

  it('picks a favorite spot in the outer thirds, clear of the reading column', () => {
    const rng = seeded(8);
    for (let i = 0; i < 300; i++) {
      const s = rollTraits('cat', rng).favoriteSpot;
      expect(s < 0.3 || s > 0.7).toBe(true);
    }
  });

  it('can keep the favorite spot when the temperament changes', () => {
    const cat = rollTraits('cat', seeded(4));
    const dog = rollTraits('dog', seeded(5), cat);
    expect(dog.favoriteSpot).toBe(cat.favoriteSpot);
  });
});

describe('energyAt', () => {
  const traits = { ...rollTraits('cat', seeded(2)), energy: 0.5 };

  it('is lower in the early afternoon and late at night than in the morning', () => {
    expect(energyAt(14, traits)).toBeLessThan(energyAt(8, traits));
    expect(energyAt(2, traits)).toBeLessThan(energyAt(8, traits));
  });

  it('gives cats an evening lift that dogs do not get', () => {
    const dog = { ...traits, temperament: 'dog' as const };
    expect(energyAt(18, traits) - energyAt(15, traits)).toBeGreaterThan(energyAt(18, dog) - energyAt(15, dog));
  });

  it('stays within 0–1', () => {
    for (let h = 0; h < 24; h++) {
      for (const energy of [0, 1]) {
        const e = energyAt(h, { ...traits, energy });
        expect(e).toBeGreaterThanOrEqual(0);
        expect(e).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe('bond', () => {
  const day = 24 * 60 * 60 * 1000;

  it('grows by a little per petting session, at most 0.06 a day', () => {
    let b = { value: 0, gainedToday: 0, day: 0 };
    for (let i = 0; i < 10; i++) b = applyPetting(b, 1000);
    expect(b.value).toBeCloseTo(0.06);
    b = applyPetting(b, 1000 + day);
    expect(b.value).toBeCloseTo(0.08);
  });

  it('never goes above 1 or below 0, and fades slowly without petting', () => {
    expect(applyPetting({ value: 0.995, gainedToday: 0, day: 0 }, 0).value).toBe(1);
    expect(decayBond({ value: 0.5, gainedToday: 0, day: 0 }, 10).value).toBeCloseTo(0.45);
    expect(decayBond({ value: 0.01, gainedToday: 0, day: 0 }, 10).value).toBe(0);
  });
});

describe('traitWords', () => {
  it('describes a lazy, aloof, shy Pip and a lively, affectionate, bold one', () => {
    const base = rollTraits('cat', seeded(3));
    expect(traitWords({ ...base, energy: 0.1, sociability: 0.1, boldness: 0.1 })).toEqual(['sleepy', 'independent', 'shy']);
    expect(traitWords({ ...base, energy: 0.9, sociability: 0.9, boldness: 0.9 })).toEqual(['lively', 'affectionate', 'bold']);
  });
});

describe('petting days (Berry unlock)', () => {
  const day = 86_400_000;
  it('counts each calendar day once, however often Pip is petted that day', () => {
    let days: number[] = [];
    days = recordPettingDay(days, 5 * day + 1000);
    days = recordPettingDay(days, 5 * day + 9000);
    expect(days).toEqual([5]);
    days = recordPettingDay(days, 7 * day);
    expect(days).toEqual([5, 7]);
  });

  it('earns Berry on the third different day', () => {
    expect(earnedBerry([1, 2])).toBe(false);
    expect(earnedBerry([1, 2, 9])).toBe(true);
  });

  it('keeps the list short', () => {
    let days: number[] = [];
    for (let d = 0; d < 50; d++) days = recordPettingDay(days, d * day);
    expect(days.length).toBeLessThanOrEqual(10);
  });
});
