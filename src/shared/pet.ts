import { INK, type Accessory, type CharacterId, type Pose, type SkinId } from './catalog';
import { COSTUMES, propLayer, type Prop } from './costume';

export interface PetLook {
  color: string;
  accessory: Accessory;
  skin: SkinId;
  /** A costumed character replaces color, accessory and skin. */
  character?: CharacterId;
}

export interface PetOptions extends Partial<PetLook> {
  pose?: Pose;
  size?: number;
  flip?: boolean;
  /** Accessible label; omit to hide the drawing from assistive tech. */
  label?: string;
  prop?: Prop;
}

export const DEFAULT_COLOR = '#E8B04B';

const SKIN_COLORS: Partial<Record<SkinId, string>> = {
  cloud: '#BFE3FF',
  starry: '#8C84E8',
  berry: '#FF7D8E',
};

const REST_ARMS: [string, string] = ['M24 82 Q19 88 22 93', 'M96 82 Q101 88 98 93'];

const MOUTH = {
  // The little "w" cat-mouth.
  smile: 'M55 85 Q57.5 88.5 60 85 Q62.5 88.5 65 85',
  open: 'M54 84 Q60 95 66 84 Z',
  o: 'M57 87 a3 3.6 0 1 0 6 0 a3 3.6 0 1 0 -6 0',
  sad: 'M55 89 Q60 85 65 89',
  sleepy: 'M57 86 Q60 88 63 86',
  tiny: 'M57.5 86 Q60 88 62.5 86',
  flat: 'M56 87 L64 87',
  yawn: 'M55 84 Q60 98 65 84 Q60 80 55 84 Z',
};

export interface PoseSpec {
  eyes: 'open' | 'big' | 'happy' | 'closed' | 'half';
  mouth: keyof typeof MOUTH;
  arms: [string, string];
  t: string;
  feet: [number, number, number, number];
  shadow: number;
  eyeT: string;
  extra: '' | 'walk' | 'wave' | 'zzz' | 'drop' | 'spark' | 'tear';
  brows: '' | 'up' | 'sad' | 'angry';
  /** Head turn: shifts eyes, mouth, blush and brows together, so Pip looks somewhere else. */
  faceT: string;
  /** Mood tilt: the sprout droops when sad or sleepy and perks up when happy (drawn at 0.6×). */
  ear: number;
}

/** Squash/stretch about the feet: sx, sy, then a vertical nudge. */
const sq = (sx: number, sy: number, dy = 0) => `translate(0 ${dy}) translate(60 107) scale(${sx} ${sy}) translate(-60 -107)`;

const BASE: PoseSpec = {
  eyes: 'open',
  mouth: 'smile',
  arms: REST_ARMS,
  t: '',
  feet: [48, 106, 72, 106],
  shadow: 30,
  eyeT: '',
  extra: '',
  brows: '',
  faceT: '',
  ear: 0,
};

