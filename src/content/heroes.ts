import type { Pose } from '../shared/catalog';
import { HERO_MURMURS, type Hero, type HeroActivity, type HeroEntrance, type HeroExit } from '../shared/heroes';
import { PET_SIZE, type Actor } from './actor';
import { animate, pick, rand, sleep } from './anim';
import { clampX, floorProp, heroOf, pace, rest, rock, walkTo, type Ctx } from './moves';
import { pointer } from './pointer';
import { PEBBLE, PUFF, RIPPLE, TINGLE } from './props';

// The costumed characters' own lives: how they arrive, what they do, how they leave and how
// they react to you. They try very hard to look tough. It never quite works.

/** Height of the screen above the pet's resting line (negative y is up). */
const ceiling = (ctx: Ctx) => -(ctx.stage.height - 16 - PET_SIZE);


/** Lands from a jump or a drop: a squashy hero crouch, then up. */
export async function land(actor: Actor, signal: AbortSignal, holdMs = 700): Promise<void> {
  actor.setPose('crouch');
  await sleep(holdMs, signal);
  rest(actor);
}

/** Hangs upside down on a web from wherever it is, `drop` px down from the top; sways a while. */
export async function hangOnWeb(ctx: Ctx, fromTop: boolean, holdMs: number): Promise<void> {
  const { actor, signal } = ctx;
  actor.showLine('web');
  actor.setUpsideDown(true);
  actor.setPose('hang');
  if (fromTop) actor.place(actor.x, ceiling(ctx) - PET_SIZE);
  await actor.moveTo(actor.x, -rand(120, 180), signal, { ms: fromTop ? 1400 : 700, easing: 'cubic-bezier(.2,.7,.3,1)' });
  const sway = rock(actor, 5, 2200);
  try {
    await sleep(holdMs, signal);
  } finally {
    sway.cancel();
  }
}

/** Lets go of the web: down to the floor and the right way up. */
export async function letGo(ctx: Ctx): Promise<void> {
  const { actor, signal } = ctx;
  actor.showLine(null);
  actor.setUpsideDown(false);
  actor.setPose('walk');
  await actor.moveTo(actor.x, 0, signal, { ms: 420, easing: 'cubic-bezier(.5,0,.9,.6)' });
  await land(actor, signal);
}

/** A puff of smoke where the pet stands, then it's gone. */
async function vanish(ctx: Ctx): Promise<void> {
  const { actor, stage, signal } = ctx;
  const puff = floorProp(stage, PUFF);
  puff.style.transform = `translate(${actor.x + PET_SIZE / 2 - 36}px, ${actor.y - 20}px)`;
  try {
    await Promise.all([
      animate(puff, [{ opacity: 0, transform: `${puff.style.transform} scale(.6)` }, { opacity: 1, transform: `${puff.style.transform} scale(1.15)` }, { opacity: 0, transform: `${puff.style.transform} scale(1.3)` }], { duration: 900 }, signal),
      actor.fadeOut(350, signal),
    ]);
  } finally {
    puff.remove();
  }
}

/* ---------- arriving ---------- */

export const HERO_ENTRANCE_MOVES: Record<HeroEntrance, (ctx: Ctx, spotX: number) => Promise<void>> = {
  // Slow, heavy steps.
  async march(ctx, spotX) {
    await walkTo(ctx, spotX, pace(ctx, 0.55));
  },
  // Down from the top of the page on a web line, then lets go.
  async webDrop(ctx, spotX) {
    ctx.actor.place(spotX, ceiling(ctx) - PET_SIZE);
    await hangOnWeb(ctx, true, rand(1200, 2000));
    await letGo(ctx);
  },
  // Low and fast with the cape out, landing without a sound.
  async glide(ctx, spotX) {
    const { actor, signal } = ctx;
    actor.place(actor.x, -90);
    actor.setPose('walk', actor.face(spotX));
    await actor.moveTo(spotX, 0, signal, { ms: 1100, easing: 'cubic-bezier(.2,.6,.3,1)' });
    await land(actor, signal, 500);
  },
};

