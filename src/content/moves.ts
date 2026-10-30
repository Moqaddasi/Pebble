import { REST_POSE } from '../shared/behavior';
import type { Hero } from '../shared/heroes';
import type { VisitPlan } from '../shared/messages';
import { PET_SIZE, type Actor } from './actor';
import type { Stage } from './stage';

export interface Ctx {
  actor: Actor;
  stage: Stage;
  signal: AbortSignal;
  plan: VisitPlan;
  /** Shared across beats: whether Pip is lying on its back right now. */
  flags: { rolling: boolean };
}

export const isCat = (ctx: Ctx) => ctx.plan.traits.temperament === 'cat';

export function weightedPick<T extends string>(w: Record<T, number>): T {
  const entries = Object.entries(w) as [T, number][];
  let r = Math.random() * entries.reduce((s, [, v]) => s + v, 0);
  for (const [k, v] of entries) if ((r -= v) < 0) return k;
  return entries[0][0];
}

/** Rocks the body side to side until stopped (head-rubbing, belly-up wiggles). */
export function rock(actor: Actor, deg: number, ms: number): Animation {
  return actor.body.animate(
    [{ transform: 'rotate(0deg)' }, { transform: `rotate(${deg}deg)` }, { transform: 'rotate(0deg)' }, { transform: `rotate(${-deg}deg)` }, { transform: 'rotate(0deg)' }],
    { duration: ms, iterations: Infinity, easing: 'ease-in-out' },
  );
}

export function linked(parent: AbortSignal): AbortController {
  const c = new AbortController();
  if (parent.aborted) c.abort();
  else parent.addEventListener('abort', () => c.abort(), { once: true });
  return c;
}

export const clampX = (ctx: Ctx, x: number) => Math.min(ctx.stage.width - PET_SIZE - 8, Math.max(8, x));
/** Walking pace follows energy: an ambling lazy Pip, a brisk lively one. */
const HERO_PACE: Record<Hero, number> = { vader: 0.7, spider: 1.3, bat: 1.1 };
export const pace = (ctx: Ctx, factor = 1) => {
  const hero = heroOf(ctx);
  return (40 + ctx.plan.energy * 60) * factor * (hero ? HERO_PACE[hero] : 1);
};

export async function walkTo(ctx: Ctx, x: number, speed = pace(ctx)): Promise<void> {
  const { actor } = ctx;
  actor.setPose('walk', actor.face(x));
  actor.setMode('walking');
  try {
    await actor.moveTo(x, 0, ctx.signal, { speed });
  } finally {
    actor.setMode(null);
  }
}

/** Settles into the resting look, facing whichever way it already faces. */
export function rest(actor: Actor): void {
  actor.setPose(REST_POSE);
}

/** The costumed character in charge of this visit, or null for Classic Pip. */
export const heroOf = (ctx: Ctx): Hero | null => {
  const c = ctx.plan.look.character;
  return c && c !== 'pip' ? c : null;
};

/** A small drawing on the floor (or, with `bottom` 0, the very bottom of the screen); `under` puts it behind the pet. */
export function floorProp(stage: Stage, html: string, bottom = 16, under = false): HTMLDivElement {
  const el = document.createElement('div');
  el.style.cssText = `position:absolute;left:0;bottom:${bottom}px;line-height:0;pointer-events:none`;
  el.innerHTML = html;
  if (under) stage.layer.prepend(el);
  else stage.layer.appendChild(el);
  return el;
}
