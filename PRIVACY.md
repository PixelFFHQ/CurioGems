# CurioGems Privacy

**Effective: September 19, 2026**

CurioGems is designed to work locally and manually.

## Data collection and local data

CurioGems does not transmit your saved data to PixelFF, analytics services, advertising networks, or other third parties.

CurioGems stores information that you manually provide, which can include:

- X usernames / handles
- hashtags
- saved searches
- categories
- notes
- pinned status
- extension settings

CurioGems also stores limited local usage metadata needed for its own features, such as:

- how many times a saved gem has been opened
- the last time a saved gem was opened

This data remains in your browser using the browser extension's local storage (`storage.local`).

There is no account system, analytics, telemetry, advertising SDK, remote database, or cloud sync built into the extension.

## Backup and restore

A JSON backup leaves the browser only when **you explicitly choose Export JSON**. Import happens only when you explicitly select a JSON file.

Exported backups can contain the saved information listed above, including X handles, searches, categories, notes, and local usage metadata. You control where exported backup files are stored and whether they are shared.

## X / Twitter

CurioGems does not:

- read X pages
- inspect the X DOM
- scrape posts
- monitor timelines
- read followers or following lists
- detect hashtags or usernames from pages
- like, repost, follow, or post automatically
- use X OAuth
- use the X API
- ask for your X username or password

When you click a saved hashtag, search, or person, CurioGems opens a normal official `x.com` URL. The extension does not read the resulting page.

The optional **Paste X profile URL** helper processes the text you paste locally to extract a handle. It does not fetch the URL, and the pasted URL itself is not stored.

## Permissions

CurioGems requests only the browser extension `storage` permission.

It does not request host permissions, `tabs`, `activeTab`, `scripting`, browsing history, cookies, or access to all websites.

## Data sales and unrelated use

CurioGems does not sell user data.

CurioGems does not use or transfer user data for purposes unrelated to the extension's single purpose, and it does not use user data to determine creditworthiness or for lending purposes.

## Publisher

CurioGems is a PixelFF project.
