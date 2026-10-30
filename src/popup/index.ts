import { ACCESSORIES, CHARACTERS, COLORS, FREQUENCIES, NAME_MAX, PET_NAME_SUGGESTIONS, SKINS, characterName, skinName, type Pose, type SkinId } from '../shared/catalog';
import { DONATE_URL, PRODUCT_NAME, SHARE_URL } from '../shared/config';
import { sendToBackground } from '../shared/messages';
import { petSvg } from '../shared/pet';
import { BERRY_DAYS, rollTraits, traitWords, type Temperament } from '../shared/personality';
import { getSettings, hostOf, onSettingsChanged, updateSettings, type Settings } from '../shared/storage';
import { WATER_EVERY, addGlass, glassesToday, type WaterSettings } from '../shared/water';
import { h, ICONS } from './dom';
import { renderShareCard } from './sharecard';

type Screen =
  | { name: 'welcome' }
  | { name: 'pickLook' }
  | { name: 'settings'; tab: 'look' | 'behavior' }
  | { name: 'names' }
  | { name: 'skins' }
  | { name: 'share' }
  | { name: 'berry' }
  | { name: 'unlocked'; skin: SkinId }
  | { name: 'water' };

const app = document.getElementById('app')!;
let S: Settings;
let screen: Screen = { name: 'settings', tab: 'look' };
let currentHost: string | null = null;
let flash = '';
/** When the background will next bring water (the real alarm, so snooze and “Later” show). */
let waterAlarmAt: number | null = null;

async function refreshWaterAlarm(): Promise<void> {
  waterAlarmAt = (await chrome.alarms.get('water'))?.scheduledTime ?? null;
}

function go(next: Screen): void {
  screen = next;
  flash = '';
  render();
}

async function save(patch: Partial<Settings>): Promise<void> {
  S = await updateSettings(patch);
  render();
}

/** The pet as it looks now (its character included); skin previews pass `character: 'pip'`. */
const pet = (pose: Pose, size: number, extra: Partial<Parameters<typeof petSvg>[0]> = {}) =>
  h('div', { html: petSvg({ color: S.color, accessory: S.accessory, skin: S.skin, character: S.character, pose, size, ...extra }), style: 'line-height:0' });

const hero = () => S.character !== 'pip';
const displayName = () => characterName(S.character, S.petName);
const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

function backButton(to: Screen, label: string): HTMLElement {
  return h('button', { class: 'icon-btn', 'aria-label': label, html: ICONS.back, onclick: () => go(to) });
}

/* ---------- onboarding ---------- */

function nameFields(onValid: (ok: boolean) => void, onUser: (v: string) => void) {
  let i = PET_NAME_SUGGESTIONS.indexOf(S.petName);
  const you = h('input', {
    id: 'ob-you',
    class: 'field',
    type: 'text',
    placeholder: 'Your name',
    maxlength: NAME_MAX,
    autocomplete: 'given-name',
    value: S.userName,
  }) as HTMLInputElement;
  const petInput = h('input', {
    id: 'ob-pet',
    class: 'field grow',
    type: 'text',
    placeholder: 'Name me',
    maxlength: NAME_MAX,
    value: S.petName,
  }) as HTMLInputElement;
  const check = () => onValid(you.value.trim().length > 0 && petInput.value.trim().length > 0);
  you.addEventListener('input', () => {
    onUser(you.value);
    check();
  });
  petInput.addEventListener('input', check);
  const dice = h('button', {
    class: 'icon-btn',
    style: 'width:46px;height:46px;border:2px solid var(--line);background:var(--surface)',
    'aria-label': 'Suggest a name',
    title: 'Suggest a name',
    html: ICONS.dice,
    onclick: () => {
      i = (i + 1) % PET_NAME_SUGGESTIONS.length;
      petInput.value = PET_NAME_SUGGESTIONS[i];
      check();
    },
  });
  const el = h(
    'div',
    { class: 'col gap14' },
    h('div', { class: 'col gap6' }, h('label', { for: 'ob-you', class: 'label' }, 'What should I call you?'), you),
    h('div', { class: 'col gap6' }, h('label', { for: 'ob-pet', class: 'label' }, "And what's my name?"), h('div', { class: 'row gap8' }, petInput, dice)),
  );
  queueMicrotask(check);
  return { el, you, petInput };
}

