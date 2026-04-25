# SuperLuckyKat — One Piece TCG No-Foil No-alt art Leader Tracker

**Live:** https://metaprinter.github.io/op-leader-tracker/

A personal collection tracker for non-foil, non-parallel One Piece TCG Leader cards. Built as a single-file static web app hosted on GitHub Pages, with collection data synced to Google Drive so your progress is available on any browser or device.

---

## What It Tracks

- **137 total Leader cards** across all English sets
- Booster sets OP-01 through OP-15
- Extra Boosters EB-01 through EB-04
- Premium Best PRB-01
- Starter Decks ST-01 through ST-29 (toggleable — excluded from counts by default)

For each card you own, you can record:
- **Quantity** owned
- **Condition** — NM, LP, MP, HP, D (multi-select)

---

## Features

- **Card images** served from Limitless TCG CDN
- **Dual-color stripes** on multi-color leader cards
- **Per-set progress bars** with owned/total count
- **Overall completion %** in the header stat badge
- **Starter Deck toggle** — Include or Exclude starters from all counts
- **Search** by card name or card ID
- **Tabs** — All / Owned / Missing
- **Google Drive sync** — collection saved to `op-leader-tracker.json` in your Drive, auto-saves on every change, auto-refreshes OAuth token to prevent session expiry
- **Export TSV** — download your full collection as a spreadsheet-compatible backup
- **Import TSV** — restore from a previously exported backup file

---

## Tech Stack

- Pure HTML + CSS + Vanilla JavaScript — no framework, no build step
- **Google Identity Services** (`accounts.google.com/gsi/client`) for OAuth 2.0
- **Google Drive REST API** via direct `fetch()` calls — no `gapi.js` dependency
- **Limitless TCG CDN** for card images
- `localStorage` for UI preferences (tab state, starter deck toggle)
- Single file: `index.html` — everything is self-contained including the logo

---

## Google Drive Sync Setup

The app requires a one-time OAuth setup to enable Drive sync. Collection data is saved to `SuperLuckyKat/op-leader-tracker.json` in your Google Drive.

### Prerequisites
- A Google account
- A Google Cloud project (free)

### Steps

**1. Create a Google Cloud project**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project named `op-leader-tracker`

**2. Enable the Google Drive API**
1. Go to **APIs & Services → Library**
2. Search "Google Drive API" and enable it

**3. Configure OAuth Consent Screen**
1. Go to **Google Auth Platform → Branding**
2. Set app name, support email, developer contact email
3. Go to **Audience** → set user type to External, add your Gmail as a test user
4. Go to **Data Access** → add scope `https://www.googleapis.com/auth/drive.file`

**4. Create OAuth Client ID**
1. Go to **Google Auth Platform → Clients → + Create Client**
2. Application type: **Web application**
3. Authorized JavaScript origins: `https://metaprinter.github.io`
4. Copy the generated Client ID

**5. Add Client ID to the HTML**
In `index.html`, find:
```js
const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID_HERE';
```
Replace with your actual Client ID.

---

## Deployment

1. Clone or fork this repo
2. Add your OAuth Client ID to `index.html` as described above
3. Rename `op-leader-tracker.html` to `index.html` if needed
4. Push to GitHub
5. Go to **Settings → Pages** → set source to main branch, root folder
6. Your tracker will be live at `https://yourusername.github.io/your-repo-name/`

---

## Data Format

Collection data is stored as a JSON object keyed by card ID:

```json
{
  "OP01-001": { "qty": 2, "conds": ["NM", "LP"] },
  "OP06-042": { "qty": 1, "conds": ["NM"] }
}
```

The TSV export format:
```
Card ID    Name               Color         Set    Qty    Conditions
OP01-001   Roronoa Zoro       Green         OP01   2      NM,LP
OP06-042   Vinsmoke Reiju     Blue/Purple   OP06   1      NM
```

---

## Card Data Sources

Card names, numbers, and color identities were sourced from:
- Official Bandai One Piece Card Game card lists
- Limitless TCG card database
- Community-verified set checklists

Card images are served from the **Limitless TCG CDN**:
```
https://limitlesstcg.nyc3.cdn.digitaloceanspaces.com/one-piece/{SET}/{CARD-ID}_EN.webp
```

---

## Known Limitations

- New sets must be manually added to the card data in `index.html`
- Starter deck card images may not be available on Limitless CDN for the most recent releases — card ID placeholder is shown as fallback
- OAuth tokens expire after 1 hour; the app silently refreshes them, but if a refresh fails the sync label becomes clickable to re-authenticate without losing data

---

## Built By

SuperLuckyKat — One Piece TCG player, collector, and eBay reseller based in New Jersey.

eBay store: [SuperLuckyKat](https://www.ebay.com/usr/superluckykat)
