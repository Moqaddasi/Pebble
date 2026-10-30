import { REST_POSE, activityWeights, type Activity, type Entrance, type Exit } from '../shared/behavior';
import { heroWeights, type HeroActivity, type HeroEntrance, type HeroExit } from '../shared/heroes';
import type { Pose } from '../shared/catalog';
import { sendToBackground, type VisitPlan } from '../shared/messages';
import { Actor, PET_SIZE } from './actor';
import { clampX, floorProp, heroOf, isCat, linked, pace, rest, rock, walkTo, weightedPick, type Ctx } from './moves';
import { animate, isAborted, pick, rand, reducedMotion, sleep } from './anim';
import { HERO_ENTRANCE_MOVES, HERO_EXIT_MOVES, HERO_MOVES, HERO_REACTIONS } from './heroes';
import { BUTTERFLY, DIRT, LADYBUG, SUNBEAM } from './props';
import type { Stage } from './stage';
import { Touch, type TouchEvent } from './touch';

/* ---------- arriving at its spot ---------- */

const ENTRANCES: Record<Entrance, (ctx: Ctx, spotX: number) => Promise<void>> = {
  async walk(ctx, spotX) {
    await walkTo(ctx, spotX);
  },
  // A shy Pip checks the coast is clear before coming in.
  async peek(ctx, spotX) {
    const { actor, stage, signal } = ctx;
    const peekX = actor.side === 'right' ? stage.width - PET_SIZE * 0.45 : -PET_SIZE * 0.55;
    const facingIn = actor.side === 'right';
    actor.setPose(REST_POSE, facingIn);
    await actor.moveTo(peekX, 0, signal, { ms: 700 });
    actor.setPose(facingIn ? 'lookRight' : 'lookLeft', facingIn);
    await sleep(1600, signal);
    await walkTo(ctx, spotX, pace(ctx, 0.8));
  },
  // A slow amble, with a stop to sniff on the way.
  async saunter(ctx, spotX) {
    const { actor, signal } = ctx;
    await walkTo(ctx, (actor.x + spotX) / 2, pace(ctx, 0.7));
    actor.setPose('sniff', actor.face(spotX));
    await sleep(1300, signal);
    await walkTo(ctx, spotX, pace(ctx, 0.7));
  },
};

/* ---------- doing its own thing ---------- */

