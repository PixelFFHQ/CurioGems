# Changelog

## 1.1.1 — Popup readability fix

- Added clear spacing between popup item titles and secondary text.
- Long search queries now truncate with an ellipsis instead of forcing horizontal scrolling.
- Full title/query text remains available via the native hover tooltip.
- Prevented horizontal scrolling in the popup content area.
- Added repeatable Firefox packaging with Firefox-specific Manifest V3 metadata while keeping the same runtime code and permissions.

## 1.1.0 — CurioGems rebrand

- Renamed Writer Radar to **CurioGems**.
- Reworked visible UI language around saved "gems" instead of radar terminology.
- Replaced writer-specific first-run categories and examples with broader creator/maker/research examples.
- Added a gem-style brand mark and new extension icons.
- Backup filenames now use `curiogems-backup-YYYY-MM-DD.json`.
- Export metadata now identifies the app as CurioGems.
- Retained the legacy `writerRadarData` storage key so in-place upgrades preserve existing local data.
- Legacy Writer Radar JSON backups remain importable.
- Added public-facing privacy documentation.
- Permissions remain unchanged: `storage` only.

## 1.0.3 — Writer Radar

- Added Quick Add directly inside the toolbar popup.
- Added local-only pasted X profile URL parsing for Person entries.
- Kept the full dashboard for editing, ordering, category management, import/export, and settings.
- Permissions remained `storage` only.

## 1.0.2 — Writer Radar

- Added the local-only **Paste X profile URL** helper for Person entries.

## 1.0.1 — Writer Radar

- Fixed the popup rendering a literal `null` beside unpinned entries.