const POSES: Record<Pose, Partial<PoseSpec>> = {
  idle: {},
  walk: { arms: ['M24 82 Q18 88 14 90', 'M96 82 Q103 86 106 92'], t: 'rotate(-5 60 106)', feet: [44, 103, 75, 107], extra: 'walk', ear: 14 },
  wave: { mouth: 'open', arms: [REST_ARMS[0], 'M96 78 Q106 70 105 58'], t: 'rotate(3 60 106)', extra: 'wave', ear: -6 },
  handshake: { arms: [REST_ARMS[0], 'M96 84 Q106 86 114 82'], t: 'rotate(4 60 106)', eyeT: 'translate(3 1)', ear: 6 },
  bye: { eyes: 'happy', arms: [REST_ARMS[0], 'M96 78 Q107 72 108 60'], t: 'rotate(-6 60 106)', extra: 'wave', feet: [46, 105, 74, 106], ear: 10 },
  sleep: { eyes: 'closed', mouth: 'sleepy', arms: ['M28 90 Q34 96 42 95', 'M92 90 Q86 96 78 95'], t: sq(1.07, 0.9), shadow: 33, extra: 'zzz', ear: 58 },
  surprised: { eyes: 'big', mouth: 'o', arms: ['M24 80 Q14 76 11 68', 'M96 80 Q106 76 109 68'], t: sq(0.95, 1.06, -3), shadow: 26, extra: 'drop', brows: 'up', ear: -10 },
  happy: { eyes: 'happy', mouth: 'open', arms: ['M24 78 Q13 70 14 58', 'M96 78 Q107 70 106 58'], t: sq(0.96, 1.05, -8), shadow: 24, extra: 'spark', ear: -8 },
  sad: { mouth: 'sad', arms: ['M26 86 Q23 93 27 98', 'M94 86 Q97 93 93 98'], t: sq(1.03, 0.96, 1), extra: 'tear', eyeT: 'translate(0 2)', brows: 'sad', ear: 48 },
  tumble: { eyes: 'big', mouth: 'o', arms: ['M24 80 Q14 76 11 68', 'M96 80 Q106 76 109 68'], t: 'rotate(-68 60 100) translate(-6 6)', shadow: 36, extra: 'drop', brows: 'up', ear: 20 },
  // Sitting tucked up, eyes heavy: the cat "loaf".
  loaf: { eyes: 'half', mouth: 'tiny', arms: ['M28 92 Q34 98 42 97', 'M92 92 Q86 98 78 97'], t: sq(1.05, 0.93), shadow: 33, ear: 30 },
  // On-page resting look: eyes on its own world (where it faces, a little down), not on you.
  away: { faceT: 'translate(7 2)', eyeT: 'translate(1.5 0.5)' },
  // A brief look at the viewer; used rarely.
  glance: {},
  // Kneading ("making biscuits"): paws press down in turn, eyes heavy with contentment.
  kneadL: { eyes: 'half', mouth: 'tiny', arms: ['M36 90 Q38 99 42 105', 'M84 88 Q86 93 84 97'], t: sq(1.03, 0.96), ear: 18 },
  kneadR: { eyes: 'half', mouth: 'tiny', arms: ['M36 88 Q34 93 36 97', 'M84 90 Q82 99 78 105'], t: sq(1.03, 0.96), ear: 18 },
  // Rolled onto its back, paws in the air.
  bellyUp: { eyes: 'happy', mouth: 'open', arms: ['M26 80 Q14 68 18 56', 'M94 80 Q106 68 102 56'], t: sq(1.14, 0.8, 4), feet: [30, 96, 90, 96], shadow: 38, ear: 50 },
  // A quick "that's enough" bap with one paw.
  swat: { eyes: 'half', mouth: 'flat', brows: 'angry', arms: [REST_ARMS[0], 'M96 80 Q110 74 118 70'], t: 'rotate(5 60 106)', ear: 45 },
  // Puffed up, mouth open: a hiss.
  hiss: { eyes: 'big', mouth: 'open', brows: 'angry', arms: ['M24 80 Q14 84 12 92', 'M96 80 Q106 84 108 92'], t: sq(1.08, 1.04, -2), ear: 60 },
  // Dog play bow: front down, rear up.
  bow: { eyes: 'open', mouth: 'open', arms: ['M30 92 Q22 100 14 104', 'M86 94 Q80 102 72 106'], t: 'rotate(14 60 106) translate(-4 6)', shadow: 34, ear: -12 },
  // A big yawn, eyes squeezed shut.
  yawn: { eyes: 'closed', mouth: 'yawn', ear: 20, t: sq(0.98, 1.03, -1) },
  // A dog's curious head tilt.
  tilt: { t: 'rotate(-11 60 106)', eyeT: 'translate(1 1)', ear: -10 },
  lookAround: { faceT: 'translate(-7 0)', eyeT: 'translate(-1.5 0)' },
  lookLeft: { faceT: 'translate(-7 0)', eyeT: 'translate(-1.5 0)' },
  lookRight: { faceT: 'translate(7 0)', eyeT: 'translate(1.5 0)' },
  lookUp: { faceT: 'translate(2 -6)', eyeT: 'translate(0 -1.5)', t: 'rotate(-3 60 106)', ear: -6 },
  // Paw to mouth, eyes shut.
  groom: { eyes: 'closed', mouth: 'tiny', arms: [REST_ARMS[0], 'M96 82 Q90 74 72 84'], t: 'rotate(-4 60 106)', ear: 8 },
  // Leaning forward, eyes on the ground.
  sniff: { eyes: 'half', mouth: 'tiny', t: 'rotate(9 60 106)', faceT: 'translate(6 5)', ear: 20 },
  // Being petted: leaning in, eyes closed happily.
  content: { eyes: 'happy', mouth: 'smile', t: 'rotate(-5 60 106)', arms: ['M26 84 Q21 90 25 96', 'M94 84 Q99 90 95 96'], ear: -4 },
  // Had enough: flat mouth, heavy eyes.
  annoyed: { eyes: 'half', mouth: 'flat', brows: 'sad', ear: 40 },
  // Soft, heavy eyes: the open half of a slow blink.
  drowsy: { eyes: 'half', mouth: 'smile', ear: 12 },
  // The closed half of a slow blink.
  blink: { eyes: 'closed', mouth: 'tiny', ear: 12 },
  // Holding something up high (a lightsaber) in the right paw.
  saber: { arms: [REST_ARMS[0], 'M96 82 Q103 90 100 97'], t: 'rotate(-3 60 106)', ear: -6 },
  // Holding a glass out to you.
  offer: { eyes: 'happy', mouth: 'open', arms: [REST_ARMS[0], 'M96 84 Q106 88 111 83'], t: 'rotate(3 60 106)', ear: -6 },
  // One paw stretched out, lifting something with the Force.
  force: { arms: ['M24 80 Q12 72 4 60', REST_ARMS[1]], t: 'rotate(-4 60 106)', faceT: 'translate(-5 -1)', eyeT: 'translate(-1.5 0)' },
  // Hanging upside down from a web, holding a glass to you (drawn the right way up; flipped by the caller).
  hang: { eyes: 'happy', arms: ['M24 80 Q18 90 26 96', 'M96 84 Q106 88 111 83'], ear: 0 },
  // Hero landing: low and wide, one paw down, one out.
  crouch: { eyes: 'half', arms: ['M26 88 Q18 98 16 106', 'M94 84 Q106 80 112 74'], t: sq(1.12, 0.84, 3), feet: [40, 106, 80, 106], shadow: 36, ear: -10 },
  // Eyes closed, paws resting out to the sides, perfectly still.
  meditate: { eyes: 'closed', mouth: 'tiny', arms: ['M26 86 Q18 92 12 92', 'M94 86 Q102 92 108 92'], ear: 4 },
  // One paw thrown out and up: shooting a web or a grapple line.
  webShoot: { eyes: 'big', mouth: 'open', arms: [REST_ARMS[0], 'M96 78 Q108 62 112 46'], t: 'rotate(4 60 106)', ear: -10 },
  // A back paw reaching up to scratch behind the head.
  scratch: { eyes: 'half', mouth: 'tiny', arms: [REST_ARMS[0], 'M94 70 Q104 60 96 50'], t: 'rotate(-8 60 106)', feet: [48, 106, 76, 98], ear: 24 },
  // Front paws down and busy: digging.
  dig: { eyes: 'big', mouth: 'open', arms: ['M30 92 Q34 104 40 108', 'M90 92 Q86 104 80 108'], t: 'rotate(10 60 106) translate(-2 4)', ear: -8 },
};

