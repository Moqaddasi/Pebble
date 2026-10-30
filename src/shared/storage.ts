import { CHARACTERS, FREE_SKINS, RETIRED_COLORS, type Accessory, type CharacterId, type SkinId } from './catalog';
import { DEFAULT_COLOR } from './pet';
import { isTraits, rollTraits, type Bond, type Temperament, type Traits } from './personality';
import { DEFAULT_WATER, WATER_EVERY, isTime, type Glasses, type WaterSettings } from './water';

export interface Settings {
  onboarded: boolean;
  userName: string;
  petName: string;
  color: string;
  accessory: Accessory;
  skin: SkinId;
  unlocked: SkinId[];
  /** 1 (now and then) to 5 (often). */
  frequency: number;
  quiet: boolean;
  /** Cat person / Dog person: sets Pip's temperament. */
  temperament: Temperament;
  /** This Pip's own traits, rolled once (null until first rolled). */
  traits: Traits | null;
  bond: Bond;
  /** Opt-in: now and then Pip says a short hello using your name. Off by default. */
  sayHi: boolean;
  /** Epoch ms; no visits before this time. */
  snoozeUntil: number;
  excludedHosts: string[];
  /** Days (epoch days) Pip accepted petting; three different days unlock Berry. */
  pettingDays: number[];
  /** A skin just earned in the background, celebrated the next time the popup opens. */
  newUnlock: SkinId | null;
  /** Classic Pip or a costumed character (which has its own personality instead of cat/dog). */
  character: CharacterId;
  /** `water`: no regular visits or ball play, only water reminders. */
  mode: 'visits' | 'water';
  water: WaterSettings;
  /** Glasses of water today. */
  glasses: Glasses;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  userName: '',
  petName: 'Pip',
  color: DEFAULT_COLOR,
  accessory: 'none',
  skin: 'plain',
  unlocked: [...FREE_SKINS],
  frequency: 2,
  quiet: false,
  temperament: 'cat',
  traits: null,
  bond: { value: 0, gainedToday: 0, day: 0 },
  sayHi: false,
  snoozeUntil: 0,
  excludedHosts: [],
  pettingDays: [],
  newUnlock: null,
  character: 'pip',
  mode: 'visits',
  water: DEFAULT_WATER,
  glasses: { day: '', count: 0 },
};

/** Fills gaps from defaults so older or partial stored objects stay valid. */
export function withDefaults(stored: Partial<Settings> | undefined): Settings {
  const s = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  s.unlocked = Array.from(new Set([...FREE_SKINS, ...(s.unlocked ?? [])]));
  if (!s.unlocked.includes(s.skin)) s.skin = 'plain';
  s.color = RETIRED_COLORS[s.color] ?? s.color;
  // Fields from earlier versions.
  delete (s as Partial<Settings> & { personalNotes?: unknown }).personalNotes;
  delete (s as Partial<Settings> & { email?: unknown }).email;
  s.pettingDays = Array.isArray(s.pettingDays) ? s.pettingDays.filter((d) => Number.isInteger(d)) : [];
  if (s.temperament !== 'dog') s.temperament = 'cat';
  if (!CHARACTERS.some((c) => c.id === s.character)) s.character = 'pip';
  if (s.mode !== 'water') s.mode = 'visits';
  const w = (s.water ?? {}) as Partial<WaterSettings>;
  s.water = {
    on: w.on === true,
    everyMin: (WATER_EVERY as readonly number[]).includes(w.everyMin as number) ? w.everyMin! : DEFAULT_WATER.everyMin,
    from: isTime(w.from) ? w.from : DEFAULT_WATER.from,
    to: isTime(w.to) ? w.to : DEFAULT_WATER.to,
  };
  const g = (s.glasses ?? {}) as Partial<Glasses>;
  s.glasses =
    typeof g.day === 'string' && Number.isInteger(g.count) && (g.count as number) >= 0
      ? { day: g.day, count: g.count as number }
      : { day: '', count: 0 };
  if (!isTraits(s.traits) || s.traits.temperament !== s.temperament) s.traits = null;
  else if (s.traits.favoriteSpot > 0.3 && s.traits.favoriteSpot < 0.7) {
    // Spots from before Pip kept clear of the reading column.
    s.traits = { ...s.traits, favoriteSpot: s.traits.favoriteSpot < 0.5 ? 0.26 : 0.74 };
  }
  const f = Number(s.frequency);
  s.frequency = Number.isFinite(f) ? Math.min(5, Math.max(1, Math.round(f))) : DEFAULT_SETTINGS.frequency;
  return s;
}

/**
 * Settings, plus this Pip's traits. Traits live under their own storage key and are rolled
 * (and saved) the first time they're needed. Saving them never rewrites the settings object,
 * so a save happening elsewhere at the same moment (finishing setup, say) can't be undone.
 */
export async function getSettings(): Promise<Settings & { traits: Traits }> {
  const stored = await chrome.storage.local.get(['settings', 'traits']);
  const settings = stored.settings as (Partial<Settings> & { traits?: unknown }) | undefined;
  // Older versions kept traits inside the settings object.
  const savedTraits = isTraits(stored.traits) ? stored.traits : isTraits(settings?.traits) ? settings.traits : null;
  const s = withDefaults({ ...(settings ?? {}), traits: savedTraits });
  if (!s.traits) {
    s.traits = rollTraits(s.temperament, Math.random, savedTraits ?? undefined);
    await chrome.storage.local.set({ traits: s.traits });
  } else if (!isTraits(stored.traits)) {
    await chrome.storage.local.set({ traits: s.traits });
  }
  return s as Settings & { traits: Traits };
}

export async function updateSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = withDefaults({ ...(await getSettings()), ...patch });
  const { traits, ...rest } = next;
  const items: Record<string, unknown> = { settings: rest };
  if (patch.traits) items.traits = traits;
  await chrome.storage.local.set(items);
  return next;
}

/** Calls back with the full settings (traits included) whenever settings or traits change. */
export function onSettingsChanged(cb: (next: Settings, previous: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || (!changes.settings && !changes.traits)) return;
    void getSettings().then((next) => {
      const previous = changes.settings ? withDefaults(changes.settings.oldValue as Partial<Settings> | undefined) : next;
      cb(next, previous);
    });
  });
}

export function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname : null;
  } catch {
    return null;
  }
}
