# Pebble

**A tiny round friend who drops by while you browse.**

Pip is a small animated pet that wanders onto the web pages you visit. It says hi, does its own
thing for a moment, and leaves long before it gets in the way. It's calm, not clingy: Pip has its
own personality and its own little life, and it never begs for attention.

[![Available in the Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Add%20to%20Chrome-4285F4?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/pebble/bmekdjofmbekpfcpicmibiokgkccdnbb)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Install

**Pebble is live on the Chrome Web Store:**
👉 **[Add Pebble to Chrome](https://chromewebstore.google.com/detail/pebble/bmekdjofmbekpfcpicmibiokgkccdnbb)**

It needs Chrome 116 or newer. It also works in other Chromium browsers that can install from the
Chrome Web Store, such as Brave, Edge and Opera.

> The store version can be a little behind this repository. To try the newest features, build it
> yourself (see [Development](#development)).

## Features

- **Visits:** now and then Pip shows up on the page you're reading, wanders around, and leaves on
  its own. You choose how often, from about once an hour up to eight times an hour.
- **A real personality:** every Pip gets its own traits when you install it, such as lazy or
  lively, plus a favorite spot on the screen. It grooms, naps, sniffs around, looks about, and
  sometimes plays with a ball before curling up.
- **Cat person or dog person:** pick one and Pip acts more like a cat (kneading, loafing, slow
  blinks, hunting your cursor) or more like a dog.
- **Petting and boops:** stroke Pip back and forth with your cursor to pet it, or click it for a
  boop (not too many). The more you pet it, the more relaxed it gets around you.
- **Characters:** besides Classic Pip there are three costumed characters, Vader, Spider and Bat.
  Each has its own entrances, exits and moves. They try very hard to look tough. It never quite
  works.
- **Water reminders (optional):** Pip, or your character, brings you a glass of water every 30 to
  120 minutes, only between the hours you set. Say you drank it, ask for "later", or ignore it and
  it leaves. Choose visits plus water, or water only.
- **Make it yours:** name your pet, then pick a color (Honey, Sage, Lilac, Butter, Sky), an
  accessory (hat, scarf, glasses) and a skin (Classic, Polka, Stripes, Cloud).
- **Unlockable skins:** **Starry** unlocks when you share a card of your Pip. **Berry** unlocks
  when you pet Pip on three different days.
- **Stays out of your way:** quiet mode, a one-hour snooze, "Say hi sometimes", and "Not on this
  site" for sites where you don't want it.
- **Private by design:** everything stays on your device. No accounts, no analytics, no server.

## Privacy

Pebble doesn't read, collect or send the content of the pages you visit, and it has no server.
It needs access to websites only so it can draw Pip on the page. It draws in its own isolated
layer (Shadow DOM) and never reads or changes the page itself. Uninstalling the extension deletes
everything it stored.

Full policy: [PRIVACY.md](PRIVACY.md), also published at https://privacypebble.netlify.app/

### Permissions

| Permission | Why |
|---|---|
| `storage` | Saves your pet, settings and unlocks on your device |
| `alarms` | Schedules visits and water reminders |
| `scripting` | Lets Pip visit tabs that were already open before you installed or updated Pebble |
| `http://*/*`, `https://*/*` | Lets Pip appear on the pages you browse |

## Development

You need [Node.js](https://nodejs.org/) 20 or newer.

```sh
git clone <this repo>
cd <repo folder>
npm install
npm run dev        # builds dist/ and rebuilds when files change
```

Load the extension in Chrome:

1. Open `chrome://extensions`.
2. Turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the `dist/` folder.

After you change the code, click the reload icon on the extension's card, then refresh the page
you're testing on.

To see a visit right away, open any website, open the Pebble popup, and click the pet's face in
the header ("Call Pip over").

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Builds `dist/` and rebuilds on changes |
| `npm run build` | One-time build into `dist/` |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript type check |
| `npm run e2e` | Loads the extension in Playwright's Chromium, walks the popup and visits, and saves screenshots to `e2e-shots/` |
| `npm run zip` | Builds and packs `pebble-<version>.zip` for the Chrome Web Store |
| `npm run site` | Builds the landing page into `site/` and the privacy page into `privacy-site/` |

### Project layout

```
src/
  shared/       pet drawing, costumes, catalog (colors, skins, characters), behavior,
                personality, lines, schedule, water, storage, messages, config
  background/   service worker: visit and water scheduling (chrome.alarms), message routing
  content/      on-page stage (Shadow DOM), visits, character moves, petting, ball play,
                water visits
  popup/        onboarding, settings, characters, skins, unlock screens, share card
static/         manifest.json, popup.html, popup.css
tests/          Vitest unit tests
scripts/        build, e2e, motion preview, zip, website build
site-src/       landing page and privacy page templates
```

It's plain TypeScript with no UI framework, bundled by esbuild. Pip is drawn as SVG, and the
website uses the same drawing code as the extension.

### Website

`npm run site` builds the landing page and the privacy policy from `site-src/`, drawing Pip with
the extension's own pet code. It writes `pebble-site.zip` and `pebble-privacy-site.zip`, which you
can deploy to any static host (the live sites run on Netlify). The store link, privacy URL and
contact address live in `src/shared/config.ts`.

### Releasing

1. Bump `version` in `static/manifest.json` and `package.json`.
2. Run `npm test`, `npm run typecheck` and `npm run e2e`.
3. Run `npm run zip` and upload `pebble-<version>.zip` in the
   [Chrome Web Store developer dashboard](https://chrome.google.com/webstore/devconsole).

## Contributing

Issues and pull requests are welcome. Before you open a PR:

- run `npm test` and `npm run typecheck` and make sure both pass;
- if you changed how Pip moves or looks, run `npm run e2e` and check the screenshots;
- keep Pip's spirit: calm, small and polite. It visits; it doesn't demand anything.

## Support

If Pip makes your day a little nicer, you can
[buy me a coffee](https://www.buymeacoffee.com/amirmoqaddasi) ☕

Questions or feedback: thepebble@proton.me

## License

[MIT](LICENSE) © 2026 Amirhosein Moqaddasi
