import { ballSvg, type PetLook } from '../shared/pet';
import { Actor, PET_SIZE } from './actor';
import { animate, isAborted, pick, rand, sleep, translateOf } from './anim';
import type { Stage } from './stage';

const BALL = 28;
// A short break, not a show: after this Pip curls up and drifts off.
const MAX_PLAY_MS = 2 * 60 * 1000;

class Ball {
  readonly el: HTMLDivElement;
  private readonly inner: HTMLDivElement;
  x = 0;
  y = 0;
  private spin = 0;

  constructor(stage: Stage) {
    this.el = document.createElement('div');
    this.el.style.cssText = 'position:absolute;left:0;bottom:16px;line-height:0;pointer-events:none';
    this.inner = document.createElement('div');
    this.inner.innerHTML = ballSvg(BALL);
    this.el.appendChild(this.inner);
    stage.layer.appendChild(this.el);
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  async moveTo(x: number, y: number, ms: number, easing: string, signal: AbortSignal, roll = false): Promise<void> {
    const from = `translate(${this.x}px, ${this.y}px)`;
    const spinTo = this.spin + (roll ? ((x - this.x) / (Math.PI * BALL)) * 360 : 0);
    const moves = [animate(this.el, [{ transform: from }, { transform: `translate(${x}px, ${y}px)` }], { duration: ms, easing }, signal)];
    if (roll) {
      moves.push(
        animate(this.inner, [{ transform: `rotate(${this.spin}deg)` }, { transform: `rotate(${spinTo}deg)` }], { duration: ms, easing }, signal),
      );
    }
    try {
      await Promise.all(moves);
      this.x = x;
      this.y = y;
      this.spin = spinTo;
    } catch (e) {
      ({ x: this.x, y: this.y } = translateOf(this.el));
      throw e;
    }
  }

  destroy(): void {
    this.el.remove();
  }
}

interface PlayCtx {
  actor: Actor;
  ball: Ball;
  stage: Stage;
  signal: AbortSignal;
}

const clampX = (stage: Stage, x: number) => Math.min(stage.width - PET_SIZE - 8, Math.max(8, x));

/** Ball position that sits just in front of the pet's feet. */
const besidePet = (petX: number, toRight: boolean) => (toRight ? petX + PET_SIZE - 6 : petX - BALL + 6);

async function runAfter({ actor, ball, signal }: PlayCtx, speed: number): Promise<void> {
  const toRight = ball.x > actor.x;
  const target = toRight ? ball.x - PET_SIZE + 6 : ball.x + BALL - 6;
  actor.setPose('walk', !toRight);
  actor.setMode('walking');
  try {
    await actor.moveTo(target, 0, signal, { speed });
  } finally {
    actor.setMode(null);
  }
}

const ROUTINES: ((ctx: PlayCtx) => Promise<void>)[] = [
  // Boop, boop: bounces it on its head.
  async ({ actor, ball, signal }) => {
    actor.setPose('happy');
    const headX = actor.x + PET_SIZE / 2 - BALL / 2;
    await ball.moveTo(headX, -PET_SIZE + 4, 300, 'ease-out', signal);
    for (let i = 0; i < 4; i++) {
      await ball.moveTo(headX, -PET_SIZE - 70, 360, 'ease-out', signal);
      await ball.moveTo(headX, -PET_SIZE + 4, 360, 'ease-in', signal);
      await actor.hop(0, 8, 160, signal);
    }
    const land = besidePet(actor.x, actor.x < 200);
    await ball.moveTo(land, 0, 500, 'ease-in', signal, true);
  },
  // Chase! It rolls, it follows.
  async (ctx) => {
    const { actor, ball, stage, signal } = ctx;
    const dir = actor.x + PET_SIZE / 2 > stage.width / 2 ? -1 : 1;
    const dest = clampX(stage, ball.x + dir * rand(180, 360));
    const roll = ball.moveTo(dest, 0, 1400, 'cubic-bezier(.2,.6,.4,1)', signal, true);
    // Awaited below; if play is interrupted first, don't leave its rejection unhandled.
    roll.catch(() => {});
    await sleep(250, signal);
    await Promise.all([roll, runAfter(ctx, 190)]);
    actor.setPose('happy');
    await sleep(800, signal);
  },
  // Whoops: trips over its feet.
  async (ctx) => {
    const { actor, signal } = ctx;
    const halfway = actor.x + (ctx.ball.x - actor.x) / 2;
    actor.setPose('walk', ctx.ball.x < actor.x);
    actor.setMode('walking');
    try {
      await actor.moveTo(halfway, 0, signal, { speed: 200 });
    } finally {
      actor.setMode(null);
    }
    actor.setPose('tumble', ctx.ball.x < actor.x);
    await sleep(900, signal);
    actor.setPose('surprised');
    await sleep(600, signal);
    await runAfter(ctx, 120);
  },
  // Rolled away, then trots after it.
  async (ctx) => {
    const { actor, ball, stage, signal } = ctx;
    const far = actor.x + PET_SIZE / 2 > stage.width / 2 ? 20 : stage.width - BALL - 20;
    await ball.moveTo(far, 0, 1800, 'cubic-bezier(.2,.6,.4,1)', signal, true);
    // Watches it go, then trots after it.
    actor.setPose('lookUp', far < actor.x);
    await sleep(1600, signal);
    await runAfter(ctx, 120);
  },
];

/**
 * Idle ball play along the bottom edge. Runs until `signal` aborts (any input),
 * then tucks the ball away, waves and leaves.
 */
export async function runBallPlay(stage: Stage, look: PetLook, petName: string, signal: AbortSignal): Promise<void> {
  const side = Math.random() < 0.5 ? 'left' : 'right';
  const actor = new Actor(stage, look, petName, side);
  actor.hideControls();
  const ball = new Ball(stage);
  ball.place(side === 'right' ? stage.width + 40 : -BALL - 40, 0);
  const cap = new AbortController();
  const capTimer = setTimeout(() => cap.abort(), MAX_PLAY_MS);
  const play = new AbortController();
  const stop = () => play.abort();
  signal.addEventListener('abort', stop, { once: true });
  cap.signal.addEventListener('abort', stop, { once: true });
  const ctx: PlayCtx = { actor, ball, stage, signal: play.signal };

  try {
    actor.setPose('walk', actor.face(actor.homeX));
    actor.setMode('walking');
    await Promise.all([
      actor.moveTo(actor.homeX, 0, play.signal, { speed: 120 }),
      ball.moveTo(besidePet(actor.homeX, side === 'left'), 0, 1600, 'ease-out', play.signal, true),
    ]);
    actor.setMode(null);
    for (;;) {
      await pick(ROUTINES)(ctx);
      actor.setPose('away');
      await sleep(rand(1500, 3500), play.signal);
    }
  } catch (e) {
    if (!isAborted(e)) console.warn('[Pebble] play error', e);
  } finally {
    clearTimeout(capTimer);
    signal.removeEventListener('abort', stop);
  }

  // Leaving: never longer than a few seconds.
  const exit = new AbortController();
  const guard = setTimeout(() => exit.abort(), 6000);
  try {
    actor.setMode(null);
    actor.hideBubble();
    const tuck = animate(ball.el, [{ opacity: 1 }, { opacity: 0, transform: `translate(${actor.x + PET_SIZE / 2}px, -20px) scale(.3)` }], { duration: 400 }, exit.signal);
    if (cap.signal.aborted) {
      await tuck;
      actor.setPose('sleep');
      await sleep(2000, exit.signal);
      await actor.fadeOut(1200, exit.signal);
    } else {
      await tuck;
      await sleep(600, exit.signal);
      const target = actor.offstageX(actor.nearestEdge);
      actor.setPose('walk', actor.face(target));
      actor.setMode('walking');
      await actor.moveTo(target, 0, exit.signal, { speed: 180 });
    }
  } catch {
    // Guard fired; remove immediately.
  } finally {
    clearTimeout(guard);
    ball.destroy();
    actor.destroy();
  }
}
