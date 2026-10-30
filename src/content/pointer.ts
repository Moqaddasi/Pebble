/** Last known cursor position on this page, tracked from load so Pip can find a resting cursor. */
export const pointer: { x: number | null; y: number } = { x: null, y: 0 };

window.addEventListener(
  'pointermove',
  (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  },
  { capture: true, passive: true },
);