const S = `stroke="${INK}"`;
const BODY = 'M60 34 C86 34 99 58 99 80 C99 98 83 107 60 107 C37 107 21 98 21 80 C21 58 34 34 60 34 Z';

function skinLayer(skin: SkinId): string {
  switch (skin) {
    case 'polka':
      return `<g opacity="0.55" fill="#FFFFFF"><circle cx="42" cy="50" r="4"/><circle cx="79" cy="46" r="3"/><circle cx="30" cy="93" r="3.5"/><circle cx="90" cy="92" r="3.5"/><circle cx="61" cy="101" r="3"/><circle cx="93" cy="70" r="2.5"/></g>`;
    case 'stripes':
      return `<path d="M40 47 H80 M30 96 H90" fill="none" stroke="#FFFFFF" opacity="0.5" stroke-width="6"/>`;
    case 'cloud':
      return `<g opacity="0.8" fill="#FFFFFF"><circle cx="42" cy="98" r="7"/><circle cx="60" cy="101" r="8"/><circle cx="78" cy="98" r="7"/><circle cx="70" cy="44" r="4"/><circle cx="76" cy="47" r="3.5"/></g>`;
    case 'starry':
      return `<g><circle cx="42" cy="56" r="1.6" fill="#FFFFFF"/><circle cx="80" cy="47" r="2" fill="#FFFFFF"/><circle cx="30" cy="92" r="1.6" fill="#FFFFFF"/><circle cx="91" cy="91" r="1.8" fill="#FFFFFF"/><circle cx="50" cy="101" r="1.4" fill="#FFFFFF"/><path d="M76 92 L77.3 95.7 L81 97 L77.3 98.3 L76 102 L74.7 98.3 L71 97 L74.7 95.7 Z" fill="#FFD872"/><path d="M68 40 L69 42.8 L72 44 L69 45.2 L68 48 L67 45.2 L64 44 L67 42.8 Z" fill="#FFD872"/></g>`;
    case 'berry':
      return `<g fill="#FFF1C2"><ellipse cx="42" cy="52" rx="1.5" ry="2.3"/><ellipse cx="54" cy="43" rx="1.5" ry="2.3"/><ellipse cx="70" cy="43" rx="1.5" ry="2.3"/><ellipse cx="80" cy="52" rx="1.5" ry="2.3"/><ellipse cx="28" cy="94" rx="1.5" ry="2.3"/><ellipse cx="44" cy="101" rx="1.5" ry="2.3"/><ellipse cx="60" cy="103" rx="1.5" ry="2.3"/><ellipse cx="76" cy="101" rx="1.5" ry="2.3"/><ellipse cx="92" cy="94" rx="1.5" ry="2.3"/></g>`;
    default:
      return '';
  }
}