/* ---------- doing its own thing ---------- */

export const HERO_MOVES: Record<Exclude<HeroActivity, 'nap'>, (ctx: Ctx) => Promise<void>> = {
  // Lights the saber, admires it, one slow swing, puts it away.
  async saber({ actor, signal }) {
    actor.setPose('saber');
    actor.setProp('saber');
    try {
      await sleep(rand(1800, 2600), signal);
      await animate(actor.body, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-8deg)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0deg)' }], { duration: 900, easing: 'ease-in-out' }, signal);
      await sleep(rand(1200, 2000), signal);
    } finally {
      actor.setProp('none');
    }
    rest(actor);
    await sleep(600, signal);
  },
  // A short, important walk along the edge, stopping to look around.
  async patrol(ctx) {
    const { actor, signal } = ctx;
    const slow = heroOf(ctx) === 'vader' ? 0.5 : 0.8;
    for (const dir of [-1, 1]) {
      await walkTo(ctx, clampX(ctx, actor.x + dir * rand(80, 140)), pace(ctx, slow));
      actor.setPose(pick<Pose>(['lookLeft', 'lookRight']));
      await sleep(rand(1200, 1800), signal);
    }
    rest(actor);
  },
  // Stands very still and breathes, loudly.
  async breathe({ actor, signal }) {
    actor.setPose('idle');
    actor.say({ before: 'kooh… pahh…', after: '' }, null, 2600);
    await animate(actor.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.05, .97)' }, { transform: 'scale(1)' }], { duration: 1600, iterations: 2, easing: 'ease-in-out' }, signal);
    rest(actor);
    await sleep(800, signal);
  },
  // Lifts a pebble with the Force, lets it hover, drops it.
  async forceLift({ actor, stage, signal }) {
    const toLeft = actor.facingLeft;
    actor.setPose('force', toLeft);
    const x = toLeft ? actor.x + PET_SIZE - 6 : actor.x - 14;
    const stone = floorProp(stage, PEBBLE);
    const at = (y: number) => `translate(${x}px, ${y}px)`;
    try {
      await animate(stone, [{ transform: at(0) }, { transform: at(-56) }], { duration: 1400, easing: 'ease-out' }, signal);
      await animate(stone, [{ transform: at(-56) }, { transform: at(-62) }, { transform: at(-56) }], { duration: 900, iterations: 2 }, signal);
      await animate(stone, [{ transform: at(-56) }, { transform: at(0) }], { duration: 380, easing: 'ease-in' }, signal);
    } finally {
      stone.remove();
    }
    rest(actor);
    await sleep(700, signal);
  },
  // Eyes closed, floating a little off the floor.
  async meditate({ actor, signal }) {
    actor.setPose('meditate');
    actor.setMode('resting');
    try {
      await animate(actor.body, [{ transform: 'translateY(0)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(-5px)' }, { transform: 'translateY(-8px)' }, { transform: 'translateY(0)' }], { duration: rand(7000, 10000), easing: 'ease-in-out' }, signal);
    } finally {
      actor.setMode(null);
    }
    rest(actor);
  },
  // Shoots a web up, hangs upside down a while, drops.
  async hang(ctx) {
    ctx.actor.setPose('webShoot');
    await sleep(400, ctx.signal);
    await hangOnWeb(ctx, false, rand(3000, 5000));
    await letGo(ctx);
  },
  // Shoots a web out to the side, gives it a tug.
  async webShot({ actor, stage, signal }) {
    const toLeft = Math.random() < 0.5;
    actor.setPose('webShoot', toLeft);
    const web = floorProp(stage, '');
    const len = rand(90, 150);
    web.style.cssText += `;height:2px;width:${len}px;background:#FFFFFF;box-shadow:0 0 0 1px rgba(43,35,64,.35);transform-origin:${toLeft ? '100%' : '0'} 50%`;
    web.style.left = `${toLeft ? actor.x + 10 - len : actor.x + PET_SIZE - 10}px`;
    web.style.bottom = `${16 + PET_SIZE * 0.7}px`;
    try {
      await animate(web, [{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 220, easing: 'ease-out' }, signal);
      await animate(actor.body, [{ transform: 'translateX(0)' }, { transform: `translateX(${toLeft ? -6 : 6}px)` }, { transform: 'translateX(0)' }], { duration: 400 }, signal);
      await sleep(600, signal);
    } finally {
      web.remove();
    }
    await land(actor, signal);
  },
  // A backflip on the spot.
  async flip({ actor, signal }) {
    actor.setPose('happy');
    await Promise.all([actor.hop(0, 46, 640, signal), animate(actor.body, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(-360deg)' }], { duration: 620, easing: 'ease-in-out' }, signal)]);
    await land(actor, signal);
    await sleep(800, signal);
  },
  // A jump and the hero landing, held a little too long.
  async crouch({ actor, signal }) {
    const dir = Math.random() < 0.5 ? -1 : 1;
    actor.setPose('walk', dir < 0);
    await actor.hop(dir * rand(40, 70), 34, 520, signal);
    await land(actor, signal, rand(1800, 2600));
  },
  // Quick little runs.
  async scurry(ctx) {
    const { actor, signal } = ctx;
    for (let i = 0; i < 2; i++) {
      await walkTo(ctx, clampX(ctx, actor.x + rand(-140, 140)), pace(ctx, 2.2));
      actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'lookUp']));
      await sleep(rand(700, 1200), signal);
    }
    rest(actor);
  },
  // Sits very still, eyes narrowed, thinking about crime.
  async brood({ actor, signal }) {
    actor.setPose('loaf');
    actor.setMode('resting');
    try {
      await sleep(rand(7000, 11000), signal);
    } finally {
      actor.setMode(null);
    }
  },
  // Slow scans of the horizon.
  async lookout({ actor, signal }) {
    for (const pose of ['lookLeft', 'lookUp', 'lookRight', 'drowsy'] as Pose[]) {
      actor.setPose(pose);
      await sleep(rand(1500, 2300), signal);
    }
    rest(actor);
  },
  // Fires a grapple line up, rises a little way, hangs there, comes down.
  async grapple(ctx) {
    const { actor, signal } = ctx;
    actor.setPose('webShoot');
    actor.showLine('grapple');
    await sleep(350, signal);
    try {
      await actor.moveTo(actor.x, -rand(110, 150), signal, { ms: 900, easing: 'cubic-bezier(.3,.1,.3,1)' });
      const sway = rock(actor, 3, 2600);
      try {
        await sleep(rand(2500, 4000), signal);
      } finally {
        sway.cancel();
      }
      actor.setPose('walk');
      await actor.moveTo(actor.x, 0, signal, { ms: 700 });
    } finally {
      actor.showLine(null);
    }
    await land(actor, signal);
  },
  // Lights the saber and spins it around, very pleased with himself.
  async saberSpin({ actor, signal }) {
    actor.setPose('saber');
    actor.setProp('saber');
    try {
      await sleep(600, signal);
      await animate(actor.body, [{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }, { transform: 'rotate(720deg)' }], { duration: 1300, easing: 'ease-in-out' }, signal);
      actor.setPose('lookUp');
      await sleep(rand(1200, 1800), signal);
    } finally {
      actor.setProp('none');
    }
    rest(actor);
    await sleep(500, signal);
  },
  // Turns, stares at your cursor, slowly raises a paw… then thinks better of it.
  async stare({ actor, signal }) {
    const left = pointer.x !== null && pointer.x < actor.center.x;
    actor.setPose('glance', left);
    const until = Date.now() + rand(1800, 2600);
    while (Date.now() < until) {
      if (pointer.x !== null) actor.lookAt(pointer.x, pointer.y);
      await sleep(120, signal);
    }
    actor.setPose('force', !left);
    actor.say({ before: 'kshhh…', after: '' }, null, 1600);
    await sleep(1600, signal);
    actor.setPose('away', !left);
    await sleep(rand(1500, 2500), signal);
  },
  // Scurries to the edge and climbs a little way up the side of the page, then drops down.
  async wallCrawl(ctx) {
    const { actor, stage, signal } = ctx;
    const side = actor.nearestEdge;
    const edgeX = side === 'left' ? 2 : stage.width - PET_SIZE - 2;
    await walkTo(ctx, edgeX, pace(ctx, 1.6));
    actor.setPose('walk');
    actor.setClimb(side);
    actor.setMode('walking');
    try {
      await actor.moveTo(edgeX, -rand(150, 240), signal, { speed: 70 });
    } finally {
      actor.setMode(null);
    }
    actor.setPose(pick<Pose>(['lookLeft', 'lookRight', 'lookAround']));
    await sleep(rand(1500, 2500), signal);
    actor.setClimb(null);
    actor.setPose('walk');
    await actor.moveTo(clampX(ctx, edgeX + (side === 'left' ? 40 : -40)), 0, signal, { ms: 450, easing: 'cubic-bezier(.5,0,.9,.6)' });
    await land(actor, signal);
  },
  // Spider-sense tingling: wavy lines over its head, a quick dodge, a heroic landing.
  async spiderSense({ actor, signal }) {
    const tingle = actor.addProp(TINGLE, { left: `${PET_SIZE / 2 - 18}px`, top: '-22px' });
    actor.setPose('surprised');
    try {
      await sleep(700, signal);
      const dir = Math.random() < 0.5 ? -1 : 1;
      actor.setPose('walk', dir < 0);
      await actor.hop(dir * rand(50, 80), 30, 420, signal);
    } finally {
      tingle.remove();
    }
    await land(actor, signal, 1200);
  },
  // Steps into the shadows and out again a little further along.
  async shadowStep(ctx) {
    const { actor, signal } = ctx;
    await vanish(ctx);
    await sleep(rand(700, 1400), signal);
    actor.place(clampX(ctx, actor.x + (Math.random() < 0.5 ? -1 : 1) * rand(90, 160)), 0);
    actor.setPose('away', Math.random() < 0.5);
    await actor.fadeIn(450, signal);
    await sleep(rand(1500, 2500), signal);
  },
  // Turns sharply, the cape swirling.
  async capeSwish({ actor, signal }) {
    for (let i = 0; i < 2; i++) {
      await animate(actor.body, [{ transform: 'scaleX(1)' }, { transform: 'scaleX(.15)' }], { duration: 160 }, signal);
      actor.setPose('away', !actor.facingLeft);
      await animate(actor.body, [{ transform: 'scaleX(.15)' }, { transform: 'scaleX(1)' }], { duration: 160 }, signal);
      await sleep(rand(1500, 2500), signal);
    }
  },
};