function steps(n: 1 | 2): HTMLElement {
  return h(
    'div',
    { class: 'row', style: 'justify-content:space-between' },
    h('span', { class: 'label muted', style: 'font-size:13px' }, `Step ${n} of 2`),
    h('div', { class: 'dots', 'aria-hidden': 'true' }, h('span', { class: n === 1 ? 'on' : '' }), h('span', { class: n === 2 ? 'on' : '' })),
  );
}

function welcomeScreen(): HTMLElement {
  const who = h('span', { class: 'hl' }, S.userName.trim() || 'friend');
  const next = h('button', { class: 'btn-primary' }, "Let's be friends") as HTMLButtonElement;
  const fields = nameFields(
    (ok) => (next.disabled = !ok),
    (v) => (who.textContent = v.trim() || 'friend'),
  );
  next.addEventListener('click', async () => {
    await save({ userName: fields.you.value.trim(), petName: fields.petInput.value.trim() });
    go({ name: 'pickLook' });
  });
  return h(
    'section',
    { class: 'screen roomy' },
    steps(1),
    h(
      'div',
      { class: 'stage col', style: 'height:176px;align-items:center;justify-content:flex-end;gap:8px;padding-bottom:6px' },
      h('div', { class: 'bubble' }, 'Nice to meet you, ', who, '!'),
      pet('wave', 104),
    ),
    h('h1', { class: 'display', style: 'font-size:24px' }, "Hi! Let's get acquainted."),
    fields.el,
    h('div', { class: 'bottom' }, next, h('span', { class: 'center muted', style: 'font-size:13px' }, 'You can change both anytime in settings.')),
  );
}

function pickLookScreen(): HTMLElement {
  return h(
    'section',
    { class: 'screen roomy' },
    steps(2),
    h('h1', { class: 'display', style: 'font-size:22px' }, 'Cat or dog person?'),
    temperamentPicker(),
    h('p', { class: 'muted small', style: 'margin-top:-4px' }, 'Shapes how I act. You can change everything later.'),
    lookControls(true),
    h(
      'div',
      { class: 'bottom' },
      h('button', { class: 'btn-primary', onclick: () => save({ onboarded: true }).then(() => go({ name: 'settings', tab: 'look' })) }, "I'm ready"),
      h('span', { class: 'center muted', style: 'font-size:13px' }, `I'll drop by in a little while.`),
    ),
  );
}

/* ---------- settings ---------- */

function statusText(): string {
  if (flash) return flash;
  if (S.quiet) return 'Quiet mode · resting in the toolbar';

  if (S.snoozeUntil > Date.now()) {
    const t = new Date(S.snoozeUntil).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return `Snoozing until ${t}`;
  }
  if (currentHost && S.excludedHosts.includes(currentHost)) return `Staying away from ${currentHost}`;
  if (S.mode === 'water') {
    if (!S.water.on) return 'Water only · reminders are off';
    return waterAlarmAt ? `Water only · next glass ${clock(waterAlarmAt)}` : 'Water only';
  }
  return 'Out and about · next visit soon';
}

function header(): HTMLElement {
  const avatar = h(
    'button',
    {
      class: 'avatar',
      'aria-label': `Call ${S.petName} over now`,
      title: `Call ${S.petName} over`,
      onclick: async () => {
        const res = await sendToBackground<{ ok: boolean }>({ type: 'visitNow' }).catch(() => ({ ok: false }));
        if (res.ok) window.close();
        else {
          flash = `${S.petName} can't visit this page`;
          render();
        }
      },
    },
    pet('idle', 38),
  );
  return h(
    'div',
    { class: 'row gap10' },
    avatar,
    h('div', { class: 'col grow', style: 'gap:1px;min-width:0' }, h('span', { class: 'display pet-name' }, displayName()), h('span', { class: 'status' }, statusText())),
    snoozeButton(),
  );
}

/** Snooze for an hour (or wake up), always at hand in the header. */
function snoozeButton(): HTMLElement {
  const snoozed = S.snoozeUntil > Date.now();
  const label = snoozed ? 'Wake up now' : 'Snooze for 1 hour';
  return h('button', {
    class: 'icon-btn',
    'aria-label': label,
    title: label,
    html: snoozed ? ICONS.sun : ICONS.moon,
    onclick: () => save({ snoozeUntil: snoozed ? 0 : Date.now() + 60 * 60 * 1000 }),
  });
}

