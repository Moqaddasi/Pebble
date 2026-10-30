import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, hostOf, withDefaults } from '../src/shared/storage';

describe('withDefaults', () => {
  it('returns defaults when nothing is stored', () => {
    expect(withDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it('always keeps free skins unlocked and keeps earned ones', () => {
    const s = withDefaults({ unlocked: ['starry'] });
    expect(s.unlocked).toEqual(expect.arrayContaining(['plain', 'polka', 'stripes', 'cloud', 'starry']));
    expect(s.unlocked).not.toContain('berry');
  });

  it('falls back to Classic when the worn skin is not unlocked', () => {
    expect(withDefaults({ skin: 'berry' }).skin).toBe('plain');
  });

  it('moves colors retired with the new character to their nearest new one', () => {
    expect(withDefaults({ color: '#FFB38A' }).color).toBe('#E8B04B'); // Peach → Honey
    expect(withDefaults({ color: '#9FE0C4' }).color).toBe('#A9C5A0'); // Mint → Sage
    expect(withDefaults({ color: '#C9B8FF' }).color).toBe('#C9B8FF'); // Lilac stays
  });

  it('defaults new installs to Honey', () => {
    expect(withDefaults(undefined).color).toBe('#E8B04B');
  });

  it('moves an older Pip’s favorite spot out of the middle of the page', () => {
    const traits = { temperament: 'cat' as const, energy: 0.5, sociability: 0.5, boldness: 0.5, favoriteSpot: 0.45, favoriteActivity: 'nap' as const };
    expect(withDefaults({ traits }).traits?.favoriteSpot).toBe(0.26);
    expect(withDefaults({ traits: { ...traits, favoriteSpot: 0.6 } }).traits?.favoriteSpot).toBe(0.74);
  });

  it('drops the email saved by earlier versions', () => {
    expect('email' in withDefaults({ email: 'old@example.com' } as never)).toBe(false);
  });

  it('clamps frequency to 1–5', () => {
    expect(withDefaults({ frequency: 9 }).frequency).toBe(5);
    expect(withDefaults({ frequency: 0 }).frequency).toBe(1);
  });
});

describe('hostOf', () => {
  it('returns the hostname for web pages only', () => {
    expect(hostOf('https://news.example.com/a?b')).toBe('news.example.com');
    expect(hostOf('chrome://extensions')).toBeNull();
    expect(hostOf(undefined)).toBeNull();
  });
});

describe('v0.2 settings', () => {
  it('defaults: Classic, visits mode, water off every hour 09:00–21:00, no glasses', () => {
    const s = withDefaults(undefined);
    expect(s.character).toBe('pip');
    expect(s.mode).toBe('visits');
    expect(s.water).toEqual({ on: false, everyMin: 60, from: '09:00', to: '21:00' });
    expect(s.glasses).toEqual({ day: '', count: 0 });
  });

  it('replaces bad values with defaults', () => {
    const s = withDefaults({
      character: 'hulk',
      mode: 'x',
      water: { on: true, everyMin: 7, from: '25:99', to: 'noon' },
      glasses: { day: 3, count: -2 },
    } as never);
    expect(s.character).toBe('pip');
    expect(s.mode).toBe('visits');
    expect(s.water).toEqual({ on: true, everyMin: 60, from: '09:00', to: '21:00' });
    expect(s.glasses).toEqual({ day: '', count: 0 });
  });

  it('keeps a 0.1.1 settings object working', () => {
    const s = withDefaults({ onboarded: true, userName: 'Sara', petName: 'Mochi', pettingDays: [20750] });
    expect(s.userName).toBe('Sara');
    expect(s.pettingDays).toEqual([20750]);
    expect(s.water.on).toBe(false);
  });

  it('keeps valid values', () => {
    const s = withDefaults({ character: 'bat', mode: 'water', water: { on: true, everyMin: 30, from: '22:00', to: '02:00' }, glasses: { day: '2026-10-26', count: 3 } });
    expect(s.character).toBe('bat');
    expect(s.mode).toBe('water');
    expect(s.water).toEqual({ on: true, everyMin: 30, from: '22:00', to: '02:00' });
    expect(s.glasses).toEqual({ day: '2026-10-26', count: 3 });
  });
});
