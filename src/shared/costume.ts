import { INK, type CharacterId } from './catalog';
import type { PoseSpec } from './pet';

const S = `stroke="${INK}"`;
const BODY = 'M60 34 C86 34 99 58 99 80 C99 98 83 107 60 107 C37 107 21 98 21 80 C21 58 34 34 60 34 Z';

/** Things a character can hold or show beside it. */
export type Prop = 'none' | 'saber' | 'glass' | 'forceGlass';

export interface Costume {
  /** Suit color: body and feet. */
  fill: string;
  /** Glove color for the arms, when it should stand out from the suit. */
  arms?: string;
  noSprout: boolean;
  /** Drawn first, behind everything (capes). */
  behind: string;
  /** Over the body (helmet, mask, cowl, suit pattern). */
  head: string;
  /** The face, inside the head-turn group: lenses, mouth, the blush that gives them away. */
  face: (p: PoseSpec) => string;
  /** Over the face (belt, chest panel). */
  front: string;
}

/** Trying to look scary, but blushing anyway. */
const blush = (y = 88, op = 0.5) =>
  `<ellipse cx="33" cy="${y}" rx="6" ry="3.5" fill="#FF8FA3" opacity="${op}"/><ellipse cx="87" cy="${y}" rx="6" ry="3.5" fill="#FF8FA3" opacity="${op}"/>`;

/** Shut eyes, for naps and slow blinks, drawn as soft lines over any mask. */
const shut = (y: number, color: string) =>
  `<path d="M40 ${y} Q47 ${y + 4} 54 ${y} M66 ${y} Q73 ${y + 4} 80 ${y}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;

/** Big round white eyes, the chibi-hero look; squints when happy, lines when shut. */
function whiteEyes(p: PoseSpec, l: [number, number], r: [number, number], rx: number, ry: number, rim: number): string {
  if (p.eyes === 'closed') return shut(l[1] + 1, INK);
  if (p.eyes === 'happy') {
    const arc = (x: number, y: number) => `M${x - rx} ${y + 3} Q${x} ${y - ry} ${x + rx} ${y + 3} Q${x} ${y - ry * 0.35} ${x - rx} ${y + 3} Z`;
    return `<path d="${arc(...l)} ${arc(...r)}" fill="#FFFFFF" ${S} stroke-width="${rim}" stroke-linejoin="round"/>`;
  }
  const h = p.eyes === 'half' ? 0.6 : 1;
  const eye = ([x, y]: [number, number]) =>
    `<ellipse cx="${x}" cy="${y + (1 - h) * ry * 0.6}" rx="${rx}" ry="${ry * h}" fill="#FFFFFF" ${S} stroke-width="${rim}"/>` +
    `<ellipse cx="${x}" cy="${y + ry * h * 0.45}" rx="${rx * 0.7}" ry="${ry * h * 0.35}" fill="#C9D6EA" opacity="0.7"/>`;
  return `<g class="pp-eyes"><g transform="${p.eyeT}">${eye(l)}${eye(r)}</g></g>`;
}

/* ---------- Vader: a round helmet, a little mask, two big round eyes ---------- */

const vaderHead =
  // Ball-shaped helmet with small, soft flares at the bottom.
  `<path d="M60 26 C88 26 102 46 102 70 C102 80 105 88 110 94 C100 95 94 91 92 86 L28 86 C26 91 20 95 10 94 C15 88 18 80 18 70 C18 46 32 26 60 26 Z" fill="#17171C" ${S} stroke-width="2.5" stroke-linejoin="round"/>` +
  `<ellipse cx="40" cy="42" rx="12" ry="6" fill="#FFFFFF" opacity="0.32" transform="rotate(-30 40 42)"/>` +
  `<circle cx="54" cy="34" r="2.2" fill="#FFFFFF" opacity="0.55"/>` +
  // The mask: a soft, rounded triangle.
  `<path d="M27 60 Q46 56 60 66 Q74 56 93 60 Q96 74 84 90 Q72 104 60 104 Q48 104 36 90 Q24 74 27 60 Z" fill="#3D404C" ${S} stroke-width="2.5" stroke-linejoin="round"/>`;

function vaderFace(p: PoseSpec): string {
  return (
    blush(88, 0.55) +
    whiteEyes(p, [45, 74], [75, 74], 10, 10, 2.6) +
    // A small rounded grille.
    `<path d="M50 87 Q60 85 70 87 Q68 97 60 101 Q52 97 50 87 Z" fill="#B8BDCB" ${S} stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M56 89.5 V94 M60 89.5 V97 M64 89.5 V94" fill="none" ${S} stroke-width="1.4" stroke-linecap="round"/>`
  );
}

