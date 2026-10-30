/** Thrown inside a choreography when its signal is aborted (dismissed, input, page hidden). */
export class Aborted extends Error {
  constructor() {
    super('aborted');
  }
}

export function isAborted(e: unknown): e is Aborted {
  return e instanceof Aborted;
}

export function check(signal: AbortSignal): void {
  if (signal.aborted) throw new Aborted();
}

export function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Aborted());
    const id = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      reject(new Aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Runs a Web Animation and keeps its end state as inline style. On abort the
 * element keeps whatever state it reached, so the next routine starts from there.
 */
export function animate(
  el: HTMLElement | SVGElement,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Aborted());
    const anim = el.animate(keyframes, { fill: 'forwards', ...options });
    const settle = () => {
      try {
        anim.commitStyles();
      } catch {
        // Element left the DOM; nothing to keep.
      }
      anim.cancel();
    };
    const onAbort = () => {
      settle();
      reject(new Aborted());
    };
    signal.addEventListener('abort', onAbort, { once: true });
    anim.finished.then(
      () => {
        signal.removeEventListener('abort', onAbort);
        settle();
        resolve();
      },
      () => {
        // Cancelled by onAbort; the abort path already rejected.
      },
    );
  });
}

export function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

export const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** The translate an element is actually painted at (styles may be committed as a matrix). */
export function translateOf(el: HTMLElement): { x: number; y: number } {
  const t = getComputedStyle(el).transform;
  const m = new DOMMatrixReadOnly(t === 'none' ? undefined : t);
  return { x: m.m41, y: m.m42 };
}