function tabs(active: 'look' | 'behavior'): HTMLElement {
  const tab = (id: 'look' | 'behavior', label: string) =>
    h('button', { class: 'tab', role: 'tab', 'aria-selected': String(active === id), onclick: () => go({ name: 'settings', tab: id }) }, label);
  return h('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Settings sections' }, tab('look', 'Look'), tab('behavior', 'Behavior'));
}

/** Color, accessory and skin pickers. `compact` (setup step 2) uses a smaller preview and leaves skins for later. */
function lookControls(compact = false): HTMLElement {
  const freeSkins = SKINS.filter((s) => !s.unlock);
  return h(
    'div',
    { class: compact ? 'col gap10' : 'col gap14' },
    h('div', { class: 'stage', style: `height:${compact ? 96 : 128}px` }, pet('happy', compact ? 80 : 104)),
    h(
      'div',
      { class: 'col gap8' },
      h('span', { class: 'label' }, 'Color'),
      h(
        'div',
        { class: 'swatches' },
        ...COLORS.map((c) =>
          h('button', {
            class: 'swatch',
            style: `background:${c.hex}`,
            'aria-label': c.name,
            'aria-pressed': String(!hero() && S.color === c.hex),
            // Characters wear their own suits: picking a color goes back to Classic.
            onclick: () => save({ color: c.hex, character: 'pip' }),
          }),
        ),
      ),
    ),
    h(
      'div',
      { class: 'col gap8' },
      h('span', { class: 'label' }, 'Accessory'),
      h(
        'div',
        { class: 'seg' },
        ...ACCESSORIES.map((a) =>
          h('button', { 'aria-pressed': String(!hero() && S.accessory === a.id), onclick: () => save({ accessory: a.id, character: 'pip' }) }, a.label),
        ),
      ),
    ),
    !compact && skinPicker(freeSkins),
  );
}

/* ---------- water ---------- */

const EVERY_LABEL: Record<WaterSettings['everyMin'], string> = { 30: '30m', 45: '45m', 60: '1h', 90: '1½h', 120: '2h' };

function waterSummary(): string {
  if (!S.water.on) return S.mode === 'water' ? 'Off · nothing will visit' : 'Off';
  return `Every ${EVERY_LABEL[S.water.everyMin]} · ${glassesToday(S.glasses, new Date())} today`;
}

function waterRow(): HTMLElement {
  return h(
    'button',
    { class: 'unlock-row', style: 'padding-top:7px;padding-bottom:7px', onclick: () => go({ name: 'water' }) },
    h('span', { class: 'ic', style: 'background:#DDEFFB', html: ICONS.glass }),
    h('span', { class: 'col grow' }, h('span', { class: 'label' }, 'Water reminders'), h('span', { class: 'small muted' }, waterSummary())),
    h('span', { class: 'muted', html: ICONS.chevron }),
  );
}

function waterScreen(): HTMLElement {
  const w = S.water;
  const setWater = (patch: Partial<WaterSettings>) => save({ water: { ...w, ...patch } });
  const time = (id: string, label: string, key: 'from' | 'to') => {
    const input = h('input', { id, class: 'field', type: 'time', value: w[key], style: 'height:40px' }) as HTMLInputElement;
    input.addEventListener('change', () => {
      if (input.value) void setWater({ [key]: input.value });
    });
    return h('label', { class: 'col grow small muted', for: id, style: 'gap:2px' }, label, input);
  };
  const count = glassesToday(S.glasses, new Date());
  return h(
    'section',
    { class: 'screen' },
    h('div', { class: 'row gap8' }, backButton({ name: 'settings', tab: 'behavior' }, 'Back to settings'), h('h1', { class: 'display grow', style: 'font-size:22px' }, 'Water')),
    toggle('Water reminders', `${displayName()} brings you a glass at the times you choose.`, w.on, () => setWater({ on: !w.on })),
    h(
      'div',
      { class: 'seg', role: 'group', 'aria-label': 'What visits' },
      h('button', { 'aria-pressed': String(S.mode === 'visits'), onclick: () => save({ mode: 'visits' }) }, 'Visits + water'),
      h('button', { 'aria-pressed': String(S.mode === 'water'), onclick: () => save({ mode: 'water' }) }, 'Water only'),
    ),
    h(
      'div',
      { class: 'card stack', style: `opacity:${w.on ? 1 : 0.5}` },
      h('span', { class: 'label' }, 'Every'),
      h(
        'div',
        { class: 'seg every', role: 'group', 'aria-label': 'How often' },
        ...WATER_EVERY.map((m) => h('button', { 'aria-pressed': String(w.everyMin === m), disabled: !w.on, onclick: () => setWater({ everyMin: m }) }, EVERY_LABEL[m])),
      ),
      h('span', { class: 'label', style: 'margin-top:4px' }, 'Only between'),
      h('div', { class: 'row gap8' }, time('w-from', 'From', 'from'), time('w-to', 'To', 'to')),
    ),
    h(
      'div',
      { class: 'card tight' },
      h('div', { class: 'col grow', style: 'gap:2px' }, h('span', { class: 'label' }, 'Today'), h('span', { class: 'small muted' }, `${count} ${count === 1 ? 'glass' : 'glasses'} of water`)),
      h('button', { class: 'btn-chip', onclick: () => save({ glasses: addGlass(S.glasses, new Date()) }) }, 'I drank one'),
    ),
  );
}