function accessoryLayer(acc: Accessory): string {
  switch (acc) {
    case 'glasses':
      return `<g><circle cx="45" cy="72" r="13" fill="#FFFFFF" opacity="0.15"/><circle cx="75" cy="72" r="13" fill="#FFFFFF" opacity="0.15"/><circle cx="45" cy="72" r="13" fill="none" ${S} stroke-width="2.5"/><circle cx="75" cy="72" r="13" fill="none" ${S} stroke-width="2.5"/><path d="M58 70 Q60 68 62 70" fill="none" ${S} stroke-width="2.5"/></g>`;
    case 'scarf':
      return `<g stroke-linejoin="round"><path d="M76 97 L82 113 L72 114 L67 100 Z" fill="#6FC7A8" ${S} stroke-width="2.5"/><path d="M23 90 Q60 104 97 90 L96 98 Q60 112 24 98 Z" fill="#6FC7A8" ${S} stroke-width="2.5"/></g>`;
    case 'hat':
      return `<g stroke-linejoin="round"><path d="M36 50 Q35 24 60 21 Q85 24 84 50 Z" fill="#D9734E" ${S} stroke-width="2.5"/><path d="M33 49 Q60 42 87 49 L86 56 Q60 49 34 56 Z" fill="#FFD872" ${S} stroke-width="2.5"/><circle cx="60" cy="19" r="6" fill="#FFD872" ${S} stroke-width="2.5"/></g>`;
    default:
      return '';
  }
}

function extraLayer(extra: PoseSpec['extra']): string {
  switch (extra) {
    case 'wave':
      return `<path d="M112 49 Q117 55 115 62 M118 44 Q124 52 121 62" fill="none" ${S} stroke-width="2.5" stroke-linecap="round"/>`;
    case 'spark':
      return `<g stroke-linejoin="round"><path d="M9 34 L11 39 L16 41 L11 43 L9 48 L7 43 L2 41 L7 39 Z" fill="#FFD872" ${S} stroke-width="1.5"/><path d="M109 20 L110.5 24 L114.5 25.5 L110.5 27 L109 31 L107.5 27 L103.5 25.5 L107.5 24 Z" fill="#FFD872" ${S} stroke-width="1.5"/></g>`;
    case 'drop':
      return `<path d="M99 42 Q104 49 99 53 Q94 49 99 42 Z" fill="#9ED8FF" ${S} stroke-width="1.5"/>`;
    case 'tear':
      return `<path d="M40 82 Q44 88 40 92 Q36 88 40 82 Z" fill="#9ED8FF" ${S} stroke-width="1.5"/>`;
    default:
      return '';
  }
}

