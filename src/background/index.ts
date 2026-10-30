import { planVisit, rememberVisit } from '../shared/behavior';
import { HERO_MURMURS } from '../shared/heroes';
import { drankLine, murmur, renderLine, waterLine } from '../shared/lines';
import { applyPetting, decayBond, earnedBerry, epochDay, recordPettingDay, type Traits } from '../shared/personality';
import type { CanPlayReply, ToBackground, ToContent, VisitPlan, VisitReply, WaterPlan } from '../shared/messages';
import { RETRY_MINUTES, SNOOZE_MS, nextDelayMinutes, skipReason } from '../shared/schedule';
import { getSettings, hostOf, onSettingsChanged, updateSettings, type Settings } from '../shared/storage';
import { LATER_MIN, addGlass, inWindow, nextWaterAt } from '../shared/water';

const VISIT_ALARM = 'visit';
const WATER_ALARM = 'water';

async function getRecent(): Promise<string[]> {
  const { recent } = await chrome.storage.local.get('recent');
  return Array.isArray(recent) ? (recent as string[]) : [];
}

async function scheduleNext(minutes?: number): Promise<void> {
  const s = await getSettings();
  const delay = minutes ?? nextDelayMinutes(s.frequency, Math.random);
  await chrome.alarms.create(VISIT_ALARM, { delayInMinutes: delay });
}

/** The next water reminder: at `when` (epoch ms), or the regular next time; cleared when reminders are off. */
async function scheduleWater(when?: number): Promise<void> {
  const s = await getSettings();
  const at = s.water.on ? (when ?? nextWaterAt(new Date(), s.water)) : null;
  if (at === null) await chrome.alarms.clear(WATER_ALARM);
  else await chrome.alarms.create(WATER_ALARM, { when: at });
}

async function ensureScheduled(): Promise<void> {
  if (!(await chrome.alarms.get(VISIT_ALARM))) await scheduleNext();
  if (!(await chrome.alarms.get(WATER_ALARM))) await scheduleWater();
}

/**
 * The active tab of the last focused normal window. Scheduled visits also require that
 * window to have focus; forced ones don't, because the toolbar popup takes focus from it.
 */
async function focusedTab(requireFocus: boolean): Promise<chrome.tabs.Tab | null> {
  try {
    const win = await chrome.windows.getLastFocused({ windowTypes: ['normal'] });
    if ((requireFocus && !win.focused) || win.state === 'minimized' || win.id === undefined) return null;
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    return tab ?? null;
  } catch {
    return null;
  }
}

/** The bond as it stands today, after fading for the days without petting. */
const bondNow = (s: Settings) => decayBond(s.bond, Math.max(0, epochDay(Date.now()) - s.bond.day)).value;

async function buildPlan(s: Settings & { traits: Traits }): Promise<VisitPlan> {
  const hour = new Date().getHours();
  const bond = bondNow(s);
  const hero = s.character === 'pip' ? null : s.character;
  const visit = planVisit(Math.random, { traits: s.traits, hour, bond, sayHi: s.sayHi, recent: await getRecent(), character: s.character });
  const mutter = hero ? { before: HERO_MURMURS[hero][Math.floor(Math.random() * HERO_MURMURS[hero].length)], after: '' } : murmur(Math.random);
  return {
    ...visit,
    look: lookOf(s),
    userName: s.userName,
    petName: s.petName,
    hello: visit.speech === 'hello' ? renderLine(visit.lineKind, { hour }, Math.random) : mutter,
    traits: s.traits,
    bond,
  };
}

const lookOf = (s: Settings) => ({ color: s.color, accessory: s.accessory, skin: s.skin, character: s.character });

async function send(tabId: number, msg: ToContent): Promise<VisitReply | null> {
  try {
    return (await chrome.tabs.sendMessage(tabId, msg)) as VisitReply;
  } catch {
    // Tabs opened before install or update have no content script yet.
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
      return (await chrome.tabs.sendMessage(tabId, msg)) as VisitReply;
    } catch {
      return null;
    }
  }
}

/** Tries to visit the current tab. `force` ignores quiet/snooze (popup "call Pip over"). */
async function visit(force = false): Promise<boolean> {
  const s = await getSettings();
  const tab = await focusedTab(!force);
  const host = hostOf(tab?.url);
  const reason = skipReason(force ? { ...s, quiet: false, snoozeUntil: 0 } : s, Date.now(), host);
  if (reason || !tab?.id) return false;

  const plan = await buildPlan(s);
  const reply = await send(tab.id, { type: 'visit', plan });
  if (!reply?.ok) return false;
  await chrome.storage.local.set({ recent: rememberVisit(await getRecent(), plan) });
  return true;
}