/** Free skins as quick picks, with a link to the full gallery. */
function skinPicker(freeSkins: typeof SKINS): HTMLElement {
  return h(
    'div',
    { class: 'col gap8' },
    h(
      'div',
      { class: 'row', style: 'justify-content:space-between;align-items:baseline' },
      h('span', { class: 'label' }, 'Skin'),
      h('button', { class: 'link-btn', onclick: () => go({ name: 'skins' }) }, 'All skins →'),
    ),
    h(
      'div',
      { class: 'skin-grid' },
      ...freeSkins.map((s) =>
        h(
          'button',
          { class: 'skin-tile', 'aria-label': s.name, 'aria-pressed': String(!hero() && S.skin === s.id), onclick: () => save({ skin: s.id, character: 'pip' }) },
          pet('idle', 36, { skin: s.id, accessory: 'none', character: 'pip' }),
        ),
      ),
      ...CHARACTERS.filter((c) => c.id !== 'pip').map((c) =>
        h(
          'button',
          { class: 'skin-tile', 'aria-label': characterName(c.id, S.petName), 'aria-pressed': String(S.character === c.id), onclick: () => save({ character: c.id }) },
          pet('idle', 36, { character: c.id }),
        ),
      ),
    ),
  );
}

/** Cat person / Dog person: sets Pip's temperament (re-rolls its traits, keeps its favorite spot). */
function temperamentPicker(): HTMLElement {
  const pick = (t: Temperament) => () => {
    if (S.temperament !== t) void save({ temperament: t, traits: rollTraits(t, Math.random, S.traits ?? undefined) });
  };
  return h(
    'div',
    { class: 'seg', role: 'group', 'aria-label': 'Pip’s temperament' },
    h('button', { 'aria-pressed': String(S.temperament === 'cat'), onclick: pick('cat') }, 'Cat person'),
    h('button', { 'aria-pressed': String(S.temperament === 'dog'), onclick: pick('dog') }, 'Dog person'),
  );
}

function toggle(title: string, desc: string, on: boolean, flip: () => void, disabled = false): HTMLElement {
  return h(
    'div',
    { class: 'card' },
    h('div', { class: 'col grow gap4', style: 'gap:2px' }, h('span', { class: 'label' }, title), h('span', { class: 'small muted', style: 'line-height:1.35' }, desc)),
    h('button', { class: 'switch', role: 'switch', 'aria-checked': String(on), 'aria-label': title, disabled, onclick: flip }),
  );
}

