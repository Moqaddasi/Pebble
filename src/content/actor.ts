import type { Pose } from '../shared/catalog';
import type { Line } from '../shared/lines';
import type { Prop } from '../shared/costume';
import { petSvg, type PetLook } from '../shared/pet';
import { animate, sleep, translateOf } from './anim';
import type { Stage } from './stage';

export const PET_SIZE = 80;
const EDGE_GAP = 40;
const BUBBLE_MS = 6000;

const ICON_X =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF7EE" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
const ICON_MOON =
  '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFF7EE" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/></svg>';

/**
 * One pet on the stage. Position is a translate from the bottom-left corner:
 * `x` is px from the left edge, `y` is px above its resting line (negative = up).
 */
export class Actor {
  readonly root: HTMLDivElement;
  /** Vertical hop offset, kept apart from travel so arcs stay smooth. */
  private readonly hopLayer: HTMLDivElement;
  readonly body: HTMLDivElement;
  /** Brief squash when the pose changes, so drawings don't snap. */
  private readonly squash: HTMLDivElement;
  readonly pet: HTMLDivElement;
  readonly props: HTMLDivElement;
  private readonly bubbleEl: HTMLDivElement;
  private readonly controlsEl: HTMLDivElement;
  private bubbleTimer = 0;
  private pose: Pose = 'idle';
  private prop: Prop = 'none';
  /** A web or grapple line from the top of the screen down to the pet, while it hangs or climbs. */
  private line: HTMLDivElement | null = null;
  private flipped = false;
  x = 0;
  y = 0;

  constructor(
    private readonly stage: Stage,
    private readonly look: PetLook,
    private readonly petName: string,
    readonly side: 'left' | 'right',
  ) {
    this.root = document.createElement('div');
    this.root.className = `actor side-${side}`;
    this.root.style.setProperty('--tail', `${PET_SIZE / 2 - 7}px`);
    this.hopLayer = document.createElement('div');
    this.hopLayer.className = 'hop';
    this.body = document.createElement('div');
    this.body.className = 'body';
    this.squash = document.createElement('div');
    this.squash.className = 'squash';
    this.pet = document.createElement('div');
    this.pet.className = 'pet';
    this.props = document.createElement('div');
    this.props.className = 'props';
    this.bubbleEl = document.createElement('div');
    this.bubbleEl.className = 'bubble';
    this.bubbleEl.setAttribute('role', 'status');
    this.bubbleEl.addEventListener('click', () => {
      if (!this.bubbleEl.classList.contains('asking')) this.hideBubble();
    });
    this.controlsEl = document.createElement('div');
    this.controlsEl.className = 'controls';
    this.squash.append(this.pet);
    this.body.append(this.squash, this.props);
    this.hopLayer.append(this.body);
    this.root.append(this.bubbleEl, this.controlsEl, this.hopLayer);
    // Each pet blinks on its own rhythm.
    this.root.style.setProperty('--blink-delay', `${-Math.random() * 4}s`);
    stage.layer.appendChild(this.root);
    this.setPose('away');
    this.place(this.offstageX(), 0);
  }

  /** Where the pet settles: its bottom corner, clear of the reading column. */
  get homeX(): number {
    return this.side === 'right' ? this.stage.width - PET_SIZE - EDGE_GAP : EDGE_GAP;
  }

  /** Just past the edge on the pet's side. */
  offstageX(side: 'left' | 'right' = this.side): number {
    return side === 'right' ? this.stage.width + 20 : -PET_SIZE - 20;
  }

  /** The edge nearest the pet right now. */
  get nearestEdge(): 'left' | 'right' {
    return this.x + PET_SIZE / 2 > this.stage.width / 2 ? 'right' : 'left';
  }

