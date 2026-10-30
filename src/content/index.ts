import type { CanPlayReply, ToContent, VisitReply } from '../shared/messages';
import { sendToBackground } from '../shared/messages';
import { IDLE_PLAY_MS } from '../shared/schedule';
import { runBallPlay } from './play';
import { Stage } from './stage';
import { runVisit } from './visit';
import { runWater } from './water';

declare global {
  interface Window {
    __pebble?: boolean;
  }
}
/** Set by the build; true only for `npm run e2e` so idle play starts in seconds. */
declare const __TEST__: boolean;

const IDLE_CHECK_MS = __TEST__ ? 1000 : 30_000;
const IDLE_MS = __TEST__ ? 3000 : IDLE_PLAY_MS;

function videoPlaying(): boolean {
  return Array.from(document.querySelectorAll('video')).some((v) => !v.paused && !v.ended);
}

function start(): void {
  let busy = false;
  let stage: Stage | null = null;
  let lastInput = Date.now();
  let playedSinceInput = false;
  let stopPlay: AbortController | null = null;

  const useStage = () => (stage ??= new Stage());
  const release = () => {
    busy = false;
    stage?.destroy();
    stage = null;
  };

  const onInput = () => {
    lastInput = Date.now();
    playedSinceInput = false;
    stopPlay?.abort();
  };
  for (const type of ['keydown', 'pointerdown', 'pointermove', 'wheel', 'touchstart']) {
    window.addEventListener(type, onInput, { capture: true, passive: true });
  }
  document.addEventListener('scroll', onInput, { capture: true, passive: true });

  chrome.runtime.onMessage.addListener((raw, _sender, sendResponse) => {
    const msg = raw as ToContent;
    if (msg.type !== 'visit' && msg.type !== 'water') return false;
    const reply: VisitReply =
      busy || document.hidden || document.fullscreenElement ? { ok: false, reason: 'busy' } : { ok: true };
    sendResponse(reply);
    if (reply.ok) {
      busy = true;
      const run = msg.type === 'water' ? runWater(useStage(), msg.plan) : runVisit(useStage(), msg.plan);
      run.finally(() => {
        release();
        void sendToBackground({ type: 'visitEnded' }).catch(() => {});
      });
    }
    return false;
  });

  setInterval(async () => {
    if (busy || playedSinceInput || document.hidden || document.fullscreenElement) return;
    if (Date.now() - lastInput < IDLE_MS || videoPlaying()) return;
    let reply: CanPlayReply;
    try {
      reply = await sendToBackground<CanPlayReply>({ type: 'canPlay' });
    } catch {
      return; // Extension was reloaded or updated; this copy is orphaned.
    }
    if (!reply.ok || !reply.look || busy) return;
    busy = true;
    playedSinceInput = true;
    stopPlay = new AbortController();
    try {
      await runBallPlay(useStage(), reply.look, reply.petName ?? 'Pip', stopPlay.signal);
    } finally {
      stopPlay = null;
      release();
    }
  }, IDLE_CHECK_MS);
}

if (!window.__pebble && window.top === window) {
  window.__pebble = true;
  start();
}