function eyesLayer(p: PoseSpec): string {
  if (p.eyes === 'open' || p.eyes === 'big') {
    const big = p.eyes === 'big';
    const rx = big ? 10.5 : 9;
    const ry = big ? 12.5 : 11;
    // Big low-set eyes: dark pupil, lavender shine below, two catchlights.
    return (
      `<g class="pp-eyes"><g transform="${p.eyeT}">` +
      `<ellipse cx="45" cy="72" rx="${rx}" ry="${ry}" fill="${INK}"/><ellipse cx="75" cy="72" rx="${rx}" ry="${ry}" fill="${INK}"/>` +
      `<ellipse cx="45" cy="77.5" rx="6" ry="4.5" fill="#7A68C2" opacity="0.65"/><ellipse cx="75" cy="77.5" rx="6" ry="4.5" fill="#7A68C2" opacity="0.65"/>` +
      `<circle cx="48.5" cy="67.5" r="3.6" fill="#FFFFFF"/><circle cx="78.5" cy="67.5" r="3.6" fill="#FFFFFF"/>` +
      `<circle cx="42" cy="76.5" r="1.6" fill="#FFFFFF"/><circle cx="72" cy="76.5" r="1.6" fill="#FFFFFF"/>` +
      `</g></g>`
    );
  }
  if (p.eyes === 'half') {
    // Soft, heavy lids: a rounded lower half of each eye under a gently arched lid.
    return (
      `<g transform="${p.eyeT}">` +
      `<path d="M36.5 75 Q45 69.5 53.5 75 Q53.5 83 45 83 Q36.5 83 36.5 75 Z M66.5 75 Q75 69.5 83.5 75 Q83.5 83 75 83 Q66.5 83 66.5 75 Z" fill="${INK}"/>` +
      `<ellipse cx="45" cy="79.5" rx="4.5" ry="2.6" fill="#7A68C2" opacity="0.65"/><ellipse cx="75" cy="79.5" rx="4.5" ry="2.6" fill="#7A68C2" opacity="0.65"/>` +
      `<circle cx="48" cy="76.5" r="1.7" fill="#FFFFFF"/><circle cx="78" cy="76.5" r="1.7" fill="#FFFFFF"/>` +
      `<path d="M35.5 74.5 Q45 67.5 54.5 74.5 M65.5 74.5 Q75 67.5 84.5 74.5" fill="none" ${S} stroke-width="2.6" stroke-linecap="round"/>` +
      `</g>`
    );
  }
  const d = p.eyes === 'happy' ? 'M37 75 Q45 64 53 75 M67 75 Q75 64 83 75' : 'M37 72 Q45 78 53 72 M67 72 Q75 78 83 72';
  return `<path d="${d}" fill="none" ${S} stroke-width="3" stroke-linecap="round"/>`;
}

/** Drawings made so far: gives each costume's clip path an id unique on the page. */
let drawn = 0;

/**
 * Draws the pet as a self-contained SVG string (120×120 viewBox, drawn at `size` px).
 * Ported from the design canvas's Pet component ("Pebble", sprout species). All inputs
 * come from fixed catalog values, never user text, so the result is safe for innerHTML.
 */