function behaviorControls(): HTMLElement {
  const freqLabel = h('span', { class: 'muted', style: 'font-size:13px;font-weight:700' }, FREQUENCIES[S.frequency - 1].label);
  const range = h('input', { id: 'st-freq', type: 'range', min: 1, max: 5, step: 1, value: S.frequency }) as HTMLInputElement;
  range.addEventListener('input', () => (freqLabel.textContent = FREQUENCIES[Number(range.value) - 1].label));
  range.addEventListener('change', () => void save({ frequency: Number(range.value) }));
  const excluded = !!currentHost && S.excludedHosts.includes(currentHost);
  return h(
    'div',
    { class: 'col gap8 panel' },
    hero()
      ? h('div', { class: 'card tight' }, h('span', { class: 'small muted', style: 'line-height:1.35' }, `${displayName()} has their own personality: ${CHARACTERS.find((c) => c.id === S.character)!.tagline.toLowerCase()}`))
      : temperamentPicker(),
    waterRow(),
    h(
      'div',
      { class: 'card stack' },
      h('div', { class: 'row', style: 'justify-content:space-between;align-items:baseline' }, h('label', { for: 'st-freq', class: 'label' }, 'How often I visit'), freqLabel),
      range,
    ),
    toggle('Quiet mode', 'No visits. I’ll wait in the toolbar.', S.quiet, () => save({ quiet: !S.quiet })),
    toggle('Say hi sometimes', 'A short hello now and then.', S.sayHi, () => save({ sayHi: !S.sayHi })),
    toggle(
      'Not on this site',
      currentHost ?? 'Open a website to use this.',
      excluded,
      () =>
        currentHost &&
        save({ excludedHosts: excluded ? S.excludedHosts.filter((x) => x !== currentHost) : [...S.excludedHosts, currentHost] }),
      !currentHost,
    ),
    h(
      'div',
      { class: 'card tight' },
      h(
        'div',
        { class: 'col grow', style: 'gap:2px;min-width:0' },
        h('span', { class: 'label' }, `You're ${S.userName} · I'm ${S.petName}`),
        S.traits && h('span', { class: 'small muted' }, `${S.petName} is ${traitWords(S.traits).join(', ')}`),
      ),
      h('button', { class: 'btn-chip', onclick: () => go({ name: 'names' }) }, 'Edit'),
    ),
  );
}

/** Buy Me a Coffee, drawn natively in its own colors (the hosted widget script can't run in an extension). */
function donateButton(): HTMLElement {
  return h('a', { class: 'bmc', href: DONATE_URL, target: '_blank', rel: 'noopener', html: ICONS.coffee }, 'Buy me a coffee');
}

function settingsScreen(tab: 'look' | 'behavior'): HTMLElement {
  return h(
    'section',
    { class: 'screen' },
    header(),
    tabs(tab),
    tab === 'look' ? lookControls() : behaviorControls(),
    tab === 'look' && h('div', { class: 'bottom', style: 'align-items:center' }, donateButton()),
  );
}

function namesScreen(): HTMLElement {
  const saveBtn = h('button', { class: 'btn-primary' }, 'Save') as HTMLButtonElement;
  const fields = nameFields(
    (ok) => (saveBtn.disabled = !ok),
    () => {},
  );
  saveBtn.addEventListener('click', async () => {
    await save({ userName: fields.you.value.trim(), petName: fields.petInput.value.trim() });
    go({ name: 'settings', tab: 'behavior' });
  });
  return h(
    'section',
    { class: 'screen' },
    h('div', { class: 'row gap8' }, backButton({ name: 'settings', tab: 'behavior' }, 'Back to settings'), h('h1', { class: 'display', style: 'font-size:22px' }, 'Names')),
    fields.el,
    h('div', { class: 'bottom' }, saveBtn),
  );
}

/* ---------- skins & unlocks ---------- */