const ACTIVITIES: Record<Activity, (ctx: Ctx) => Promise<void>> = {
  async wander(ctx) {
    const { actor, signal } = ctx;
    await walkTo(ctx, clampX(ctx, actor.x + rand(-160, 160)), pace(ctx, 0.7));
    actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'lookUp']));
    await sleep(rand(1500, 2500), signal);
  },
  async lookAround({ actor, signal }) {
    for (const pose of ['lookLeft', 'lookRight', 'lookUp', REST_POSE] as Pose[]) {
      actor.setPose(pose);
      await sleep(rand(1200, 2000), signal);
    }
  },
  async groom({ actor, signal }) {
    actor.setPose('groom');
    // Small head dips, like licking a paw.
    for (let i = 0; i < 4; i++) {
      await animate(actor.body, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-4deg) translateY(1px)' }, { transform: 'rotate(0deg)' }], { duration: 520, easing: 'ease-in-out' }, signal);
    }
    actor.setPose('blink');
    await sleep(700, signal);
  },
  async stretch({ actor, signal }) {
    actor.setPose('blink');
    await animate(
      actor.body,
      [{ transform: 'scale(1,1)' }, { transform: 'scale(1.12,.86)' }, { transform: 'scale(.95,1.08)' }, { transform: 'scale(1,1)' }],
      { duration: 1900, easing: 'ease-in-out' },
      signal,
    );
    rest(actor);
    await sleep(800, signal);
  },
  async nap(ctx) {
    const { actor, signal } = ctx;
    actor.setPose('loaf');
    actor.setMode('resting');
    await sleep(1600, signal);
    // Dogs often yawn as they settle (AKC).
    if (!isCat(ctx) || Math.random() < 0.3) {
      actor.setPose('yawn');
      await sleep(1300, signal);
    }
    actor.setPose('sleep');
    await sleep(rand(10000, 18000), signal);
    actor.setPose('blink');
    await sleep(700, signal);
    actor.setMode(null);
    if (!isCat(ctx)) {
      // A shake-off on waking.
      await animate(actor.body, [0, 10, -10, 9, -9, 6, -6, 0].map((d) => ({ transform: `rotate(${d}deg)` })), { duration: 600 }, signal);
    }
    rest(actor);
    await sleep(600, signal);
  },
  // "Making biscuits": paws press in turn, eyes heavy. A relaxed, content cat.
  async knead({ actor, signal }) {
    actor.setMode('resting');
    const until = Date.now() + rand(5000, 8000);
    for (let i = 0; Date.now() < until; i++) {
      actor.setPose(i % 2 ? 'kneadR' : 'kneadL');
      await sleep(380, signal);
    }
    actor.setPose('drowsy');
    await sleep(1200, signal);
    actor.setMode(null);
  },
  // Cats: a relaxed social roll (not an invitation to touch the belly). Dogs: belly-up, rubs welcome.
  async roll(ctx) {
    const { actor, signal } = ctx;
    ctx.flags.rolling = true;
    actor.setPose('bellyUp');
    const wiggle = rock(actor, 6, 1400);
    try {
      await sleep(rand(3000, 5000), signal);
    } finally {
      wiggle.cancel();
      ctx.flags.rolling = false;
    }
    actor.setPose('blink');
    await sleep(500, signal);
    rest(actor);
    await sleep(600, signal);
  },
  async loaf({ actor, signal }) {
    actor.setPose('loaf');
    actor.setMode('resting');
    await sleep(rand(8000, 14000), signal);
    actor.setMode(null);
  },
  async sniff(ctx) {
    const { actor, signal } = ctx;
    const dir = Math.random() < 0.5 ? -1 : 1;
    for (let i = 0; i < 2; i++) {
      await walkTo(ctx, clampX(ctx, actor.x + dir * rand(30, 60)), pace(ctx, 0.5));
      actor.setPose('sniff');
      await sleep(rand(1200, 1800), signal);
    }
    actor.setPose('lookUp');
    await sleep(1000, signal);
  },
  // A butterfly drifts past at a distance; Pip turns to follow it with its eyes.
  async watch(ctx) {
    const { actor, stage, signal } = ctx;
    const fromLeft = Math.random() < 0.5;
    const startX = fromLeft ? -40 : stage.width + 40;
    const endX = fromLeft ? stage.width + 40 : -40;
    const fly = document.createElement('div');
    fly.style.cssText = 'position:absolute;left:0;bottom:0;line-height:0;pointer-events:none';
    fly.innerHTML = BUTTERFLY;
    stage.layer.appendChild(fly);
    const frames = [0, 0.25, 0.5, 0.75, 1].map((t) => ({
      transform: `translate(${startX + (endX - startX) * t}px, ${-(160 + Math.sin(t * Math.PI * 3) * 40)}px)`,
    }));
    const duration = 9000;
    const flight = animate(fly, frames, { duration, easing: 'linear' }, signal);
    // Awaited below; if the beat is interrupted first, don't leave its rejection unhandled.
    flight.catch(() => {});
    const started = performance.now();
    try {
      let pounced = false;
      while (performance.now() - started < duration) {
        const t = (performance.now() - started) / duration;
        const dx = startX + (endX - startX) * t - (actor.x + PET_SIZE / 2);
        actor.setPose(Math.abs(dx) < 90 ? 'lookUp' : REST_POSE, dx < 0);
        if (!pounced && Math.abs(dx) < 30 && Math.random() < ctx.plan.energy * 0.5) {
          pounced = true;
          await actor.hop(0, 18, 420, signal);
        }
        await sleep(200, signal);
      }
      await flight;
    } finally {
      fly.remove();
    }
  },
  // A burst of energy: a few fast dashes with sudden stops, then a flop.
  async zoomies(ctx) {
    const { actor, stage, signal } = ctx;
    for (let i = 0; i < 3; i++) {
      const across = actor.x > stage.width / 2 ? rand(40, stage.width * 0.3) : rand(stage.width * 0.7, stage.width - 120);
      const target = clampX(ctx, i % 2 === 0 ? across : actor.x + rand(-200, 200));
      const left = target < actor.x;
      actor.setPose('walk', left);
      actor.root.style.setProperty('--lean', left ? '-8deg' : '8deg');
      actor.setMode('running');
      try {
        await actor.moveTo(target, 0, signal, { speed: rand(380, 480), easing: 'cubic-bezier(.4,0,.2,1)' });
      } finally {
        actor.setMode(null);
      }
      // Skid to a stop.
      await animate(actor.body, [{ transform: 'none' }, { transform: `skewX(${left ? 12 : -12}deg) scale(1.06,.94)` }, { transform: 'none' }], { duration: 260 }, signal);
      actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'surprised']));
      await sleep(rand(300, 700), signal);
    }
    actor.setPose('loaf');
    actor.setMode('resting');
    await sleep(3000, signal);
    actor.setMode(null);
  },
  // A back paw up behind the head: a quick, busy scratch, then a shake.
  async scratch({ actor, signal }) {
    actor.setPose('scratch');
    const busy = actor.body.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg)' }, { transform: 'rotate(0deg)' }], { duration: 140, iterations: Infinity });
    try {
      await sleep(rand(1600, 2600), signal);
    } finally {
      busy.cancel();
    }
    actor.setPose('blink');
    await animate(actor.body, [0, 7, -7, 5, -5, 0].map((d) => ({ transform: `rotate(${d}deg)` })), { duration: 450 }, signal);
    rest(actor);
    await sleep(600, signal);
  },
  // A ladybug crawls past along the floor. A cat watches, then pats it (it flies off); a dog sniffs it.
  async ladybug(ctx) {
    const { actor, stage, signal } = ctx;
    const fromRight = actor.x < stage.width / 2;
    const bugX = (x: number) => `translate(${x}px, -16px) scaleX(${fromRight ? -1 : 1})`;
    const startX = fromRight ? actor.x + PET_SIZE + 160 : actor.x - 160;
    const stopX = fromRight ? actor.x + PET_SIZE + 8 : actor.x - 26;
    const bug = floorProp(stage, LADYBUG);
    try {
      actor.setPose('lookAround', !fromRight);
      await animate(bug, [{ transform: bugX(startX) }, { transform: bugX(stopX) }], { duration: 5000, easing: 'linear' }, signal);
      if (isCat(ctx)) {
        actor.setPose('glance', !fromRight);
        await sleep(900, signal);
        actor.setPose('swat', !fromRight);
        await sleep(300, signal);
      } else {
        actor.setPose('sniff', !fromRight);
        await sleep(1400, signal);
      }
      // Off it flies.
      await animate(bug, [{ transform: bugX(stopX) }, { transform: `translate(${stopX + (fromRight ? 60 : -60)}px, -160px)` }], { duration: 900, easing: 'ease-in' }, signal);
      actor.setPose('lookUp', !fromRight);
      await sleep(1200, signal);
    } finally {
      bug.remove();
    }
    rest(actor);
  },
  // Finds a warm patch of light, stretches out in it and dozes.
  async sunbeam({ actor, stage, signal }) {
    const sun = floorProp(stage, SUNBEAM, 0, true);
    sun.style.transform = `translate(${actor.x + PET_SIZE / 2 - 80}px, 0)`;
    try {
      await animate(sun, [{ opacity: 0 }, { opacity: 1 }], { duration: 1500 }, signal);
      actor.setPose('loaf');
      actor.setMode('resting');
      await sleep(2500, signal);
      actor.setPose('sleep');
      await sleep(rand(7000, 11000), signal);
      actor.setPose('blink');
      await sleep(600, signal);
      await animate(sun, [{ opacity: 1 }, { opacity: 0 }], { duration: 1200 }, signal);
    } finally {
      sun.remove();
      actor.setMode(null);
    }
    rest(actor);
  },
  // Dogs: notices its own tail and spins after it a few times.
  async chaseTail({ actor, signal }) {
    actor.setWag(true);
    try {
      for (let i = 0; i < 6; i++) {
        actor.setPose('walk', i % 2 === 0);
        await actor.hop(0, 8, 220, signal);
      }
    } finally {
      actor.setWag(false);
    }
    actor.setPose('happy');
    await sleep(900, signal);
    rest(actor);
  },
  // Spots something on the floor, wiggles, pounces on it… nothing there.
  async pounce(ctx) {
    const { actor, signal } = ctx;
    const dir = Math.random() < 0.5 ? -1 : 1;
    actor.setPose('sniff', dir < 0);
    await sleep(rand(900, 1400), signal);
    const wiggle = rock(actor, 3, 260);
    try {
      await sleep(rand(700, 1100), signal);
    } finally {
      wiggle.cancel();
    }
    await actor.hop(clampX(ctx, actor.x + dir * rand(36, 60)) - actor.x, rand(18, 26), 380, signal);
    actor.setPose('surprised', dir < 0);
    await sleep(600, signal);
    if (isCat(ctx)) await ACTIVITIES.groom(ctx);
    else {
      actor.setWag(true);
      actor.setPose('happy');
      await sleep(900, signal);
      actor.setWag(false);
    }
    rest(actor);
  },
  // Dogs: digs at the floor, dirt flying out behind.
  async dig({ actor, stage, signal }) {
    actor.setPose('dig');
    const until = Date.now() + rand(2500, 4000);
    while (Date.now() < until) {
      const d = floorProp(stage, DIRT);
      d.style.setProperty('--dx', `${actor.facingLeft ? rand(10, 30) : -rand(10, 30)}px`);
      d.style.left = `${actor.x + PET_SIZE / 2}px`;
      d.style.animation = 'pp-rise .7s ease-out forwards';
      setTimeout(() => d.remove(), 800);
      await animate(actor.body, [{ transform: 'translateY(0)' }, { transform: 'translateY(2px)' }, { transform: 'translateY(0)' }], { duration: 200 }, signal);
    }
    actor.setPose('sniff');
    await sleep(1200, signal);
    rest(actor);
  },
};

