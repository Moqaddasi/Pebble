import { INK } from '../shared/catalog';

export const BUTTERFLY = `<svg viewBox="0 0 28 22" width="26" height="20" aria-hidden="true" style="display:block;overflow:visible">
<g style="transform-origin:14px 11px;animation:pp-flutter .22s ease-in-out infinite">
<path d="M14 11 Q6 -2 2 5 Q0 11 14 11 Z" fill="#C9B8FF" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M14 11 Q22 -2 26 5 Q28 11 14 11 Z" fill="#C9B8FF" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M14 11 Q8 20 4 17 Q3 13 14 11 Z" fill="#FFB38A" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
<path d="M14 11 Q20 20 24 17 Q25 13 14 11 Z" fill="#FFB38A" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
</g>
<path d="M14 6 L14 16" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
</svg>`;

export const LADYBUG = `<svg viewBox="0 0 20 16" width="18" height="14" aria-hidden="true" style="display:block;overflow:visible">
<circle cx="15.5" cy="9" r="3.2" fill="${INK}"/>
<ellipse cx="9" cy="9" rx="7" ry="6" fill="#E5484D" stroke="${INK}" stroke-width="1.6"/>
<path d="M9 3 V15" stroke="${INK}" stroke-width="1.4"/>
<circle cx="6" cy="7" r="1.3" fill="${INK}"/><circle cx="12" cy="7" r="1.3" fill="${INK}"/><circle cx="6.5" cy="11.5" r="1.2" fill="${INK}"/><circle cx="11.5" cy="11.5" r="1.2" fill="${INK}"/>
</svg>`;

export const PEBBLE = `<svg viewBox="0 0 20 14" width="18" height="13" aria-hidden="true" style="display:block;overflow:visible">
<path d="M3 9 Q2 3 9 2 Q17 2 18 8 Q18 13 10 13 Q3 13 3 9 Z" fill="#B8BDCB" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
<ellipse cx="8" cy="5.5" rx="3" ry="1.4" fill="#FFFFFF" opacity="0.6"/>
</svg>`;

/** A soft ring, for the Force. */
export const RIPPLE = `<svg viewBox="0 0 40 40" width="40" height="40" aria-hidden="true" style="display:block;overflow:visible">
<circle cx="20" cy="20" r="14" fill="none" stroke="#9ED8FF" stroke-width="2.5" opacity="0.9"/>
</svg>`;

export const DIRT = `<svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true" style="display:block"><circle cx="5" cy="5" r="4" fill="#A9825A"/></svg>`;

export const PUFF = `<svg viewBox="0 0 60 40" width="72" height="48" aria-hidden="true" style="display:block;overflow:visible">
<g fill="#4A5060" opacity="0.55"><circle cx="16" cy="24" r="12"/><circle cx="32" cy="16" r="14"/><circle cx="46" cy="26" r="11"/><circle cx="30" cy="30" r="10"/></g>
</svg>`;

/** A patch of warm light on the floor. */
export const SUNBEAM = `<svg viewBox="0 0 160 220" width="160" height="220" aria-hidden="true" style="display:block">
<defs><linearGradient id="pp-sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE7A3" stop-opacity="0"/><stop offset="1" stop-color="#FFE7A3" stop-opacity="0.55"/></linearGradient></defs>
<path d="M40 0 L120 0 L160 220 L0 220 Z" fill="url(#pp-sun)"/>
</svg>`;

/** Spider-sense: wavy lines over the head. */
export const TINGLE = `<svg viewBox="0 0 36 18" width="36" height="18" aria-hidden="true" style="display:block;overflow:visible">
<g fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"><path d="M4 16 Q2 10 6 6 Q9 3 6 0"/><path d="M18 16 Q16 10 20 6 Q23 3 20 0"/><path d="M32 16 Q30 10 34 6 Q37 3 34 0"/></g>
</svg>`;