  get center(): { x: number; y: number } {
    const r = this.pet.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  setPose(pose: Pose, flip = this.flipped): void {
    if (pose === this.pose && flip === this.flipped && this.pet.firstChild) return;
    const first = !this.pet.firstChild;
    this.pose = pose;
    this.flipped = flip;
    this.draw();
    if (!first && !this.root.classList.contains('walking')) {
      this.squash.animate([{ transform: 'none' }, { transform: 'scale(1.04, .96)' }, { transform: 'none' }], { duration: 220, easing: 'ease-in-out' });
    }
  }

  private draw(): void {
    const { pose, flipped: flip, prop } = this;
    this.pet.innerHTML = petSvg({ ...this.look, pose, flip, prop, size: PET_SIZE, label: `${this.petName}, ${pose}` });
  }

  /** Something held in the paws (a saber, a glass); stays until changed. */
  setProp(prop: Prop): void {
    if (prop === this.prop) return;
    this.prop = prop;
    this.draw();
  }

  /**
   * Back to plain standing after an interrupted move: on the floor, right way up, nothing held,
   * no line, fully visible (a hang, a grapple or a vanish can be cut short by a touch).
   */
  settle(): void {
    this.setUpsideDown(false);
    this.setClimb(null);
    this.clearProps();
    this.showLine(null);
    this.setProp('none');
    this.root.style.opacity = '';
    if (this.y !== 0) this.place(this.x, 0);
  }

  /** Climbing the side of the screen: feet against the left or right edge. */
  setClimb(side: 'left' | 'right' | null): void {
    this.root.classList.toggle('climb-left', side === 'left');
    this.root.classList.toggle('climb-right', side === 'right');
  }

  /** Hanging upside down (from a web). */
  setUpsideDown(on: boolean): void {
    this.root.classList.toggle('upside', on);
  }

  /** A line from the top of the screen down to the pet: a web (light) or a grapple line (dark). */
  showLine(kind: 'web' | 'grapple' | null): void {
    this.line?.remove();
    this.line = null;
    if (!kind) return;
    this.line = document.createElement('div');
    this.line.className = `line ${kind}`;
    this.root.prepend(this.line);
  }

  /**
   * A bubble that asks something and stays until answered: the line, then buttons.
   * Returns the label of the button pressed (or null if `signal` ends first).
   */
  ask(line: Line, name: string | null, labels: { label: string; primary?: boolean }[], signal: AbortSignal): Promise<string | null> {
    this.say(line, name, 24 * 60 * 60 * 1000);
    const row = document.createElement('div');
    row.className = 'actions';
    this.bubbleEl.append(row);
    this.bubbleEl.classList.add('asking');
    return new Promise((resolve) => {
      const done = (v: string | null) => {
        signal.removeEventListener('abort', stop);
        this.bubbleEl.classList.remove('asking');
        this.hideBubble();
        resolve(v);
      };
      const stop = () => done(null);
      for (const l of labels) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = l.primary ? 'primary' : '';
        b.textContent = l.label;
        b.addEventListener('click', (e) => {
          e.stopPropagation();
          done(l.label);
        });
        row.append(b);
      }
      if (signal.aborted) stop();
      else signal.addEventListener('abort', stop, { once: true });
    });
  }

  /**
   * Turns the face toward a point on screen (eyes following it). Offsets are in drawing units,
   * capped so the face stays on the body; mirrored when Pip faces left.
   */
  lookAt(x: number, y: number): void {
    const face = this.pet.querySelector<SVGGElement>('.pp-gaze');
    if (!face) return;
    const c = this.center;
    const vx = x - c.x;
    const vy = y - c.y;
    const dist = Math.hypot(vx, vy) || 1;
    // Turn along the direction to the point, further the farther away it is.
    const reach = Math.min(1, dist / 260);
    const dx = (vx / dist) * 8 * reach * (this.flipped ? -1 : 1);
    const dy = Math.max(-7, Math.min(5, (vy / dist) * 7 * reach));
    face.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
  }

  /** Which way Pip currently faces (the drawing faces right when not flipped). */
  get facingLeft(): boolean {
    return this.flipped;
  }

  /** Faces the direction of travel; the drawing faces right when not flipped. */
  face(towardX: number): boolean {
    return towardX < this.x;
  }

  setMode(mode: 'walking' | 'running' | 'resting' | null): void {
    this.root.classList.toggle('walking', mode === 'walking' || mode === 'running');
    this.root.classList.toggle('running', mode === 'running');
    this.root.classList.toggle('resting', mode === 'resting');
  }

  place(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.root.style.transform = `translate(${x}px, ${y}px)`;
  }

  /** Moves in a straight line. `speed` is px per second. */
  async moveTo(x: number, y: number, signal: AbortSignal, opts: { ms?: number; speed?: number; easing?: string } = {}) {
    const dist = Math.hypot(x - this.x, y - this.y);
    const ms = opts.ms ?? (dist / (opts.speed ?? 110)) * 1000;
    const from = `translate(${this.x}px, ${this.y}px)`;
    const to = `translate(${x}px, ${y}px)`;
    try {
      // Default: a gentle start and stop, like feet getting going and settling.
      await animate(this.root, [{ transform: from }, { transform: to }], { duration: Math.max(1, ms), easing: opts.easing ?? 'cubic-bezier(.3,.1,.3,1)' }, signal);
    } finally {
      this.syncFromStyle();
    }
  }