/** A small drawing placed on the floor (or, with `bottom` 0, the very bottom of the screen). */


/** Classic Pip's moves first, then the characters' own. */
function enterMove(e: Entrance | HeroEntrance): (ctx: Ctx, spotX: number) => Promise<void> {
  return e in ENTRANCES ? ENTRANCES[e as Entrance] : HERO_ENTRANCE_MOVES[e as HeroEntrance];
}

function activityMove(a: Activity | HeroActivity): (ctx: Ctx) => Promise<void> {
  return a in ACTIVITIES ? ACTIVITIES[a as Activity] : HERO_MOVES[a as Exclude<HeroActivity, 'nap'>];
}

function exitMove(x: Exit | HeroExit): (ctx: Ctx) => Promise<void> {
  return x in EXITS ? EXITS[x as Exit] : HERO_EXIT_MOVES[x as Exclude<HeroExit, 'walkAway'>];
}

/** What to do next: weighted by who it is and how lively it feels, never a repeat of the last thing. */
function nextActivity(ctx: Ctx, last: Activity | HeroActivity): Activity | HeroActivity {
  const hero = heroOf(ctx);
  const weights: Record<string, number> = hero
    ? { ...heroWeights(hero, ctx.plan.energy) }
    : { ...activityWeights(ctx.plan.traits, ctx.plan.energy, new Date().getHours()) };
  delete weights[last];
  // Long rests only once in a while.
  if (last === 'nap' || last === 'sunbeam' || last === 'loaf' || last === 'brood' || last === 'meditate') {
    for (const k of ['nap', 'sunbeam', 'loaf', 'brood', 'meditate']) delete weights[k];
  }
  for (const k of Object.keys(weights)) if (!(weights[k] > 0)) delete weights[k];
  return Object.keys(weights).length ? (weightedPick(weights) as Activity | HeroActivity) : last;
}