function skinsScreen(): HTMLElement {
  const heroes = CHARACTERS.filter((c) => c.id !== 'pip');
  const have = SKINS.filter((s) => S.unlocked.includes(s.id)).length + heroes.length;
  const lockText = { share: 'Share to unlock', petting: `Pet on ${BERRY_DAYS} days` } as const;
  const tiles = SKINS.map((s) => {
    const locked = !S.unlocked.includes(s.id);
    const on = !hero() && S.skin === s.id;
    // The rows below explain how to unlock; the tile just says so.
    const tag = locked ? 'Locked' : on ? 'Wearing' : 'Free';
    return h(
      'button',
      {
        class: `gallery-tile${locked ? ' locked' : ''}`,
        'aria-pressed': String(on),
        'aria-label': `${s.name}, ${locked ? `locked: ${lockText[s.unlock!]}` : on ? 'wearing' : 'free'}`,
        onclick: () => (locked ? go({ name: s.unlock === 'share' ? 'share' : 'berry' }) : save({ skin: s.id, character: 'pip' })),
      },
      h('div', { class: 'pet-slot' }, pet('idle', 54, { skin: s.id, accessory: 'none', character: 'pip' })),
      locked && h('span', { class: 'lock-dot', html: ICONS.lock }),
      h('span', { class: 'label' }, s.name),
      h('span', { class: `tag ${locked ? 'lock' : on ? 'on' : 'free'}` }, tag),
    );
  });
  // Characters are skins too: a full suit with its own personality.
  const heroTiles = heroes.map((c) => {
    const on = S.character === c.id;
    const name = characterName(c.id, S.petName);
    return h(
      'button',
      { class: 'gallery-tile', 'aria-pressed': String(on), 'aria-label': `${name}, character${on ? ', wearing' : ''}`, onclick: () => save({ character: c.id }) },
      h('div', { class: 'pet-slot' }, pet('idle', 54, { character: c.id })),
      h('span', { class: 'label' }, c.short),
      h('span', { class: `tag ${on ? 'on' : 'free'}` }, on ? 'Wearing' : 'Character'),
    );
  });
  const unlockRow = (skin: SkinId, to: Screen, icon: string, tint: string, hint: string) =>
    S.unlocked.includes(skin)
      ? null
      : h(
          'button',
          { class: 'unlock-row', onclick: () => go(to) },
          h('span', { class: 'ic', style: `background:${tint}`, html: icon }),
          h('span', { class: 'col grow' }, h('span', { class: 'label' }, skinName(skin)), h('span', { class: 'small muted' }, hint)),
          h('span', { class: 'muted', html: ICONS.chevron }),
        );
  const rows = [
    unlockRow('starry', { name: 'share' }, ICONS.share, '#ECE6FF', `Share a card of ${S.petName}, anywhere`),
    unlockRow('berry', { name: 'berry' }, ICONS.heart, '#FFE3E7', `Pet ${S.petName} on ${BERRY_DAYS} different days · ${Math.min(new Set(S.pettingDays).size, BERRY_DAYS)}/${BERRY_DAYS}`),
  ].filter(Boolean) as HTMLElement[];
  return h(
    'section',
    { class: 'screen' },
    h(
      'div',
      { class: 'row gap8' },
      backButton({ name: 'settings', tab: 'look' }, 'Back to settings'),
      h('h1', { class: 'display grow', style: 'font-size:22px' }, 'Skins'),
      h('span', { class: 'count' }, `${have} of ${SKINS.length + heroes.length} collected`),
    ),
    h('div', { class: 'gallery' }, ...tiles, ...heroTiles),
    rows.length > 0 && h('div', { class: 'col gap8', style: 'margin-top:4px' }, h('span', { class: 'label' }, 'Unlock the rest'), ...rows),
  );
}

async function unlock(skin: SkinId): Promise<void> {
  if (!S.unlocked.includes(skin)) {
    await save({ unlocked: [...S.unlocked, skin] });
    go({ name: 'unlocked', skin });
  }
}

