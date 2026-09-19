# CurioGems Privacy

**Effective: September 19, 2026**

CurioGems is designed to work locally and manually.

## Data collection

CurioGems does not collect or transmit your saved hashtags, searches, people, notes, categories, usage history, or settings to PixelFF or to any analytics service.

There is no account system, analytics, telemetry, advertising SDK, remote database, or cloud sync built into the extension.

## Local storage

Your CurioGems data is stored in the browser using `chrome.storage.local`.

A JSON backup leaves the browser only when **you explicitly choose Export JSON**. Import happens only when you explicitly select a JSON file.

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

The optional **Paste X profile URL** helper processes the text you paste locally to extract a handle. It does not fetch the URL, and the pasted URL is not stored.

## Permissions

CurioGems requests only the Chromium `storage` permission.

It does not request host permissions, `tabs`, `activeTab`, `scripting`, browsing history, cookies, or access to all websites.

## Publisher

CurioGems is a PixelFF project.