/** A small thing between activities, so pauses aren't all the same. */
async function fidget(ctx: Ctx): Promise<void> {
  const { actor, signal } = ctx;
  const hero = heroOf(ctx);
  const r = Math.random();
  if (hero === 'vader') {
    // Big, slow breath.
    await animate(actor.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.05, .97)' }, { transform: 'scale(1)' }], { duration: 1500 }, signal);
  } else if (hero === 'spider') {
    // Can't stand still: a little bounce.
    if (r < 0.5) await actor.hop(0, 10, 300, signal);
    else actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'tilt']));
  } else if (hero === 'bat') {
    actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'drowsy']));
  } else if (r < 0.25) {
    actor.setPose('blink');
    await sleep(500, signal);
  } else if (r < 0.45) {
    actor.setPose(isCat(ctx) ? 'yawn' : 'tilt');
    await sleep(1100, signal);
  } else if (r < 0.7) {
    actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'lookUp']));
    await sleep(rand(900, 1500), signal);
  } else {
    // A small shuffle on the spot.
    await walkTo(ctx, clampX(ctx, actor.x + rand(-40, 40)), pace(ctx, 0.5));
  }
  rest(actor);
}

async function restBeat(ctx: Ctx, mayGlance: () => boolean): Promise<void> {
  const { actor, signal } = ctx;
  // Now and then it turns to face the other way, like a pet shifting its attention.
  actor.setPose(REST_POSE, Math.random() < 0.3 ? !actor.facingLeft : actor.facingLeft);
  actor.setMode('resting');
  try {
    if (mayGlance()) {
      await sleep(rand(1000, 2000), signal);
      actor.setPose('glance');
      await sleep(900, signal);
      rest(actor);
    }
    // Characters don't sit still as long; everyone fidgets a little partway through.
    const pause = heroOf(ctx) ? rand(1500, 3000) : rand(2000, 4000);
    await sleep(pause / 2, signal);
    if (Math.random() < 0.6) await fidget(ctx);
    await sleep(pause / 2, signal);
  } finally {
    actor.setMode(null);
  }
}

/**
 * A cat's hunting game with the cursor: eyes lock on and follow it, a butt-wiggle,
 * a tiny pounce that misses, a surprised look, then grooming as if nothing happened.
 */
