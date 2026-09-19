# CurioGems

**Keep the gems worth revisiting.**

CurioGems is a private, local-first Chromium browser extension for organizing X hashtags, reusable searches, and people you choose to save.

It is intentionally **not** an X client. CurioGems does not read X, inspect pages, scrape posts, monitor your timeline, access followers, log into your account, or use the X API. X is only the destination for ordinary links that you explicitly open.

CurioGems is built by **PixelFF**.

## What it does

- Compact toolbar popup for finding and launching saved gems
- Quick Add directly from the popup
- Full dashboard for adding, editing, deleting, moving, pinning, and reordering entries
- Saved hashtags that open X's Latest search view
- Saved X search queries that open X's Latest search view
- Saved people that open their normal `x.com/<handle>` profile URL
- Optional **Paste X profile URL** helper that extracts a handle locally
- Editable categories with icon, color, ordering, and collapse state
- Local search across saved entries, categories, and notes
- Pinned and Recent views
- Quick-copy buttons for hashtags, search queries, and handles
- Choice to open X links in a new tab or the current tab
- JSON backup export
- Validated JSON import with separate Merge and Replace choices
- Duplicate detection when adding entries or merging backups
- Keyboard shortcuts in the dashboard: `/` focuses search and `A` opens Add when you are not typing

## Privacy by design

CurioGems requests exactly one extension permission:

```json
"permissions": ["storage"]
```

It does **not** request:

- `tabs`
- `activeTab`
- `scripting`
- browsing history
- cookies
- host permissions
- access to `x.com`
- access to all websites

All saved data lives in `chrome.storage.local`. CurioGems contains no analytics, telemetry, cloud sync, account system, OAuth, remote database, or remote code.

The extension only opens normal official X URLs after you click something. It does not read the page that opens.

See [PRIVACY.md](PRIVACY.md) for the full privacy summary.

## Install unpacked in Opera GX / Chromium

There is no build step.

1. Extract `CurioGems_v1.1.0.zip` somewhere you will keep it.
2. Open your browser's extensions page.
   - Opera GX: `opera:extensions`
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
3. Enable **Developer mode**.
4. Choose **Load unpacked**.
5. Select the `CurioGems_v1.1.0` folder that directly contains `manifest.json`.
6. Pin CurioGems to the toolbar if you want quick access.
7. Click the CurioGems icon to open the compact popup.
8. Use the ↗ button for the full dashboard.

Because this is an unpacked extension, the browser loads it from that folder. Do not delete the folder after installation.

## Upgrading from Writer Radar

CurioGems v1.1.0 is the renamed successor to Writer Radar v1.0.3.

If you update the files **in place** for the same installed unpacked extension, CurioGems deliberately keeps the legacy internal storage key so your existing local data is preserved.

If you load CurioGems from a **different folder** and the browser treats it as a separate unpacked extension, browser-local storage may not carry over automatically. In that case:

1. Open Writer Radar.
2. Export a JSON backup.
3. Load CurioGems.
4. Import the backup into CurioGems.

Legacy Writer Radar backup files remain importable.

## Using CurioGems

### Add a gem

Use **+ Add** in the popup or **+ Add gem** in the dashboard. Choose Hashtag, Search, or Person, select a category, optionally pin it, add a note if useful, and save.

For a Person, you can type the handle manually or paste a normal profile URL such as `https://x.com/SomeCreator` and click **Use URL**. CurioGems parses that text locally. It does not visit, inspect, scrape, or fetch the profile, and the pasted URL is not stored.

### Open a gem on X

- Hashtag: `#IndieDev` → X Latest search
- Search: `"creative tools"` → X Latest search
- Person: `@SomeCreator` → normal X profile URL

CurioGems does not read the resulting X page.

### Search your saved gems

The search boxes only search CurioGems' own locally stored data: entry names and values, notes, types, handles, and category names.

### Organize

The dashboard supports:

- category creation, rename, recolor, reorder, and delete
- entry reorder inside a category
- moving entries between categories
- Pinned and Recent views
- local notes

Deleting a category does not silently destroy its entries. CurioGems moves them into another existing category after confirmation. At least one category must remain.

## Backup and restore

Open **Settings** in the dashboard.

### Export

CurioGems creates a readable backup named like:

`curiogems-backup-2026-09-19.json`

### Import

CurioGems parses and validates a backup before it can change your data. You can then choose:

- **Merge safely** to keep existing data and add non-duplicates
- **Replace existing** to replace the current dataset after an additional confirmation

Malformed JSON, unsupported schemas, invalid item types, missing category references, invalid hashtags or handles, duplicate IDs, and other structural problems are rejected.

## New-install starter data

On a brand-new install with no existing CurioGems / Writer Radar data, CurioGems creates three starter categories:

- Community
- Research
- People

It includes a small cross-section of example hashtags and searches. It does not preload any real people/accounts.

Existing valid local data is never replaced by the starter set.

## Project structure

```text
CurioGems_v1.1.0/
├─ manifest.json
├─ popup.html
├─ popup.css
├─ popup.js
├─ dashboard.html
├─ dashboard.css
├─ dashboard.js
├─ styles.css
├─ data.js
├─ ui.js
├─ package.json
├─ README.md
├─ PRIVACY.md
├─ CHANGELOG.md
├─ LICENSE
├─ COPYRIGHT.md
├─ icons/
│  ├─ icon16.png
│  ├─ icon32.png
│  ├─ icon48.png
│  └─ icon128.png
└─ tests/
   └─ run-tests.mjs
```

There is no framework, external CDN, build pipeline, content script, background service worker, or remote dependency.

## Browser compatibility

CurioGems is built first for current Chromium-based desktop browsers. The same Chromium package is intended for Opera GX / Opera, Google Chrome, Microsoft Edge, Brave, Vivaldi, and other current Chromium browsers that support Manifest V3 extensions.

Firefox implements the WebExtensions APIs CurioGems relies on, but publishing a Manifest V3 build through Firefox Add-ons requires Firefox-specific manifest metadata. Safari also requires conversion and packaging as a Safari Web Extension. Those browser-store packages are not part of this Chromium release.

## Developer test

With Node.js installed:

```text
npm test
```

The tests cover starter-data validation, first-run storage behavior, URL encoding, X profile URL parsing, legacy backup compatibility, malformed import rejection, export/import round-tripping, duplicate-safe merging, tab-opening behavior, entry reordering, popup Quick Add integration, manifest permissions, and referenced assets.

## Version 1 boundary

CurioGems intentionally does not include content scripts, X host permissions, DOM monitoring, automatic detection, background searches, unofficial X endpoints, OAuth, or X API calls. Those capabilities would require a fresh technical, privacy, and policy review rather than being quietly bolted onto the extension.

## License

CurioGems is open-source software licensed under the **Mozilla Public License 2.0 (MPL-2.0)**.

Copyright © 2026 **PixelFF (Pixel Forge Foundry)**.

You may use, study, modify, and redistribute CurioGems under the terms of the MPL-2.0. Modified MPL-covered source files that are distributed must remain available under the MPL-2.0.

See [LICENSE](LICENSE) for the complete license text and [COPYRIGHT.md](COPYRIGHT.md) for the project copyright notice.