  /**
   * A hop: travel `dx` at constant speed while the hop layer rises and falls on eased
   * curves (fast take-off, hang at the top, accelerating fall), then a small landing squash.
   */
  async hop(dx: number, height: number, ms: number, signal: AbortSignal): Promise<void> {
    const arc = animate(
      this.hopLayer,
      [
        { transform: 'translateY(0)', easing: 'cubic-bezier(.25,.6,.4,1)' },
        { transform: `translateY(${-height}px)`, offset: 0.5, easing: 'cubic-bezier(.6,0,.75,.4)' },
        { transform: 'translateY(0)' },
      ],
      { duration: ms },
      signal,
    );
    const travel = dx ? this.moveTo(this.x + dx, this.y, signal, { ms, easing: 'linear' }) : Promise.resolve();
    try {
      await Promise.all([arc, travel]);
      // Feet touch down for a beat before the next take-off.
      await animate(this.squash, [{ transform: 'none' }, { transform: 'scale(1.07, .92)' }, { transform: 'none' }], { duration: 180, easing: 'ease-in-out' }, signal);
    } finally {
      this.hopLayer.style.transform = '';
    }
  }

  /** Reads back where an animation actually left the pet (it may have been interrupted). */
  private syncFromStyle(): void {
    const { x, y } = translateOf(this.root);
    this.place(x, y);
  }

  /** Shows a line with the user's name highlighted, or plain text when `name` is null. */
  say(line: Line, name: string | null, ms = BUBBLE_MS): void {
    // Pip can be anywhere along the edge: open the bubble toward the middle of the screen.
    const right = this.x + PET_SIZE / 2 > this.stage.width / 2;
    this.root.classList.toggle('side-right', right);
    this.root.classList.toggle('side-left', !right);
    this.bubbleEl.replaceChildren(document.createTextNode(line.before));
    if (name !== null) {
      const n = document.createElement('span');
      n.className = 'name';
      n.textContent = name;
      this.bubbleEl.append(n, document.createTextNode(line.after));
    }
    this.bubbleEl.classList.add('show');
    this.controlsEl.classList.add('up');
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = window.setTimeout(() => this.hideBubble(), ms);
  }

  hideBubble(): void {
    clearTimeout(this.bubbleTimer);
    this.bubbleEl.classList.remove('show');
    this.controlsEl.classList.remove('up');
  }

  /** The "Not now" / "Snooze 1 h" pill shown while hovering the pet. */
  showControls(onDismiss: () => void, onSnooze: () => void): void {
    const btn = (icon: string, label: string, fn: () => void) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.innerHTML = icon;
      b.append(label);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        fn();
      });
      return b;
    };
    this.controlsEl.replaceChildren(btn(ICON_X, 'Not now', onDismiss), btn(ICON_MOON, 'Snooze 1 h', onSnooze));
  }

  /** The pill appears only on request: right-click, or the cursor resting on Pip. */
  setControlsVisible(on: boolean): void {
    this.controlsEl.classList.toggle('show', on);
  }

  /** Sprout wags like a happy tail. */
  setWag(on: boolean): void {
    this.root.classList.toggle('wag', on);
  }

  /** One quick sprout flick: the tail-twitch that means "that's enough". */
  flickSprout(): void {
    this.root.classList.remove('flick');
    void this.root.offsetWidth;
    this.root.classList.add('flick');
    setTimeout(() => this.root.classList.remove('flick'), 700);
  }

  hideControls(): void {
    this.controlsEl.replaceChildren();
    this.controlsEl.style.display = 'none';
  }

  addProp(html: string, style: Partial<CSSStyleDeclaration>): HTMLDivElement {
    const el = document.createElement('div');
    el.className = 'prop';
    el.innerHTML = html;
    Object.assign(el.style, style);
    this.props.appendChild(el);
    return el;
  }

  clearProps(): void {
    this.props.replaceChildren();
  }

  async fadeOut(ms: number, signal: AbortSignal): Promise<void> {
    await animate(this.root, [{ opacity: 1 }, { opacity: 0 }], { duration: ms, easing: 'ease-in' }, signal);
  }

  async fadeIn(ms: number, signal: AbortSignal): Promise<void> {
    await animate(this.root, [{ opacity: 0 }, { opacity: 1 }], { duration: ms, easing: 'ease-out' }, signal);
  }

  /** Waits for any visible bubble to be readable before moving on. */
  async pause(ms: number, signal: AbortSignal): Promise<void> {
    await sleep(ms, signal);
  }

  destroy(): void {
    clearTimeout(this.bubbleTimer);
    this.root.remove();
  }
}
