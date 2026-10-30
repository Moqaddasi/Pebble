import type { Actor } from './actor';
import { pointer } from './pointer';
import { Stroke } from './stroke';

/** Things the user did to Pip. Pip never asks for these; it only answers. */
export type TouchEvent = 'pet' | 'boop' | 'tooManyBoops' | 'stillNear';

const CONTROLS_DWELL_MS = 2500; // cursor resting on Pip (no clicks): show Not now / Snooze
const NEAR_DWELL_MS = 3000; // cursor resting near Pip this long: it may return the look
const NEAR_PX = 130;
const BOOP_LIMIT = 4; // this many clicks within BOOP_WINDOW_MS is too many
const BOOP_WINDOW_MS = 3000;

export class Touch {
  cursorX: number | null = pointer.x;
  /** Last time the pointer moved over Pip (stroking). */
  lastPetMove = 0;
  private enabled = false;
  private ignoreUntil = 0;
  private over = false;
  private readonly stroke = new Stroke();
  private clicks: number[] = [];
  private dwellTimer = 0;
  private controlsTimer = 0;
  private blinked = false;
  cursorY = pointer.y;

  constructor(
    private readonly actor: Actor,
    private readonly emit: (e: TouchEvent) => void,
  ) {
    const pet = actor.pet;
    pet.addEventListener('pointerenter', this.onEnter);
    pet.addEventListener('pointerleave', this.onLeave);
    pet.addEventListener('pointermove', this.onPetMove);
    pet.addEventListener('click', this.onClick);
    pet.addEventListener('contextmenu', this.onContextMenu);
    actor.root.addEventListener('pointerleave', this.onRootLeave);
    window.addEventListener('pointermove', this.onMove, { passive: true });
  }

  /** Reactions start only once Pip has arrived and settled. */
  enable(): void {
    this.enabled = true;
  }

  /** After Pip walks off from too much attention it ignores touches for a while. */
  ignoreFor(ms: number): void {
    this.ignoreUntil = Date.now() + ms;
  }

  private get active(): boolean {
    return this.enabled && Date.now() >= this.ignoreUntil;
  }

  private onEnter = () => {
    this.over = true;
  };

  private onLeave = () => {
    this.over = false;
  };

  private onRootLeave = () => {
    this.actor.setControlsVisible(false);
  };

  private onPetMove = (e: PointerEvent) => {
    const now = Date.now();
    this.lastPetMove = now;
    if (this.stroke.move(e.clientX, now, this.active)) this.emit('pet');
  };

  private onClick = (e: MouseEvent) => {
    e.stopPropagation();
    // Clicking is playing, not looking for the way out.
    clearTimeout(this.controlsTimer);
    if (!this.active) return;
    const now = Date.now();
    this.clicks = this.clicks.filter((t) => now - t < BOOP_WINDOW_MS);
    this.clicks.push(now);
    if (this.clicks.length >= BOOP_LIMIT) {
      this.clicks = [];
      this.emit('tooManyBoops');
    } else {
      this.emit('boop');
    }
  };

  private onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    this.actor.setControlsVisible(true);
  };

  private onMove = (e: PointerEvent) => {
    this.cursorX = e.clientX;
    this.cursorY = e.clientY;
    clearTimeout(this.dwellTimer);
    clearTimeout(this.controlsTimer);
    this.dwellTimer = window.setTimeout(this.onDwell, NEAR_DWELL_MS);
    if (this.over) this.controlsTimer = window.setTimeout(this.onRestOnPip, CONTROLS_DWELL_MS);
  };

  /** The cursor rests on Pip: offer the quiet way out. */
  private onRestOnPip = () => {
    if (this.enabled && this.over) this.actor.setControlsVisible(true);
  };

  /** The cursor has rested near Pip for a while. */
  private onDwell = () => {
    if (!this.enabled || this.cursorX === null || this.over) return;
    const c = this.actor.center;
    if (!this.blinked && this.active && Math.hypot(this.cursorX - c.x, this.cursorY - c.y) < NEAR_PX) {
      this.blinked = true;
      this.emit('stillNear');
    }
  };

  destroy(): void {
    clearTimeout(this.dwellTimer);
    clearTimeout(this.controlsTimer);
    const pet = this.actor.pet;
    pet.removeEventListener('pointerenter', this.onEnter);
    pet.removeEventListener('pointerleave', this.onLeave);
    pet.removeEventListener('pointermove', this.onPetMove);
    pet.removeEventListener('click', this.onClick);
    pet.removeEventListener('contextmenu', this.onContextMenu);
    this.actor.root.removeEventListener('pointerleave', this.onRootLeave);
    window.removeEventListener('pointermove', this.onMove);
  }
}