async function stalkCursor(ctx: Ctx, touch: Touch): Promise<void> {
  const { actor, signal } = ctx;
  if (touch.cursorX === null) return;
  actor.setPose('glance', touch.cursorX < actor.center.x);
  const until = Date.now() + rand(2500, 3500);
  while (Date.now() < until) {
    if (touch.cursorX !== null) actor.lookAt(touch.cursorX, touch.cursorY);
    await sleep(90, signal);
  }
  // The wiggle before the pounce.
  const wiggle = actor.body.animate(
    [{ transform: 'rotate(0deg)' }, { transform: 'rotate(3deg) translateY(1px)' }, { transform: 'rotate(0deg)' }, { transform: 'rotate(-3deg) translateY(1px)' }, { transform: 'rotate(0deg)' }],
    { duration: 260, iterations: 3 },
  );
  try {
    for (let i = 0; i < 8; i++) {
      if (touch.cursorX !== null) actor.lookAt(touch.cursorX, touch.cursorY);
      await sleep(95, signal);
    }
  } finally {
    wiggle.cancel();
  }
  // A tiny pounce toward it, nowhere near catching it.
  const toward = touch.cursorX !== null && touch.cursorX < actor.center.x ? -1 : 1;
  await actor.hop(clampX(ctx, actor.x + toward * rand(14, 26)) - actor.x, rand(14, 20), 360, signal);
  actor.setPose('surprised');
  await sleep(500, signal);
  // …and pretends that never happened.
  await ACTIVITIES.groom(ctx);
  rest(actor);
}

/* ---------- leaving ---------- */

const EXITS: Record<Exit, (ctx: Ctx) => Promise<void>> = {
  async walkAway(ctx) {
    await walkTo(ctx, ctx.actor.offstageX(ctx.actor.nearestEdge));
  },
  async tiptoe(ctx) {
    await walkTo(ctx, ctx.actor.offstageX(ctx.actor.nearestEdge), pace(ctx, 0.6));
  },
  async curlUp({ actor, signal }) {
    actor.setPose('loaf');
    actor.setMode('resting');
    await sleep(1500, signal);
    actor.setPose('sleep');
    await sleep(2000, signal);
    await actor.fadeOut(1500, signal);
  },
};

/* ---------- when the user reaches out (never asked for) ---------- */

/** Extra time a stay may gain from being petted. */
const MAX_PET_BONUS_MS = 30_000;

/** How long Pip enjoys petting before deciding that's enough. */
function tolerance(ctx: Ctx): number {
  const { plan } = ctx;
  // Characters: Vader puts up with it briefly, Spider loves it, Bat pretends not to.
  const hero = heroOf(ctx);
  if (hero) return hero === 'spider' ? rand(5000, 8000) : rand(3000, 5000) + plan.bond * 3000;
  return plan.traits.temperament === 'cat' ? rand(2000, 4000) + plan.bond * 4000 : rand(5000, 9000);
}

async function hadEnough(ctx: Ctx, touch: Touch): Promise<void> {
  const { actor, signal } = ctx;
  touch.ignoreFor(8000);
  const hero = heroOf(ctx);
  if (hero) return HERO_REACTIONS[hero].enough(ctx);
  const away = actor.x + PET_SIZE / 2 > ctx.stage.width / 2 ? -1 : 1;
  if (ctx.plan.traits.temperament === 'cat') {
    actor.setPose('annoyed');
    actor.flickSprout();
    await sleep(700, signal);
    await walkTo(ctx, clampX(ctx, actor.x + away * rand(90, 130)), pace(ctx, 0.9));
    // Cats groom after contact, checking the scent you left.
    await ACTIVITIES.groom(ctx);
  } else {
    // A dog just wanders off to sniff something, tail still going.
    actor.setWag(true);
    await walkTo(ctx, clampX(ctx, actor.x + away * rand(90, 130)), pace(ctx));
    actor.setWag(false);
    await ACTIVITIES.sniff(ctx);
  }
}

/** Returns how long the petting lasted, so the stay can stretch a little. */
async function beingPetted(ctx: Ctx, touch: Touch): Promise<number> {
  const { actor, signal } = ctx;
  // A cat's belly is not an invitation (iCatCare): touching it mid-roll earns a bap.
  if (ctx.flags.rolling && isCat(ctx)) {
    await bap(ctx, touch);
    return 0;
  }
  const started = Date.now();
  const enough = tolerance(ctx);
  actor.setMode(null);
  // Dogs on their back stay there for the rubs; others lean in, cats rubbing their cheek on you.
  actor.setPose(ctx.flags.rolling ? 'bellyUp' : 'content');
  actor.setWag(true);
  const calm = isCat(ctx) || heroOf(ctx) === 'vader' || heroOf(ctx) === 'bat';
  const lean = rock(actor, calm ? 4 : 7, calm ? 1600 : 700);
  let rolled = ctx.flags.rolling;
  try {
    while (Date.now() - touch.lastPetMove < 700) {
      if (!isCat(ctx) && !heroOf(ctx) && !rolled && Date.now() - started > 2000 && Math.random() < 0.02) {
        // A happy dog flops over for belly rubs.
        rolled = true;
        actor.setPose('bellyUp');
      }
      if (Date.now() - started > enough) {
        lean.cancel();
        actor.setWag(false);
        void sendToBackground({ type: 'petted' }).catch(() => {});
        await hadEnough(ctx, touch);
        return Date.now() - started;
      }
      await sleep(120, signal);
    }
  } finally {
    lean.cancel();
    actor.setWag(false);
  }
  if (Date.now() - started > 1500) void sendToBackground({ type: 'petted' }).catch(() => {});
  rest(actor);
  await sleep(500, signal);
  return Date.now() - started;
}

