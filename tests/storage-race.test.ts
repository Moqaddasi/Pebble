import { beforeEach, describe, expect, it, vi } from 'vitest';

/** In-memory chrome.storage.local that, like the real one, answers asynchronously. */
function fakeChrome() {
  let data: Record<string, unknown> = {};
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    storage: {
      local: {
        get: async (key: string | string[]) => {
          await tick();
          const keys = Array.isArray(key) ? key : [key];
          return Object.fromEntries(keys.filter((k) => k in data).map((k) => [k, structuredClone(data[k])]));
        },
        set: async (items: Record<string, unknown>) => {
          await tick();
          data = { ...data, ...structuredClone(items) };
        },
      },
      onChanged: { addListener: () => {} },
    },
    dump: () => data,
  };
}

describe('settings storage', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('chrome', fakeChrome());
  });

  it('never loses a save that lands while Pip’s personality is being created', async () => {
    const { getSettings } = await import('../src/shared/storage');
    // Hold back the first write (the one that creates Pip's personality)…
    const local = chrome.storage.local as unknown as { set: (i: Record<string, unknown>) => Promise<void> };
    const realSet = local.set;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let first = true;
    local.set = async (items) => {
      if (first) {
        first = false;
        await gate;
      }
      return realSet(items);
    };
    const reading = getSettings();
    await new Promise((r) => setTimeout(r, 5));
    // …while another part of the extension finishes setup…
    await realSet({ settings: { onboarded: true, userName: 'Sara' } });
    // …then let the personality write land.
    release();
    await reading;
    local.set = realSet;
    const s = await getSettings();
    expect(s.onboarded).toBe(true);
    expect(s.userName).toBe('Sara');
    expect(s.traits).not.toBeNull();
  });

  it('keeps the same personality across reads', async () => {
    const { getSettings } = await import('../src/shared/storage');
    const a = await getSettings();
    const b = await getSettings();
    expect(b.traits).toEqual(a.traits);
  });

  it('moves traits saved by older versions into their own key', async () => {
    const traits = { temperament: 'cat', energy: 0.4, sociability: 0.3, boldness: 0.5, favoriteSpot: 0.2, favoriteActivity: 'nap' };
    await chrome.storage.local.set({ settings: { onboarded: true, traits } });
    const { getSettings } = await import('../src/shared/storage');
    const s = await getSettings();
    expect(s.traits).toEqual(traits);
    expect(s.onboarded).toBe(true);
  });
});