const vaderFront =
  `<rect x="67" y="97" width="13" height="7" rx="2" fill="#2B2C33" ${S} stroke-width="1.5"/>` +
  `<circle cx="70.5" cy="100.5" r="1.4" fill="#E5484D"/><circle cx="74" cy="100.5" r="1.4" fill="#56C26A"/><circle cx="77.5" cy="100.5" r="1.4" fill="#4C8DF6"/>`;

const vaderCape = `<path d="M26 66 Q12 86 10 106 Q34 110 60 108 Q86 110 110 106 Q108 86 94 66 Z" fill="#0E0E12" ${S} stroke-width="2.5" stroke-linejoin="round"/>`;

/* ---------- Spider: a red balloon head, big round lenses, a simple web ---------- */

const spiderHead =
  `<defs><clipPath id="pp-red"><path d="${BODY}"/></clipPath></defs>` +
  `<g clip-path="url(#pp-red)">` +
  `<g fill="none" stroke="${INK}" stroke-width="1.1" opacity="0.4">` +
  `<path d="M60 76 L60 26 M60 76 L34 30 M60 76 L86 30 M60 76 L14 56 M60 76 L106 56"/>` +
  `<path d="M42 52 Q51 46 60 49 Q69 46 78 52 M30 40 Q45 30 60 34 Q75 30 90 40"/>` +
  `</g>` +
  // Blue legs and sides below the chest.
  `<path d="M0 88 Q30 86 40 94 Q50 99 60 99 Q70 99 80 94 Q90 86 120 88 L120 130 L0 130 Z" fill="#2350C8"/>` +
  `<path d="M0 88 Q30 86 40 94 Q50 99 60 99 Q70 99 80 94 Q90 86 120 88" fill="none" ${S} stroke-width="2"/>` +
  `</g>`;

function spiderFace(p: PoseSpec): string {
  if (p.eyes === 'open' || p.eyes === 'big') {
    // Big, round-ish lenses, gently tilted toward the nose.
    const lenses =
      `<path d="M30 68 Q30 56 42 58 Q54 61 56 72 Q56 82 45 82 Q31 81 30 68 Z M90 68 Q90 56 78 58 Q66 61 64 72 Q64 82 75 82 Q89 81 90 68 Z" fill="#FFFFFF" ${S} stroke-width="3.5" stroke-linejoin="round"/>` +
      `<ellipse cx="44" cy="77" rx="7" ry="3" fill="#C9D6EA" opacity="0.7"/><ellipse cx="76" cy="77" rx="7" ry="3" fill="#C9D6EA" opacity="0.7"/>`;
    return `<g class="pp-eyes"><g transform="${p.eyeT}">${lenses}</g></g>` + blush(86, 0.5);
  }
  return whiteEyes(p, [44, 71], [76, 71], 12, 11, 3.5) + blush(86, 0.5);
}

const spiderFront =
  // A little spider on the chest.
  `<g stroke="${INK}" stroke-linecap="round" fill="none" stroke-width="1.5"><path d="M58 87 L52 83 M58 90 L52 93 M62 87 L68 83 M62 90 L68 93"/></g>` +
  `<ellipse cx="60" cy="86" rx="2.2" ry="2.2" fill="${INK}"/><ellipse cx="60" cy="90.5" rx="2.6" ry="3.2" fill="${INK}"/>`;

/* ---------- Bat: cowl, white eyes, a jaw set in a permanent frown ---------- */

const batHead =
  `<defs><clipPath id="pp-red"><path d="${BODY}"/></clipPath></defs>` +
  // The bare jaw, then the cowl over the top with tall ears.
  `<g clip-path="url(#pp-red)"><path d="M20 76 Q60 70 100 76 L100 90 Q60 99 20 90 Z" fill="#F1C9A5"/></g>` +
  `<path d="M20 82 Q18 52 30 40 L27 12 L45 33 Q60 29 75 33 L93 12 L90 40 Q102 52 100 82 Q92 80 86 76 Q74 72 70 80 L60 77 L50 80 Q46 72 34 76 Q28 80 20 82 Z" fill="#1F2330" ${S} stroke-width="2.5" stroke-linejoin="round"/>` +
  `<ellipse cx="40" cy="47" rx="9" ry="4" fill="#FFFFFF" opacity="0.22" transform="rotate(-30 40 47)"/>`;