/** A quick paw-bap toward the cursor, then it moves off a little. */
async function bap(ctx: Ctx, touch: Touch): Promise<void> {
  const { actor, signal } = ctx;
  touch.ignoreFor(8000);
  ctx.flags.rolling = false;
  const toLeft = touch.cursorX !== null && touch.cursorX < actor.center.x;
  actor.setPose('swat', toLeft);
  actor.flickSprout();
  await animate(actor.body, [{ transform: 'none' }, { transform: `translateX(${toLeft ? -6 : 6}px)` }, { transform: 'none' }], { duration: 220 }, signal);
  await sleep(600, signal);
  actor.setPose('annoyed');
  await sleep(500, signal);
  await walkTo(ctx, clampX(ctx, actor.x + (toLeft ? 1 : -1) * rand(80, 120)), pace(ctx));
  await ACTIVITIES.groom(ctx);
}

/** A click: Pip turns and looks at you. A cat may chirp; a dog wags. */
async function lookAtYou(ctx: Ctx, touch: Touch): Promise<void> {
  const { actor, signal } = ctx;
  const hero = heroOf(ctx);
  if (hero) return HERO_REACTIONS[hero].boop(ctx);
  if (ctx.flags.rolling) {
    if (isCat(ctx)) return bap(ctx, touch);
    actor.setPose('bellyUp');
    actor.setWag(true);
    await sleep(1200, signal);
    actor.setWag(false);
    return;
  }
  actor.setPose('glance');
  if (isCat(ctx)) {
    if (Math.random() < 0.3) actor.say({ before: pick(['mrrp?', 'prrp.', 'mew?']), after: '' }, null, 1500);
    await sleep(1300, signal);
  } else {
    actor.setWag(true);
    await actor.hop(0, 10, 320, signal);
    if (Math.random() < 0.25) actor.say({ before: 'boof!', after: '' }, null, 1300);
    await sleep(1000, signal);
    actor.setWag(false);
  }
  rest(actor);
}

/** Too many clicks: a reaction that fits the temperament, picked at random. */
async function tooMuch(ctx: Ctx, touch: Touch): Promise<void> {
  const { actor, signal } = ctx;
  touch.ignoreFor(10000);
  ctx.flags.rolling = false;
  const hero = heroOf(ctx);
  if (hero) return HERO_REACTIONS[hero].tooMuch(ctx, touch.cursorX !== null && touch.cursorX < actor.center.x ? 1 : -1);
  if (isCat(ctx)) {
    const r = weightedPick({ bap: 0.3, hiss: 0.25, turnAway: 0.25, zoomies: 0.2 });
    if (r === 'bap') return bap(ctx, touch);
    if (r === 'zoomies') return ACTIVITIES.zoomies(ctx);
    if (r === 'hiss') {
      // Puffs up and hisses, then stalks off.
      actor.setPose('hiss');
      actor.say({ before: 'hss!', after: '' }, null, 1300);
      await animate(actor.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)' }, { transform: 'scale(1.1)' }], { duration: 500, fill: 'forwards' }, signal);
      await sleep(900, signal);
      actor.body.style.transform = '';
      actor.flickSprout();
    }
    // Stalks off a little and sits with its back to you, ignoring you.
    if (r === 'turnAway') {
      actor.setPose('annoyed');
      actor.flickSprout();
      await sleep(500, signal);
    }
    const away = touch.cursorX !== null && touch.cursorX < actor.center.x ? 1 : -1;
    await walkTo(ctx, clampX(ctx, actor.x + away * rand(90, 150)), pace(ctx, r === 'hiss' ? 1.5 : 1));
    actor.setPose('away', away < 0);
    actor.setMode('resting');
    await sleep(rand(5000, 8000), signal);
    actor.setMode(null);
    return;
  }
  const r = weightedPick({ zoomies: 0.35, playBow: 0.35, bellyUp: 0.3 });
  if (r === 'zoomies') return ACTIVITIES.zoomies(ctx);
  if (r === 'bellyUp') return ACTIVITIES.roll(ctx);
  // Play bow (AKC): front down, rear up, then a bouncy hop back.
  actor.setWag(true);
  for (let i = 0; i < 2; i++) {
    actor.setPose('bow');
    if (i === 0) actor.say({ before: 'boof!', after: '' }, null, 1300);
    await sleep(700, signal);
    actor.setPose('happy');
    await actor.hop(0, 16, 380, signal);
  }
  actor.setWag(false);
  rest(actor);
}