function shareScreen(): HTMLElement {
  const note = h('span', { class: 'note', role: 'status' }, 'Nothing is ever posted for you.');
  const preview = h('div', { class: 'card-preview' });
  const cardFile = renderShareCard({ color: S.color, accessory: S.accessory, skin: S.skin }, S.petName, S.userName).then((blob) => {
    preview.append(h('img', { src: URL.createObjectURL(blob), alt: `Card: Say hi to ${S.petName}` }));
    return new File([blob], 'pebble.png', { type: 'image/png' });
  });
  const text = `Say hi to ${S.petName}, my tiny browsing buddy. ${SHARE_URL}`;

  const shareBtn = h('button', { class: 'btn-primary', html: ICONS.share }, 'Share card…');
  shareBtn.addEventListener('click', async () => {
    const file = await cardFile;
    try {
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: PRODUCT_NAME, text });
      else if (navigator.share) await navigator.share({ title: PRODUCT_NAME, text, url: SHARE_URL });
      else {
        await navigator.clipboard.writeText(text);
        note.textContent = 'Sharing isn’t available here, so I copied the link.';
      }
      await unlock('starry');
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') note.textContent = 'Couldn’t open sharing. Try copying the link.';
    }
  });
  const copyBtn = h('button', { class: 'btn-soft', html: ICONS.copy }, 'Copy link');
  copyBtn.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      note.textContent = 'Link copied.';
      await unlock('starry');
    } catch {
      note.textContent = 'Couldn’t copy. Try again.';
    }
  });
  const saveBtn = h('button', { class: 'btn-soft', html: ICONS.download }, 'Save image');
  saveBtn.addEventListener('click', async () => {
    const file = await cardFile;
    const a = h('a', { href: URL.createObjectURL(file), download: 'pebble.png' }) as HTMLAnchorElement;
    a.click();
    note.textContent = 'Saved.';
    await unlock('starry');
  });

  return h(
    'section',
    { class: 'screen', style: 'gap:14px' },
    h('div', { class: 'row gap8' }, backButton({ name: 'skins' }, 'Back to skins'), h('span', { class: 'label muted' }, 'Unlock a skin')),
    preview,
    h(
      'div',
      { class: 'row gap12' },
      h(
        'div',
        { class: 'col grow gap4' },
        h('h1', { class: 'display', style: 'font-size:22px' }, `Share ${S.petName}, get Starry`),
        h('p', { class: 'muted', style: 'line-height:1.45' }, 'Post this card wherever you like. Starry unlocks the moment you share.'),
      ),
      h('div', { class: 'stage', style: 'width:64px;height:64px;border-radius:18px;background:#ECE6FF;padding:0' }, pet('happy', 56, { skin: 'starry', accessory: 'none', character: 'pip' })),
    ),
    h('div', { class: 'bottom' }, shareBtn, h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px' }, copyBtn, saveBtn), note),
  );
}

/** Berry is earned by befriending Pip: petting it on a few different days. */
function berryScreen(): HTMLElement {
  const have = new Set(S.pettingDays).size;
  const dots = h(
    'div',
    { class: 'progress', role: 'img', 'aria-label': `${Math.min(have, BERRY_DAYS)} of ${BERRY_DAYS} days` },
    ...Array.from({ length: BERRY_DAYS }, (_, i) => h('span', { class: i < have ? 'on' : '' })),
  );
  return h(
    'section',
    { class: 'screen', style: 'gap:14px' },
    h('div', { class: 'row gap8' }, backButton({ name: 'skins' }, 'Back to skins'), h('span', { class: 'label muted' }, 'Unlock a skin')),
    h(
      'div',
      { class: 'stage', style: 'position:relative;height:168px;border-radius:22px;background:#FFE3E7;padding-bottom:6px;overflow:hidden' },
      h('div', { style: 'position:absolute;right:52px;top:30px;line-height:0', html: ICONS.heart }),
      h('div', { style: 'position:absolute;left:48px;top:44px;line-height:0;transform:scale(.7)', html: ICONS.heart }),
      pet('happy', 124, { skin: 'berry', accessory: 'none', character: 'pip' }),
    ),
    h(
      'div',
      { class: 'col gap4' },
      h('h1', { class: 'display', style: 'font-size:22px' }, `Befriend ${S.petName} for Berry`),
      h(
        'p',
        { class: 'muted', style: 'line-height:1.45' },
        `Pet ${S.petName} on ${BERRY_DAYS} different days and Berry is yours. When ${S.petName} visits, stroke it gently with your cursor.`,
      ),
    ),
    h('div', { class: 'col gap8', style: 'align-items:flex-start' }, dots, h('span', { class: 'label' }, `${Math.min(have, BERRY_DAYS)} of ${BERRY_DAYS} days`)),
    h('div', { class: 'bottom' }, h('button', { class: 'btn-primary', onclick: () => go({ name: 'skins' }) }, 'Got it')),
  );
}

