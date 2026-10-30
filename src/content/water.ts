import { glassSvg } from '../shared/costume';
import { sendToBackground, type VisitPlan, type WaterPlan } from '../shared/messages';
import { WATER_WAIT_MS } from '../shared/water';
import { Actor, PET_SIZE } from './actor';
import { isAborted, reducedMotion, sleep } from './anim';
import { HERO_EXIT_MOVES, hangOnWeb, letGo } from './heroes';
import { heroOf, linked, rest, walkTo, pace, type Ctx } from './moves';
import type { Stage } from './stage';

const GLASS = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 22 30" width="13" height="18" aria-hidden="true" style="display:block;overflow:visible">${glassSvg(9, 24)}</svg>`;

/** Comes over with a glass of water, asks once, and leaves: drank, later, or no answer. */
export async function runWater(stage: Stage, plan: WaterPlan): Promise<void> {
  const actor = new Actor(stage, plan.look, plan.petName, plan.side);
  const main = new AbortController();
  const onVisibility = () => {
    if (document.hidden) main.abort();
  };
  document.addEventListener('visibilitychange', onVisibility);
  // The walking helpers work from a visit plan; a water trip only needs the look and the traits.
  const asVisit = {
    kind: 'stay', entrance: 'walk', activity: 'nap', exit: 'walkAway', lineKind: 'greeting', speech: 'none', stalk: false,
    side: plan.side, spot: 0, energy: 0.6, durationMs: 0, look: plan.look, userName: plan.userName, petName: plan.petName,
    hello: { before: '', after: '' }, traits: plan.traits, bond: 0,
  } satisfies VisitPlan;
  const ctx: Ctx = { actor, stage, signal: main.signal, plan: asVisit, flags: { rolling: false } };
  const hero = heroOf(ctx);
  // Glass toward the middle of the screen: the holding paw is on the drawing's right, the Force paw on its left.
  const towardMiddle = plan.side === 'right';
  const spotX = actor.homeX;
  let answer: string | null = null;

  try {
    if (reducedMotion()) {
      actor.place(spotX, 0);
      await actor.fadeIn(400, main.signal);
    } else if (hero === 'spider') {
      actor.place(spotX, 0);
    } else if (hero === 'bat') {
      actor.place(actor.x, -90);
      actor.setPose('walk', actor.face(spotX));
      await actor.moveTo(spotX, 0, main.signal, { ms: 1100, easing: 'cubic-bezier(.2,.6,.3,1)' });
    } else {
      await walkTo(ctx, spotX, pace(ctx, hero === 'vader' ? 0.55 : 1));
    }

    // Offering the glass, each in its own way.
    if (hero === 'vader') {
      actor.setPose('force', !towardMiddle);
      actor.setProp('forceGlass');
    } else if (hero === 'spider' && !reducedMotion()) {
      actor.setPose('hang', !towardMiddle);
      // Upside down, the held glass is its own element so it stays the right way up.
      actor.addProp(GLASS, towardMiddle ? { left: '-4px', top: '16px' } : { left: `${PET_SIZE - 9}px`, top: '16px' });
      await hangOnWeb(ctx, true, 0);
    } else {
      actor.setPose('offer', towardMiddle);
      actor.setProp('glass');
    }

    const wait = linked(main.signal);
    const timer = setTimeout(() => wait.abort(), WATER_WAIT_MS);
    try {
      answer = await actor.ask(plan.line, plan.line.named ? plan.userName.trim() || 'friend' : null, [{ label: 'Done, I drank', primary: true }, { label: 'Later' }], wait.signal);
    } finally {
      clearTimeout(timer);
    }

    // Record the answer first: the goodbye below can be cut short (tab hidden, page closed).
    if (answer === 'Done, I drank') void sendToBackground({ type: 'waterDone' }).catch(() => {});
    else if (answer === 'Later') void sendToBackground({ type: 'waterLater' }).catch(() => {});
    actor.setProp('none');
    actor.clearProps();
    if (hero === 'spider' && !reducedMotion()) await letGo(ctx);
    if (answer === 'Done, I drank') {
      actor.setPose('happy');
      showChip(actor, '+1 glass');
      actor.say(plan.drank, plan.drank.named ? plan.userName.trim() || 'friend' : null, 2600);
      if (!reducedMotion()) await actor.hop(0, 16, 380, main.signal);
      await sleep(2400, main.signal);
    } else if (answer === 'Later') {
      rest(actor);
      await sleep(400, main.signal);
    }
  } catch (e) {
    if (!isAborted(e)) console.warn('[Pebble] water error', e);
  } finally {
    document.removeEventListener('visibilitychange', onVisibility);
  }

  await leave(ctx);
  actor.destroy();
}

function showChip(actor: Actor, text: string): void {
  const chip = document.createElement('span');
  chip.className = 'chip';
  chip.textContent = text;
  actor.root.append(chip);
  setTimeout(() => chip.remove(), 1900);
}

async function leave(ctx: Ctx): Promise<void> {
  const { actor } = ctx;
  if (document.hidden) return;
  const exit = new AbortController();
  const guard = setTimeout(() => exit.abort(), 8000);
  const exitCtx: Ctx = { ...ctx, signal: exit.signal };
  actor.hideBubble();
  try {
    const hero = heroOf(ctx);
    if (reducedMotion()) await actor.fadeOut(400, exit.signal);
    else if (hero === 'spider') await HERO_EXIT_MOVES.webZip(exitCtx);
    else if (hero === 'bat') await HERO_EXIT_MOVES.vanish(exitCtx);
    else await walkTo(exitCtx, actor.offstageX(actor.nearestEdge), pace(ctx, hero === 'vader' ? 0.6 : 1));
  } catch (e) {
    if (!isAborted(e)) console.warn('[Pebble] water exit error', e);
  } finally {
    clearTimeout(guard);
  }
}