/** Cats: eyes soften, close slowly, open again. Dogs: a curious head tilt. */
async function returnLook(ctx: Ctx): Promise<void> {
  const { actor, signal, plan } = ctx;
  const hero = heroOf(ctx);
  if (hero) return HERO_REACTIONS[hero].stillNear(ctx);
  if (plan.traits.temperament === 'dog') {
    actor.setPose('tilt');
    await sleep(1300, signal);
  } else {
    actor.setPose('drowsy');
    await sleep(600, signal);
    actor.setPose('blink');
    await sleep(900, signal);
    actor.setPose('drowsy');
    await sleep(500, signal);
  }
  rest(actor);
  await sleep(400, signal);
}

async function react(ctx: Ctx, touch: Touch, e: TouchEvent): Promise<number> {
  switch (e) {
    case 'pet':
      return beingPetted(ctx, touch);
    case 'boop':
      await lookAtYou(ctx, touch);
      return 0;
    case 'tooManyBoops':
      await tooMuch(ctx, touch);
      return 0;
    case 'stillNear':
      await returnLook(ctx);
      return 0;
  }
}

/** Whether Pip responds at all. An aloof Pip often just carries on. */
function accepts(e: TouchEvent, plan: VisitPlan): boolean {
  if (e === 'pet') return Math.random() >= (1 - plan.traits.sociability) * 0.5;
  if (e === 'stillNear') return Math.random() < 0.15 + plan.bond * 0.5;
  return true;
}

/* ---------- the visit ---------- */

type Ending = 'normal' | 'dismissed' | 'snoozed' | 'hidden';

/** Plays one appearance and resolves once Pip has left and been removed. */
export async function runVisit(stage: Stage, plan: VisitPlan): Promise<void> {
  const actor = new Actor(stage, plan.look, plan.petName, plan.side);
  const main = new AbortController();
  let ending: Ending = 'normal';
  const end = (why: Ending) => {
    if (ending === 'normal') ending = why;
    main.abort();
  };
  actor.showControls(
    () => end('dismissed'),
    () => {
      void sendToBackground({ type: 'snooze' });
      end('snoozed');
    },
  );
  const onVisibility = () => {
    if (document.hidden) end('hidden');
  };
  document.addEventListener('visibilitychange', onVisibility);

  const ctx: Ctx = { actor, stage, signal: main.signal, plan, flags: { rolling: false } };
  const reduce = reducedMotion();
  const state: StayState = { pending: null, beat: linked(main.signal) };
  const touch = new Touch(actor, (e) => {
    if (!accepts(e, plan)) {
      if (e === 'pet') touch.ignoreFor(4000);
      return;
    }
    state.pending = e;
    state.beat.abort();
  });

  try {
    if (plan.kind === 'pass') await passThrough(ctx, touch, reduce, state);
    else await stay(ctx, touch, reduce, state);
  } catch (e) {
    if (!isAborted(e)) console.warn('[Pebble] visit error', e);
  } finally {
    touch.destroy();
    document.removeEventListener('visibilitychange', onVisibility);
  }

  await leave(ctx, ending, reduce);
  actor.destroy();
}

/** Strolls across the bottom edge on its way somewhere, maybe pausing once. */
async function passThrough(ctx: Ctx, touch: Touch, reduce: boolean, state: StayState): Promise<void> {
  const { actor, stage, signal } = ctx;
  const farEdge = actor.side === 'left' ? 'right' : 'left';
  if (reduce) {
    actor.place(clampX(ctx, ctx.plan.spot * stage.width), 0);
    await actor.fadeIn(400, signal);
    rest(actor);
    await sleep(4000, signal);
    return;
  }
  touch.enable();
  const pauseAt = Math.random() < 0.5 ? clampX(ctx, stage.width * rand(0.25, 0.75)) : null;
  let paused = false;
  let arrived = false;
  // Walk in legs (Pip starts just off-screen); a touch interrupts the current leg, Pip reacts,
  // then carries on until it has reached the far edge.
  for (let legs = 0; legs < 20 && !arrived; legs++) {
    const beat = linked(signal);
    state.beat = beat;
    const legCtx = { ...ctx, signal: beat.signal };
    try {
      if (state.pending) {
        const e = state.pending;
        state.pending = null;
        await react(legCtx, touch, e);
      } else if (pauseAt !== null && !paused) {
        await walkTo(legCtx, pauseAt);
        paused = true;
        actor.setPose(pick<Pose>(['sniff', 'lookUp', REST_POSE]));
        await sleep(rand(1200, 2400), beat.signal);
      } else {
        await walkTo(legCtx, actor.offstageX(farEdge));
        arrived = true;
      }
    } catch (e) {
      if (!isAborted(e) || signal.aborted) throw e;
      actor.body.style.transform = '';
      actor.settle();
      actor.setMode(null);
    }
  }
}

