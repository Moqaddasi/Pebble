// Petting means deliberate stroking: back-and-forth over Pip for a moment, not brushing past.
const STROKE_MS = 900; // stroking must go on at least this long
const STROKE_REVERSALS = 2; // with at least this many changes of direction
const STROKE_GAP_MS = 400; // a pause longer than this starts over (also covers sweeping just past Pip's edge)
const TURN_PX = 2; // travel needed before a direction counts; summed over events, as slow strokes move <2px each

/** Recognizes a stroke from pointer moves over Pip. */
export class Stroke {
  private start = 0;
  private lastMove = 0;
  /** Where the current direction was last measured from. */
  private anchorX: number | null = null;
  private lastDir = 0;
  private reversals = 0;
  private reported = false;

  /** Pointer moved over Pip. True exactly once per stroke, when it counts as petting and `canReport`. */
  move(x: number, now: number, canReport: boolean): boolean {
    if (now - this.lastMove > STROKE_GAP_MS) this.reset();
    this.lastMove = now;
    if (!this.start) this.start = now;
    if (this.anchorX === null) this.anchorX = x;
    const dx = x - this.anchorX;
    if (Math.abs(dx) >= TURN_PX) {
      const dir = Math.sign(dx);
      if (this.lastDir && dir !== this.lastDir) this.reversals++;
      this.lastDir = dir;
      this.anchorX = x;
    }
    if (!this.reported && canReport && now - this.start >= STROKE_MS && this.reversals >= STROKE_REVERSALS) {
      this.reported = true;
      return true;
    }
    return false;
  }

  private reset(): void {
    this.start = 0;
    this.anchorX = null;
    this.lastDir = 0;
    this.reversals = 0;
    this.reported = false;
  }
}
