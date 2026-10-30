import { describe, expect, it } from 'vitest';
import { Stroke } from '../src/content/stroke';

/** Feeds pointer x positions at 60 Hz, sweeping back and forth; returns when petting was recognized (ms) or null. */
function sweep(stroke: Stroke, { from, to, sweepMs, sweeps, leaveBeyond }: { from: number; to: number; sweepMs: number; sweeps: number; leaveBeyond?: [number, number] }): number | null {
  const frame = 1000 / 60;
  const steps = Math.round(sweepMs / frame);
  let t = 0;
  for (let s = 0; s < sweeps; s++) {
    const [a, b] = s % 2 ? [to, from] : [from, to];
    for (let i = 1; i <= steps; i++) {
      t += frame;
      const x = a + ((b - a) * i) / steps;
      // Outside Pip the pet element gets no pointermove events.
      if (leaveBeyond && (x < leaveBeyond[0] || x > leaveBeyond[1])) continue;
      if (stroke.move(x, t, true)) return t;
    }
  }
  return null;
}

describe('Stroke', () => {
  it('recognizes slow, gentle strokes (under 2px per pointer event)', () => {
    // 36px each way in 400ms at 60Hz ≈ 1.5px per event.
    expect(sweep(new Stroke(), { from: 100, to: 136, sweepMs: 400, sweeps: 6 })).not.toBeNull();
  });

  it('keeps counting when strokes run past Pip’s edges', () => {
    // Pip spans 100–180; each sweep overshoots by 20px on both sides.
    expect(sweep(new Stroke(), { from: 80, to: 200, sweepMs: 400, sweeps: 6, leaveBeyond: [100, 180] })).not.toBeNull();
  });

  it('does not count brushing past once', () => {
    expect(sweep(new Stroke(), { from: 60, to: 220, sweepMs: 300, sweeps: 1, leaveBeyond: [100, 180] })).toBeNull();
  });

  it('starts over after a pause', () => {
    const s = new Stroke();
    s.move(100, 0, true);
    s.move(120, 200, true);
    s.move(100, 400, true); // one reversal
    // Long pause, then one more reversal: not enough on its own.
    s.move(120, 2000, true);
    expect(s.move(100, 2200, true)).toBe(false);
  });

  it('reports petting once per stroke, and only when allowed', () => {
    const s = new Stroke();
    expect(sweep(s, { from: 100, to: 140, sweepMs: 300, sweeps: 6 }) === null).toBe(false);
    // Same continuing stroke: no second report.
    expect(s.move(120, 2100, true)).toBe(false);
    const blocked = new Stroke();
    let reported = false;
    for (let i = 0; i < 40; i++) reported ||= blocked.move(100 + (i % 2) * 30, i * 100, false);
    expect(reported).toBe(false);
  });
});