interface StayState {
  /** A touch Pip accepted, handled at the next beat. */
  pending: TouchEvent | null;
  /** The current beat; aborted to react to a touch. */
  beat: AbortController;
}

async function stay(ctx: Ctx, touch: Touch, reduce: boolean, state: StayState): Promise<void> {
  const { actor, stage, plan } = ctx;
  const main = ctx.signal;
  const spotX = clampX(ctx, plan.spot * (stage.width - PET_SIZE));
  let deadline = Date.now() + plan.durationMs;
  let bonus = 0;
  let beats = 0;
  let last: Activity | HeroActivity = plan.activity;
  // A rare, brief look at the viewer; a little likelier the more relaxed Pip is around them.
  let glanced = false;
  const mayGlance = () => {
    if (glanced || Math.random() > 0.05 + plan.bond * 0.15) return false;
    glanced = true;
    return true;
  };

  if (reduce) {
    actor.place(spotX, 0);
    await actor.fadeIn(400, main);
  } else {
    await enterMove(plan.entrance)(ctx, spotX);
  }
  rest(actor);
  touch.enable();
  if (plan.stalk && !reduce) {
    try {
      await stalkCursor(ctx, touch);
    } catch (e) {
      if (!isAborted(e) || main.aborted) throw e;
    }
  }
  if (plan.speech !== 'none') {
    await sleep(1200, main);
    if (plan.speech === 'hello') actor.say(plan.hello, plan.userName.trim() || 'friend', 4000);
    else actor.say(plan.hello, null, 2200);
  }

  while (Date.now() < deadline) {
    const beat = linked(main);
    state.beat = beat;
    // A long nap must not carry the stay past its time: the beat ends at the deadline.
    const timeUp = setTimeout(() => beat.abort(), deadline - Date.now());
    const beatCtx = { ...ctx, signal: beat.signal };
    try {
      const pending = state.pending;
      if (pending) {
        state.pending = null;
        const gained = await react(beatCtx, touch, pending);
        const add = Math.min(gained, MAX_PET_BONUS_MS - bonus);
        bonus += add;
        deadline += add;
      } else if (reduce) {
        actor.setPose(pick<Pose>([REST_POSE, 'loaf']));
        await sleep(5000, beat.signal);
      } else {
        // The planned activity first, then something different each time: never the same twice running.
        const act = beats === 0 ? plan.activity : nextActivity(ctx, last);
        beats++;
        last = act;
        await activityMove(act)(beatCtx);
        await restBeat(beatCtx, mayGlance);
      }
    } catch (e) {
      if (!isAborted(e) || main.aborted) throw e;
      actor.body.style.transform = '';
      actor.settle();
      actor.setMode(null);
    } finally {
      clearTimeout(timeUp);
    }
  }
}

async function leave(ctx: Ctx, ending: Ending, reduce: boolean): Promise<void> {
  const { actor } = ctx;
  if (ending === 'hidden') return;
  // A pass that already walked off screen has nothing left to do.
  if (actor.x <= -PET_SIZE || actor.x >= ctx.stage.width) return;
  const exit = new AbortController();
  // Leaving never takes longer than this, even if something stalls.
  const guard = setTimeout(() => exit.abort(), 12000);
  const exitCtx: Ctx = { ...ctx, signal: exit.signal };
  actor.body.style.transform = '';
  actor.settle();
  actor.setMode(null);
  actor.setWag(false);
  actor.hideBubble();
  actor.hideControls();
  try {
    if (reduce) await actor.fadeOut(400, exit.signal);
    else if (ending === 'dismissed') await walkTo(exitCtx, actor.offstageX(actor.nearestEdge), pace(ctx, 1.6));
    else if (ending === 'snoozed') {
      actor.setPose('sleep');
      await sleep(700, exit.signal);
      await actor.fadeOut(700, exit.signal);
    } else await exitMove(ctx.plan.exit)(exitCtx);
  } catch (e) {
    if (!isAborted(e)) console.warn('[Pebble] exit error', e);
  } finally {
    clearTimeout(guard);
  }
}
