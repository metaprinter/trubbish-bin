# Trubbish Bin

Personal tooling for One Piece TCG and Carddass collecting/reselling.

**Live:** https://metaprinter.github.io/trubbish-bin/

---

## Tools

| File | Description |
|---|---|
| `index.html` | Hub — links to all tools |
| `op-leader-tracker.html` | No-foil leader card inventory tracker (OP01–OP09+) |
| `op-carddass-tracker.html` | Era 1 Carddass set completion tracker (16 sets, 787 cards) |
| `op-carddass-research.html` | Carddass sold comp research dashboard |
| `flip-analyzer.html` | eBay sold comps analyzer — parses bookmarklet TSV exports |
| `op-carddass-purchases.html` | Purchase history log |
| `drive-auth.js` | Shared Google Drive auth/sync module (GIS token client) used by all trackers |

---

## Data

All persistent data lives in Google Drive (SuperLuckyKat folder, via OAuth).

| JSON File | Used By |
|---|---|
| `op-leader-tracker.json` | Leader tracker |
| `op-carddass-tracker.json` | Carddass tracker |
| `carddass-research.json` | Research dashboard |
| `flip-analyzer-history.json` | Flip analyzer history |

Card images hosted at `assets/cards/`. Fallback: `assets/cards/CarddassHB.jpeg`.

---

## Stack

Static HTML/CSS/JS. No build step. GitHub Pages only.

---

## License
MIT — see [LICENSE](LICENSE). Covers original code/UI only. Card images, character art, and trademarks (One Piece, Carddass, Bandai, Toei, etc.) are property of their respective owners and are not covered by this license.
