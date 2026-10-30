import type { Visit } from './behavior';
import type { Line, WaterLine } from './lines';
import type { PetLook } from './pet';
import type { Traits } from './personality';

/** Everything the content script needs to perform one visit. */
export interface VisitPlan extends Visit {
  look: PetLook;
  userName: string;
  petName: string;
  /** The line to say: a hello (opt-in) or a murmur; unused when speech is 'none'. */
  hello: Line;
  traits: Traits;
  /** 0–1, how relaxed Pip is around the user's cursor. */
  bond: number;
}

/** Everything the content script needs to bring the user a glass of water. */
export interface WaterPlan {
  look: PetLook;
  petName: string;
  userName: string;
  line: WaterLine;
  /** Said after "Done, I drank". */
  drank: WaterLine;
  traits: Traits;
  side: 'left' | 'right';
}

/** Background → content. */
export type ToContent = { type: 'visit'; plan: VisitPlan } | { type: 'water'; plan: WaterPlan };

export type VisitReply = { ok: true } | { ok: false; reason: 'busy' };

/** Content/popup → background. */
export type ToBackground =
  | { type: 'snooze' }
  | { type: 'visitNow' }
  | { type: 'canPlay' }
  | { type: 'visitEnded' }
  /** Pip accepted a gentle petting session: the bond grows a little. */
  | { type: 'petted' }
  /** Water reminder answered: drank (from the bubble or the popup), or "Later". */
  | { type: 'waterDone' }
  | { type: 'waterLater' };

export interface CanPlayReply {
  ok: boolean;
  look?: PetLook;
  petName?: string;
}

export function sendToBackground<R = unknown>(msg: ToBackground): Promise<R> {
  return chrome.runtime.sendMessage(msg) as Promise<R>;
}