export function petSvg(opts: PetOptions = {}): string {
  const pose = opts.pose ?? 'idle';
  const skin = opts.skin ?? 'plain';
  const acc = opts.accessory ?? 'none';
  const size = opts.size ?? 80;
  const c = opts.character && opts.character !== 'pip' ? COSTUMES[opts.character] : null;
  // Costume clip paths need ids unique on the page (several drawings can share a document).
  const clip = `pp-clip-${++drawn}`;
  const head = c?.head.replace(/pp-red/g, clip) ?? '';
  const fill = c?.fill ?? SKIN_COLORS[skin] ?? opts.color ?? DEFAULT_COLOR;
  const p: PoseSpec = { ...BASE, ...POSES[pose] };
  const brows =
    c ? '' : p.brows === 'up'
      ? `<path d="M37 56 Q44 51 51 54 M69 54 Q76 51 83 56" fill="none" ${S} stroke-width="2.5" stroke-linecap="round"/>`
      : p.brows === 'sad'
        ? `<path d="M37 60 L50 56 M83 60 L70 56" fill="none" ${S} stroke-width="2.5" stroke-linecap="round"/>`
        : p.brows === 'angry'
          ? `<path d="M37 55 L51 60 M83 55 L69 60" fill="none" ${S} stroke-width="2.8" stroke-linecap="round"/>`
          : '';
  const mouthFill = p.mouth === 'open' || p.mouth === 'o' ? INK : 'none';
  const tongue = p.mouth === 'open' ? `<path d="M56.5 89.5 Q60 93 63.5 89.5 Q60 88 56.5 89.5 Z" fill="#FF8FA3"/>` : '';
  // The sprout acts as Pip's tail; CSS sways .pp-sprout, the inner group holds the pose's tilt.
  const sprout =
    acc === 'hat' || c?.noSprout
      ? ''
      : `<g class="pp-sprout"><g transform="rotate(${Math.round(p.ear * 0.6)} 60 38)"><path d="M60 38 Q56 25 64 16" fill="none" ${S} stroke-width="3" stroke-linecap="round"/><path d="M64 16 Q76 3 89 10 Q78 25 64 16 Z" fill="#8DBF7F" ${S} stroke-width="2.5" stroke-linejoin="round"/><path d="M62 21 Q50 9 39 15 Q49 28 62 21 Z" fill="#8DBF7F" ${S} stroke-width="2.5" stroke-linejoin="round"/></g></g>`;
  const arm = (d: string) =>
    `<path d="${d}" fill="none" ${S} stroke-width="10" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c?.arms ?? fill}" stroke-width="5.5" stroke-linecap="round"/>`;
  const [fLx, fLy, fRx, fRy] = p.feet;
  const a11y = opts.label
    ? `role="img" aria-label="${opts.label.replace(/[<>&"]/g, '')}"`
    : 'aria-hidden="true" focusable="false"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" ${a11y} style="overflow:visible;display:block">` +
    `<ellipse cx="60" cy="113" rx="${p.shadow}" ry="4" fill="${INK}" opacity="0.12"/>` +
    `<g transform="${opts.flip ? 'translate(120 0) scale(-1 1)' : ''}">` +
    `<g transform="${p.t}">` +
    (c?.behind ?? '') +
    sprout +
    `<ellipse class="pp-foot pp-foot-l" cx="${fLx}" cy="${fLy}" rx="8.5" ry="5.5" fill="${fill}" ${S} stroke-width="2.5"/>` +
    `<ellipse class="pp-foot pp-foot-r" cx="${fRx}" cy="${fRy}" rx="8.5" ry="5.5" fill="${fill}" ${S} stroke-width="2.5"/>` +
    `<path d="${BODY}" fill="${fill}"/>` +
    (c ? '' : `<ellipse cx="60" cy="95" rx="21" ry="10" fill="#FFFFFF" opacity="0.28"/>`) +
    `<path d="M24 90 C32 103 88 103 96 90 C93 102 80 107 60 107 C40 107 27 102 24 90 Z" fill="${INK}" opacity="0.08"/>` +
    `<ellipse cx="44" cy="48" rx="11" ry="6" fill="#FFFFFF" opacity="0.5" transform="rotate(-28 44 48)"/>` +
    `<circle cx="56" cy="42" r="2" fill="#FFFFFF" opacity="0.6"/>` +
    (c ? '' : skinLayer(skin)) +
    `<path d="${BODY}" fill="none" ${S} stroke-width="2.5"/>` +
    head +
    `<g class="pp-gaze" transform="${p.faceT}">` +
    (c
      ? c.face(p)
      : `<ellipse cx="34" cy="86" rx="7.5" ry="4.5" fill="#FF8FA3" opacity="0.55"/>` +
        `<ellipse cx="86" cy="86" rx="7.5" ry="4.5" fill="#FF8FA3" opacity="0.55"/>` +
        eyesLayer(p) +
        brows +
        `<path d="${MOUTH[p.mouth]}" fill="${mouthFill}" ${S} stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>` +
        tongue) +
    `</g>` +
    (c?.front ?? '') +
    (c ? '' : accessoryLayer(acc)) +
    arm(p.arms[0]) +
    arm(p.arms[1]) +
    propLayer(opts.prop ?? 'none') +
    extraLayer(p.extra) +
    `</g>` +
    (p.extra === 'walk'
      ? `<path d="M4 72 H15 M0 82 H12 M6 92 H15" fill="none" ${S} opacity="0.45" stroke-width="2.5" stroke-linecap="round"/>`
      : '') +
    `</g>` +
    (p.extra === 'zzz'
      ? `<g fill="${INK}" font-family="Fredoka, Nunito, system-ui, sans-serif" font-weight="600"><text x="92" y="40" font-size="12">z</text><text x="100" y="29" font-size="15">z</text><text x="109" y="16" font-size="18">z</text></g>`
      : '') +
    `</svg>`
  );
}

/** The toy ball from the idle-play boards. */
export function ballSvg(size = 28): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true" style="display:block"><circle cx="20" cy="20" r="17" fill="#FFD872"/><path d="M4 17 Q20 27 36 17 L36 23 Q20 33 4 23 Z" fill="#D9734E"/><circle cx="14" cy="12" r="3.5" fill="#FFFFFF" opacity="0.8"/><circle cx="20" cy="20" r="17" fill="none" stroke="${INK}" stroke-width="3"/></svg>`;
}