/** Brings the user a glass of water on the current tab, if the pet may be there now. */
async function remind(s: Settings & { traits: Traits }): Promise<boolean> {
  const tab = await focusedTab(true);
  if (skipReason(s, Date.now(), hostOf(tab?.url)) || !tab?.id) return false;
  const plan: WaterPlan = {
    look: lookOf(s),
    petName: s.petName,
    userName: s.userName,
    line: waterLine(s.character, s.petName, Math.random),
    drank: drankLine(s.character, s.petName, Math.random),
    traits: s.traits,
    side: Math.random() < 0.5 ? 'left' : 'right',
  };
  const reply = await send(tab.id, { type: 'water', plan });
  return reply?.ok === true;
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === VISIT_ALARM) {
    // Water-only mode: no regular visits, but keep the alarm ticking for when it's switched back.
    const s = await getSettings();
    const visited = s.mode === 'water' ? true : await visit();
    await scheduleNext(visited ? undefined : RETRY_MINUTES);
    return;
  }
  if (alarm.name === WATER_ALARM) {
    const s = await getSettings();
    if (!s.water.on) return;
    const now = new Date();
    // A retry that ran past the end of the window waits for the next one.
    if (!inWindow(now.getHours() * 60 + now.getMinutes(), s.water.from, s.water.to)) return scheduleWater();
    // Shown: the next one comes at the regular time ("Later" moves it closer). Not shown: try again soon.
    const shown = await remind(s);
    await scheduleWater(shown ? undefined : Date.now() + RETRY_MINUTES * 60_000);
  }
});

chrome.runtime.onMessage.addListener((raw, sender, sendResponse) => {
  const msg = raw as ToBackground;
  switch (msg.type) {
    case 'snooze':
      updateSettings({ snoozeUntil: Date.now() + SNOOZE_MS }).then(() => sendResponse({ ok: true }));
      return true;
    case 'visitNow':
      visit(true).then((ok) => sendResponse({ ok }));
      return true;
    case 'canPlay':
      getSettings().then((s) => {
        const host = hostOf(sender.tab?.url);
        const ok = sender.tab?.active === true && s.mode !== 'water' && skipReason(s, Date.now(), host) === null;
        const reply: CanPlayReply = ok ? { ok, look: lookOf(s), petName: s.petName } : { ok };
        sendResponse(reply);
      });
      return true;
    case 'petted':
      getSettings().then(async (s) => {
        const faded = decayBond(s.bond, Math.max(0, epochDay(Date.now()) - s.bond.day));
        const pettingDays = recordPettingDay(s.pettingDays, Date.now());
        const patch: Partial<Settings> = { bond: applyPetting(faded, Date.now()), pettingDays };
        // Petted on three different days: Berry is earned, celebrated next time the popup opens.
        if (earnedBerry(pettingDays) && !s.unlocked.includes('berry')) {
          patch.unlocked = [...s.unlocked, 'berry'];
          patch.newUnlock = 'berry';
        }
        await updateSettings(patch);
        sendResponse({ ok: true });
      });
      return true;
    case 'waterDone':
      getSettings().then(async (s) => {
        await updateSettings({ glasses: addGlass(s.glasses, new Date()) });
        sendResponse({ ok: true });
      });
      return true;
    case 'waterLater':
      scheduleWater(Date.now() + LATER_MIN * 60_000).then(() => sendResponse({ ok: true }));
      return true;
    case 'visitEnded':
      return false;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(async (details) => {
  await ensureScheduled();
  if (details.reason === 'install') {
    // Nudge first-time users toward the popup, where onboarding lives.
    await chrome.action.setBadgeBackgroundColor({ color: '#FF8A5B' });
    await chrome.action.setBadgeText({ text: 'hi' });
  }
});

chrome.runtime.onStartup.addListener(() => {
  void ensureScheduled();
});

onSettingsChanged((s, old) => {
  if (s.onboarded) void chrome.action.setBadgeText({ text: '' });
  // A new frequency should take effect now, not after the old alarm fires.
  if (s.frequency !== old.frequency) void scheduleNext();
  // New water times or switching reminders on/off: reschedule now.
  if (JSON.stringify(s.water) !== JSON.stringify(old.water)) void scheduleWater();
});
