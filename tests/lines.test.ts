import { describe, expect, it } from 'vitest';
import { LINE_KINDS } from '../src/shared/behavior';
import { murmur, renderLine, waterLine, drankLine } from '../src/shared/lines';

describe('renderLine', () => {
  it('produces short text around the name for every kind', () => {
    for (const kind of LINE_KINDS) {
      for (let i = 0; i < 20; i++) {
        const line = renderLine(kind, { hour: 10 }, () => i / 20);
        // Bubbles hold two lines at 220 px: keep the full sentence short.
        expect((line.before + 'Alexandra' + line.after).length).toBeLessThanOrEqual(40);
      }
    }
  });

  it('never coaches or asks the user to do something', () => {
    for (const kind of LINE_KINDS) {
      for (const hour of [3, 8, 14, 20]) {
        for (let i = 0; i < 20; i++) {
          const { before, after } = renderLine(kind, { hour }, () => i / 20);
          expect(before + after).not.toMatch(/you’ve got|break|stretch|bed|almost done|water|breathe/i);
        }
      }
    }
  });

  it('matches the time of day', () => {
    expect(renderLine('timeOfDay', { hour: 8 }, () => 0).before).toMatch(/morning/i);
    expect(renderLine('timeOfDay', { hour: 14 }, () => 0).before).toMatch(/afternoon/i);
    expect(renderLine('timeOfDay', { hour: 20 }, () => 0).before).toMatch(/evening/i);
    expect(renderLine('timeOfDay', { hour: 1 }, () => 0).before).toMatch(/late/i);
  });
});

describe('murmur', () => {
  it('is Pip talking to itself, with no name slot', () => {
    for (let i = 0; i < 10; i++) {
      const m = murmur(() => i / 10);
      expect(m.after).toBe('');
      expect(m.before.length).toBeLessThanOrEqual(6);
    }
  });
});

describe('water lines', () => {
  const ids = ['pip', 'vader', 'spider', 'bat'] as const;
  it('every character has a reminder and a thank-you, with the pet name filled in', () => {
    for (const c of ids) {
      for (const r of [0, 0.5, 0.99]) {
        const w = waterLine(c, 'Mochi', () => r);
        const d = drankLine(c, 'Mochi', () => r);
        for (const l of [w, d]) {
          expect((l.before + l.after).length).toBeGreaterThan(0);
          expect(l.before + l.after).not.toContain('{');
        }
      }
    }
  });
  it('puts the user’s name in the name slot when the line uses it', () => {
    const l = waterLine('vader', 'Mochi', () => 0.4);
    expect(l).toEqual({ before: '', after: ', I am your water reminder.', named: true });
  });
  it('fills in the pet name', () => {
    expect(waterLine('spider', 'Mochi', () => 0).before).toBe('My Mochi-sense is tingling… you’re thirsty!');
  });
});