/* ---------- leaving ---------- */

export const HERO_EXIT_MOVES: Record<Exclude<HeroExit, 'walkAway'>, (ctx: Ctx) => Promise<void>> = {
  // Shoots a web up and is pulled off the top of the screen.
  async webZip(ctx) {
    const { actor, signal } = ctx;
    actor.setPose('webShoot');
    actor.showLine('web');
    await sleep(300, signal);
    await actor.moveTo(actor.x, ceiling(ctx) - PET_SIZE * 2, signal, { ms: 700, easing: 'cubic-bezier(.5,0,.8,.4)' });
  },
  async vanish(ctx) {
    await vanish(ctx);
  },
};

/* ---------- when you reach out ---------- */

interface HeroReactions {
  /** After a petting session it decided was enough. */
  enough(ctx: Ctx): Promise<void>;
  boop(ctx: Ctx): Promise<void>;
  tooMuch(ctx: Ctx, awayFromCursor: -1 | 1): Promise<void>;
  stillNear(ctx: Ctx): Promise<void>;
}

export const HERO_REACTIONS: Record<Hero, HeroReactions> = {
  vader: {
    // Remembers he's supposed to be scary: stands tall again and marches off a few steps.
    async enough(ctx) {
      const { actor, signal } = ctx;
      actor.setPose('idle');
      await animate(actor.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.06)' }, { transform: 'scale(1)' }], { duration: 700 }, signal);
      await walkTo(ctx, clampX(ctx, actor.x + (Math.random() < 0.5 ? -1 : 1) * rand(70, 110)), pace(ctx, 0.55));
      rest(actor);
    },
    async boop({ actor, signal }) {
      actor.setPose('glance');
      actor.say({ before: pick(HERO_MURMURS.vader), after: '' }, null, 1500);
      await sleep(1500, signal);
      rest(actor);
    },
    // A Force wave, a swish of the cape, and off he marches.
    async tooMuch(ctx, away) {
      const { actor, stage, signal } = ctx;
      // The Force paw is on the drawing's left: unflipped it pushes left, toward a cursor on the left.
      const cursorLeft = away > 0;
      actor.setPose('force', !cursorLeft);
      const ring = floorProp(stage, RIPPLE);
      const x = cursorLeft ? actor.x - 30 : actor.x + PET_SIZE - 10;
      try {
        await animate(ring, [{ transform: `translate(${x}px, -30px) scale(.4)`, opacity: 1 }, { transform: `translate(${x + (cursorLeft ? -30 : 30)}px, -30px) scale(1.6)`, opacity: 0 }], { duration: 700 }, signal);
      } finally {
        ring.remove();
      }
      await walkTo(ctx, clampX(ctx, actor.x + away * rand(110, 160)), pace(ctx, 0.7));
      actor.setPose('away', away < 0);
      await sleep(rand(4000, 6000), signal);
    },
    async stillNear({ actor, signal }) {
      actor.setPose('glance');
      await animate(actor.body, [{ transform: 'scale(1)' }, { transform: 'scale(1.04, .98)' }, { transform: 'scale(1)' }], { duration: 1400 }, signal);
      rest(actor);
    },
  },
  spider: {
    async enough(ctx) {
      const { actor, signal } = ctx;
      actor.setPose('happy');
      await actor.hop((Math.random() < 0.5 ? -1 : 1) * rand(50, 80), 26, 480, signal);
      await land(actor, signal);
    },
    async boop(ctx) {
      await HERO_MOVES.flip(ctx);
    },
    // Thwip: zips up out of reach, then drops back in somewhere else.
    async tooMuch(ctx, away) {
      const { actor, signal } = ctx;
      actor.say({ before: 'thwip!', after: '' }, null, 1200);
      await HERO_EXIT_MOVES.webZip(ctx);
      actor.showLine(null);
      await sleep(rand(1500, 2500), signal);
      actor.place(clampX(ctx, actor.x + away * rand(160, 260)), ceiling(ctx) - PET_SIZE);
      await hangOnWeb(ctx, true, 1200);
      await letGo(ctx);
    },
    async stillNear({ actor, signal }) {
      actor.setPose('tilt');
      await sleep(1300, signal);
      rest(actor);
    },
  },
  bat: {
    // The frown breaks for a second… and comes back.
    async enough(ctx) {
      const { actor, signal } = ctx;
      actor.setPose('annoyed');
      await sleep(900, signal);
      actor.setPose('away', !actor.facingLeft);
      await sleep(rand(2500, 4000), signal);
    },
    async boop({ actor, signal }) {
      actor.setPose('drowsy');
      actor.say({ before: '…', after: '' }, null, 1300);
      await sleep(1400, signal);
      rest(actor);
    },
    // Gone in a puff of smoke, back a little further along.
    async tooMuch(ctx, away) {
      const { actor, signal } = ctx;
      await vanish(ctx);
      await sleep(rand(1500, 2500), signal);
      actor.place(clampX(ctx, actor.x + away * rand(160, 260)), 0);
      actor.setPose('away', away < 0);
      await actor.fadeIn(500, signal);
      await sleep(rand(3000, 5000), signal);
    },
    async stillNear({ actor, signal }) {
      actor.setPose('drowsy');
      await sleep(1500, signal);
      rest(actor);
    },
  },
};
