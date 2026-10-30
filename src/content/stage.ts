declare const __TEST__: boolean;

const FONT_STYLE_ID = 'pebble-fonts';

/** Declares the bundled fonts on the page; shadow roots can only use document-level @font-face. */
function ensureFonts(): void {
  if (document.getElementById(FONT_STYLE_ID)) return;
  const url = (f: string) => chrome.runtime.getURL(`fonts/${f}`);
  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = `
@font-face{font-family:"Pebble Fredoka";font-weight:600;font-display:swap;src:url("${url('fredoka-600.woff2')}") format("woff2")}
@font-face{font-family:"Pebble Nunito";font-weight:700;font-display:swap;src:url("${url('nunito-700.woff2')}") format("woff2")}
@font-face{font-family:"Pebble Nunito";font-weight:800;font-display:swap;src:url("${url('nunito-800.woff2')}") format("woff2")}`;
  (document.head ?? document.documentElement).appendChild(style);
}

function parseRgb(color: string): [number, number, number, number] | null {
  const m = color.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
}

/** True when the page paints a dark background behind its content. */
export function pageIsDark(): boolean {
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const rgb = parseRgb(getComputedStyle(el).backgroundColor);
    if (!rgb || rgb[3] < 0.5) continue;
    const [r, g, b] = rgb.map((c) => c / 255);
    return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
  }
  // Transparent page: the canvas is dark only when the page opts into a dark color scheme.
  const scheme = getComputedStyle(document.documentElement).colorScheme;
  return scheme.trim() === 'dark' || (scheme.includes('dark') && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.layer{position:fixed;inset:0;pointer-events:none;z-index:2147483647;overflow:hidden;
  font-family:"Pebble Nunito",Nunito,system-ui,-apple-system,"Segoe UI",sans-serif;color:#2B2340}
.actor{position:absolute;left:0;bottom:16px;will-change:transform}
.body{position:relative;transform-origin:50% 90%}
.pet{pointer-events:auto;cursor:default;line-height:0}
.props{position:absolute;inset:0;pointer-events:none}
.prop{position:absolute;line-height:0}

.bubble{position:absolute;bottom:calc(100% + 12px);max-width:220px;width:max-content;pointer-events:auto;cursor:pointer;
  background:#FFFFFF;color:#2B2340;border:2px solid #2B2340;border-radius:18px;padding:9px 14px;
  font-weight:700;font-size:15px;line-height:20px;box-shadow:0 4px 0 rgba(43,35,64,.12);
  display:block;overflow-wrap:anywhere;
  opacity:0;transform:translateY(6px) scale(.96);transition:opacity .2s ease,transform .2s ease}
.bubble.show{opacity:1;transform:none}
.bubble .name{background:#FFE08A;color:#2B2340;border-radius:6px;padding:0 4px}
.bubble::after{content:"";position:absolute;bottom:-8px;width:13px;height:13px;background:inherit;
  border-right:2px solid currentColor;border-bottom:2px solid currentColor;transform:rotate(45deg);
  border-color:inherit}
.side-right .bubble{right:0}
.side-right .bubble::after{right:var(--tail)}
.side-left .bubble{left:0}
.side-left .bubble::after{left:var(--tail)}
.dark .bubble{background:#2E2842;color:#F7F0E8;border-color:#F7F0E8}
.bubble.asking{cursor:default;max-width:240px}
.bubble .actions{display:flex;gap:6px;margin-top:8px}
.bubble .actions button{all:unset;box-sizing:border-box;flex:1;min-height:44px;padding:0 12px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  font:800 13px/1.1 "Pebble Nunito",Nunito,system-ui,sans-serif;cursor:pointer;background:#FFFFFF;color:#2B2340;border:2px solid #E3D8C0;white-space:nowrap}
.bubble .actions button.primary{background:#2F5D50;color:#FFFFFF;border-color:#2F5D50}
.bubble .actions button:focus-visible{outline:2px solid #FFB38A;outline-offset:2px}
.dark .bubble .actions button{background:#3A3152;color:#F7F0E8;border-color:#4A4066}
.dark .bubble .actions button.primary{background:#5FAF8F;color:#14201B;border-color:#5FAF8F}

/* Hanging upside down, and the web or grapple line it hangs from (clipped at the top of the screen). */
.upside .pet{transform:rotate(180deg)}
.climb-left .pet{transform:rotate(90deg)}
.climb-right .pet{transform:rotate(-90deg)}
.line{position:absolute;left:50%;bottom:calc(100% - 6px);width:2px;height:3000px;margin-left:-1px;pointer-events:none}
.upside .line{bottom:calc(100% - 4px)}
.line.web{background:#FFFFFF;box-shadow:0 0 0 1px rgba(43,35,64,.35)}
.line.grapple{background:#2B2340}
.chip{position:absolute;bottom:calc(100% + 8px);left:50%;width:max-content;margin-left:-38px;white-space:nowrap;padding:5px 10px;border-radius:999px;
  background:#E2ECDD;color:#1F6B4E;font:800 13px/1 "Pebble Nunito",Nunito,system-ui,sans-serif;animation:pp-rise 1.8s ease-out forwards;--dx:0px}
.dark .bubble .name{background:#FFD872}

.controls{position:absolute;bottom:calc(100% + 12px);display:flex;gap:6px;padding:5px;border-radius:999px;
  background:#2B2340;box-shadow:0 8px 20px -8px rgba(43,35,64,.5);pointer-events:none;
  opacity:0;transform:translateY(4px);transition:opacity .15s ease .25s,transform .15s ease .25s}
.side-right .controls{right:calc(100% + 4px)}
.side-left .controls{left:calc(100% + 4px)}
.controls.up{bottom:calc(100% + 72px)}
.controls.show,.controls:focus-within{opacity:1;transform:none;pointer-events:auto;transition-delay:0s}
.controls button{all:unset;display:flex;align-items:center;gap:6px;height:32px;padding:0 12px 0 10px;border-radius:999px;
  background:#3A3152;color:#FFF7EE;font:700 13px/1 "Pebble Nunito",Nunito,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.controls button:hover{background:#4A4066}
.controls button:focus-visible{outline:2px solid #FFB38A;outline-offset:2px}
/* Bridge the gap between pet and pill so the pointer can travel without losing hover. */
.controls::before{content:"";position:absolute;inset:-12px}

/* Layers: .actor (travel) > .hop (hop height) > .body (activities, breathing) > .squash (pose pops). */
.hop,.squash{transform-origin:50% 100%}
/* Eyes following something (the cursor while stalking): the whole face turns smoothly. */
.pp-gaze{transition:transform .14s ease-out}
.body{animation:pp-breathe 3.2s ease-in-out infinite}
@keyframes pp-breathe{0%,100%{transform:scale(1,1)}50%{transform:scale(1.015,.985)}}
.resting .body{animation-duration:4.4s}

/* Walk cycle: feet lift in turn, the body bobs twice per cycle. */
.pp-foot{transform-box:fill-box;transform-origin:50% 100%}
@keyframes pp-step{0%,100%{transform:translate(0,0)}25%{transform:translate(-2px,-5px) rotate(-8deg)}50%{transform:translate(0,0)}}
@keyframes pp-bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}
.walking .pp-foot-l{animation:pp-step .44s ease-in-out infinite}
.walking .pp-foot-r{animation:pp-step .44s ease-in-out -.22s infinite}
.walking .body{animation:pp-bob .22s ease-in-out infinite}
/* Run: faster cycle, bigger bounce, leaning into the direction of travel. */
.running .pp-foot-l{animation-duration:.24s}
.running .pp-foot-r{animation-duration:.24s;animation-delay:-.12s}
.running .body{animation:pp-run-bob .12s ease-in-out infinite}
@keyframes pp-run-bob{0%,100%{transform:translateY(0) rotate(var(--lean,0deg))}50%{transform:translateY(-5px) rotate(var(--lean,0deg))}}

/* Blinks every few seconds, each pet on its own phase. */
.pp-eyes{transform-box:fill-box;transform-origin:50% 55%;animation:pp-blink 4.6s var(--blink-delay,0s) infinite}
@keyframes pp-blink{0%,93%,100%{transform:scaleY(1)}96%{transform:scaleY(.12)}}

/* The sprout works like a tail: a lazy sway, quicker while walking. */
.pp-sprout{transform-box:fill-box;transform-origin:15% 100%;animation:pp-sprout 3.4s ease-in-out infinite}
@keyframes pp-sprout{0%,100%{transform:rotate(-5deg)}50%{transform:rotate(6deg)}}
.walking .pp-sprout{animation-duration:.88s}
.wag .pp-sprout{animation:pp-wag .5s ease-in-out infinite}
.flick .pp-sprout{animation:pp-flick .6s ease-out}
@keyframes pp-flick{0%{transform:rotate(0)}25%{transform:rotate(-28deg)}55%{transform:rotate(18deg)}100%{transform:rotate(0)}}
@keyframes pp-wag{0%,100%{transform:rotate(-10deg)}50%{transform:rotate(10deg)}}

@keyframes pp-orbit{0%{transform:rotate(0deg) translateX(var(--r)) rotate(0deg)}100%{transform:rotate(360deg) translateX(var(--r)) rotate(-360deg)}}
@keyframes pp-rise{0%{opacity:0;transform:translate(0,0)}20%{opacity:1}100%{opacity:0;transform:translate(var(--dx),-48px)}}
@keyframes pp-flutter{0%,100%{transform:scaleX(1)}50%{transform:scaleX(.35)}}
@keyframes pp-sway{0%,100%{transform:rotate(-6deg)}50%{transform:rotate(6deg)}}
@media (prefers-reduced-motion: reduce){
  .body,.walking .body,.running .body,.pp-foot,.walking .pp-foot-l,.walking .pp-foot-r,.pp-sprout,.walking .pp-sprout,.wag .pp-sprout,.flick .pp-sprout{animation:none}
  .bubble,.controls{transition:none}
}`;

/** The fixed, click-through overlay that holds the pet, isolated from page CSS. */
export class Stage {
  readonly host: HTMLElement;
  readonly layer: HTMLDivElement;

  constructor() {
    ensureFonts();
    this.host = document.createElement('pebble-pet');
    // Open only in the e2e build so tests can measure the pet; closed for real pages.
    const shadow = this.host.attachShadow({ mode: __TEST__ ? 'open' : 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS;
    this.layer = document.createElement('div');
    this.layer.className = 'layer';
    if (pageIsDark()) this.layer.classList.add('dark');
    shadow.append(style, this.layer);
    document.documentElement.appendChild(this.host);
  }

  get width(): number {
    return document.documentElement.clientWidth || window.innerWidth;
  }

  get height(): number {
    return window.innerHeight;
  }

  destroy(): void {
    this.host.remove();
  }
}