function unlockedScreen(skin: SkinId): HTMLElement {
  const colors = ['#FF8A5B', '#9FE0C4', '#C9B8FF', '#FFD872', '#FF8FA3', '#A8D4FF'];
  const pts = [[28, 70], [74, 40], [300, 64], [252, 34], [46, 170], [318, 160], [20, 270], [330, 258], [96, 118], [266, 112], [150, 30], [200, 56], [60, 330], [300, 340]];
  const confetti = pts.map(([x, y], i) =>
    h('span', {
      class: 'confetti',
      'aria-hidden': 'true',
      style: `left:${x}px;top:${y}px;width:${i % 3 === 0 ? 10 : 7}px;height:${i % 3 === 0 ? 10 : 16}px;border-radius:${i % 3 === 0 ? '50%' : '3px'};background:${colors[i % colors.length]};transform:rotate(${(i * 37) % 180}deg)`,
    }),
  );
  const name = skinName(skin);
  const done = () => go({ name: 'settings', tab: 'look' });
  return h(
    'section',
    { class: 'screen', style: 'align-items:stretch' },
    ...confetti,
    h('button', { class: 'icon-btn close-corner', 'aria-label': 'Close', html: ICONS.close, onclick: done }),
    h('div', { class: 'halo' }, pet('happy', 168, { skin, accessory: 'none', character: 'pip' })),
    h('span', { class: 'premium' }, `${name} · Premium`),
    h('h1', { class: 'display center', style: 'position:relative;font-size:30px;line-height:1.1' }, 'New skin unlocked!'),
    h('p', { class: 'muted center', style: 'position:relative;font-size:15px' }, skin === 'berry' ? `${S.petName} trusts you now.` : `${S.petName} is so fancy now. Thank you!`),
    h(
      'div',
      { class: 'bottom', style: 'position:relative' },
      h('button', { class: 'btn-primary', onclick: () => save({ skin }).then(done) }, `Wear ${name} now`),
      h('button', { class: 'btn-ghost', onclick: done }, 'Keep my current look'),
    ),
  );
}

/* ---------- app ---------- */

const focusables = () => Array.from(app.querySelectorAll<HTMLElement>('button, input, a[href]'));
let renderedScreen = '';

function render(): void {
  // Re-rendering replaces every node; put keyboard focus back on the same control.
  const sameScreen = renderedScreen === JSON.stringify(screen);
  const focusIndex = sameScreen ? focusables().indexOf(document.activeElement as HTMLElement) : -1;
  const scrollTop = sameScreen ? (app.querySelector('.screen')?.scrollTop ?? 0) : 0;
  let view: HTMLElement;
  switch (screen.name) {
    case 'welcome':
      view = welcomeScreen();
      break;
    case 'pickLook':
      view = pickLookScreen();
      break;
    case 'settings':
      view = settingsScreen(screen.tab);
      break;
    case 'names':
      view = namesScreen();
      break;
    case 'skins':
      view = skinsScreen();
      break;
    case 'share':
      view = shareScreen();
      break;
    case 'berry':
      view = berryScreen();
      break;
    case 'unlocked':
      view = unlockedScreen(screen.skin);
      break;
    case 'water':
      view = waterScreen();
      break;
  }
  app.replaceChildren(view);
  renderedScreen = JSON.stringify(screen);
  const fresh = app.querySelector('.screen');
  if (fresh) fresh.scrollTop = scrollTop;
  if (focusIndex >= 0) focusables()[focusIndex]?.focus({ preventScroll: true });
}

async function init(): Promise<void> {
  S = await getSettings();
  await refreshWaterAlarm();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentHost = hostOf(tab?.url);
  screen = S.onboarded ? { name: 'settings', tab: 'look' } : { name: 'welcome' };
  // A skin earned while the popup was closed (Berry, from petting): celebrate it now.
  if (S.onboarded && S.newUnlock) {
    screen = { name: 'unlocked', skin: S.newUnlock };
    S = await updateSettings({ newUnlock: null });
  }
  document.title = PRODUCT_NAME;
  render();
  // Keep in sync with snoozes and unlocks made elsewhere (e.g. the on-page pill).
  onSettingsChanged(async (next) => {
    const changed = JSON.stringify(next) !== JSON.stringify(S);
    S = next;
    // The background reschedules water on its own change listener; give it a moment.
    await new Promise((r) => setTimeout(r, 150));
    await refreshWaterAlarm();
    if (changed && screen.name === 'settings') render();
  });
}

declare const __TEST__: boolean;

void init();

if (__TEST__) {
  // e2e hook (stripped from release builds): the real toolbar popup can't be scripted,
  // so it reports a forced visit itself.
  void chrome.storage.local.get('e2eVisitNow').then(async ({ e2eVisitNow }) => {
    if (!e2eVisitNow) return;
    const reply = await sendToBackground({ type: 'visitNow' }).catch((e) => ({ error: String(e) }));
    await chrome.storage.local.set({ e2eVisitNow: false, e2eVisitNowReply: reply });
  });
}