function batFace(p: PoseSpec): string {
  let eyes: string;
  if (p.eyes === 'closed') eyes = shut(66, '#FFFFFF');
  else if (p.eyes === 'happy')
    eyes = `<path d="M36 68 Q45 58 54 67 Q45 64 36 68 Z M84 68 Q75 58 66 67 Q75 64 84 68 Z" fill="#FFFFFF" ${S} stroke-width="2" stroke-linejoin="round"/>`;
  else
    // Narrow, glaring white eyes.
    eyes = `<path d="M35 60 L55 66 Q51 72 42 71 Q36 69 35 60 Z M85 60 L65 66 Q69 72 78 71 Q84 69 85 60 Z" fill="#FFFFFF" ${S} stroke-width="2" stroke-linejoin="round"/>`;
  // A stern little frown, unless it's actually happy (then: a tiny reluctant smile).
  const mouth =
    p.eyes === 'happy' || p.mouth === 'open'
      ? `<path d="M54 87 Q60 91 66 87" fill="none" ${S} stroke-width="2.2" stroke-linecap="round"/>`
      : `<path d="M53 89 Q60 85 67 89" fill="none" ${S} stroke-width="2.2" stroke-linecap="round"/>`;
  return `<g class="pp-eyes"><g transform="${p.eyeT}">${eyes}</g></g>` + blush(86, 0.55) + mouth;
}

const batFront =
  `<path d="M22 96 Q60 106 98 96 L97 102 Q60 112 23 102 Z" fill="#F2C94C" ${S} stroke-width="2" stroke-linejoin="round"/>` +
  `<rect x="56" y="100" width="8" height="6" rx="1.5" fill="#D9A92E" ${S} stroke-width="1.5"/>`;

const batCape =
  `<path d="M26 58 Q8 80 5 108 Q12 102 19 108 Q26 101 34 108 Q60 112 86 108 Q94 101 101 108 Q108 102 115 108 Q112 80 94 58 Z" fill="#141824" ${S} stroke-width="2.5" stroke-linejoin="round"/>`;

export const COSTUMES: Record<Exclude<CharacterId, 'pip'>, Costume> = {
  vader: { fill: '#1E1E24', arms: '#3A3C47', noSprout: true, behind: vaderCape, head: vaderHead, face: vaderFace, front: vaderFront },
  spider: { fill: '#D7263D', arms: '#D7263D', noSprout: true, behind: '', head: spiderHead, face: spiderFace, front: spiderFront },
  bat: { fill: '#4A5060', noSprout: true, behind: batCape, head: batHead, face: batFace, front: batFront },
};

/** A glass of water: tumbler with a wavy water line and a shine. Drawn with its base at (x, y). */
export function glassSvg(x: number, y: number, scale = 1): string {
  return (
    `<g transform="translate(${x} ${y}) scale(${scale}) translate(-9 -24)">` +
    `<path d="M2 7 L16 7 L14.5 23 Q9 25 3.5 23 Z" fill="#7CC4F2"/>` +
    `<path d="M2 7 Q5.5 5 9 7 Q12.5 9 16 7" fill="none" stroke="#FFFFFF" stroke-width="1.2"/>` +
    `<path d="M0 0 L18 0 L15.5 24 Q9 26.5 2.5 24 Z" fill="#FFFFFF" fill-opacity="0.35" ${S} stroke-width="2.2" stroke-linejoin="round"/>` +
    `<path d="M4.5 4 L6 19" fill="none" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" opacity="0.9"/>` +
    `</g>`
  );
}

/** Held props, positioned for the pose that uses them. */
export function propLayer(prop: Prop): string {
  switch (prop) {
    case 'saber':
      return (
        `<g stroke-linecap="round">` +
        `<path d="M104 86 L126 26" stroke="#FF3B3B" stroke-width="12" opacity="0.22"/>` +
        `<path d="M104 86 L126 26" stroke="#FF4D4D" stroke-width="6"/>` +
        `<path d="M104 86 L126 26" stroke="#FFE1E1" stroke-width="2.2"/>` +
        `<path d="M98 102 L104 86" stroke="${INK}" stroke-width="8"/>` +
        `<path d="M98 102 L104 86" stroke="#C9CCD6" stroke-width="5"/>` +
        `</g>`
      );
    case 'glass':
      return glassSvg(116, 86);
    case 'forceGlass':
      return (
        `<g fill="none" stroke="#9ED8FF" stroke-width="2" stroke-linecap="round" opacity="0.9">` +
        `<path d="M3 58 Q-2 52 3 46"/><path d="M-3 61 Q-10 52 -3 43"/></g>` +
        glassSvg(-14, 50) +
        `<g fill="#FFFFFF" ${S} stroke-width="1.2"><path d="M-22 22 L-21 25 L-18 26 L-21 27 L-22 30 L-23 27 L-26 26 L-23 25 Z"/></g>`
      );
    default:
      return '';
  }
}
