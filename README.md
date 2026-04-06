# IRON 300

A single-file PWA for tracking a bench-press-focused strength and hypertrophy program, with an integrated legs tracker. Built around one goal: hitting a 300 lb bench press.

---

## What it is

IRON 300 is a self-contained `index.html` that runs as a progressive web app. No server, no account, no subscription. Data lives in `localStorage` and optionally syncs to a private GitHub repo you own. Install it to your phone's home screen and it behaves like a native app.

---

## Program Design

The core program is a 4-day upper-body rotation (3-day and 5-day variants also available):

| Day | Focus | Key Work |
|-----|-------|----------|
| Day 1 | Heavy Bench | Top single at TM · 4 back-off sets at 85% TM |
| Day 2 | Volume Bench | 4×6 at ~74% TM |
| Day 3 | OHP | 4×5 → 4×8 overhead press |
| Day 4 | Paused Bench | 5×4 at 75% TM, 2-second pause |

**Training Max (TM)** auto-adjusts after every heavy single based on RPE:

- RPE ≤7 → +5 lbs
- RPE 8 → +2.5 lbs
- RPE 8.5–9 → hold
- RPE 10 → −2.5 lbs
- Miss the single twice in a row → TM drops 10% and rebuilds

**Deload** triggers automatically every 5th week (weights drop to 60–70%).

**Assistance** runs on double progression: hit the top of the rep range across all sets → weight goes up next session. Weekly volume targets:

- Back: 16 sets
- Shoulders: 16 sets
- Biceps: 16 sets
- Triceps: 12–16 sets
- Chest (accessory): Hammer Strength Incline 3×10–12 + Pec Deck 3×12–15

---

## Legs Tab

Hack Squat and Lying Leg Curl tracked inside the same app. Weekly volume (sessions, squat sets, curl sets) is visible on the Legs tab so systemic fatigue isn't invisible.

- **Hack Squat** — 5×5, RPE-based. ≤8 → add weight, 8.5–9 → hold, 10 → drop.
- **Lying Leg Curl** — 3×8–12. Hit 12 on all 3 sets → move up. Any set under 8 → drop.

Leg data is stored in a separate `legs_data` localStorage key and syncs to `legs_data.json` in the same GitHub repo using the same credentials as the main app.

---

## Features

- **Today tab** — readiness check (Fresh / Normal / Beat Up), day selector, full workout with warmups, set logging, per-set effort ratings, session notes
- **Beat Up mode** — drops bench TM, OHP, and all assistance weights 5% for that session only; no deload triggered
- **300 lb dashboard** — implied 1RM from every heavy single plotted as SVG trendline with projected date to goal; visible in Today, Progress tab, and the app header
- **Consistency tracking** — current week streak and 12-week attendance card in the Progress tab
- **Schedule tab** — calendar view of upcoming training days
- **Program tab** — full program reference with all weights calculated
- **Graphs tab** — Training Max history chart
- **History tab** — every logged session with sets, weights, RPE
- **Plates tab** — plate calculator
- **Legs tab** — integrated Hack Squat and Leg Curl tracker (see above)
- **Settings tab** — profile, program variant, assistance weight editor, legs equipment, GitHub sync

---

## GitHub Sync

Data syncs to a private GitHub repo as JSON files:

- `iron300_data.json` — all upper-body workout data
- `legs_data.json` — legs workout data

Setup in Settings → GitHub Sync. You need a GitHub personal access token (classic) with `repo` scope.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | The entire app — styles, HTML, JavaScript in one file |
| `legs.html` | Legacy standalone legs PWA (superseded by the Legs tab in `index.html`) |
| `manifest.json` | PWA manifest for `index.html` |
| `legs-manifest.json` | PWA manifest for `legs.html` |
| `test.js` | Node.js test suite (run with `node test.js`) |
| `icon-180.png` / `icon-512.png` | App icons |

---

## Running Tests

```bash
node test.js
```

386 tests covering: progression math, deload calculations, RPE → 1RM table, assistance exercise resolution per day and variant, consistency/streak logic, linear regression, implied 1RM history, and goal date projection.

Run this before every commit.

---

## Installing as a PWA

On iPhone: open `index.html` in Safari → Share → Add to Home Screen.
On Android: open in Chrome → three-dot menu → Add to Home Screen.

The app works offline once loaded (no service worker — just bookmark/install from a GitHub Pages or local server URL).

---

## Version History

| Version | What changed |
|---------|-------------|
| v3.0 | Legs tab integrated into main app; weekly volume strip; GitHub sync via main app credentials |
| v2.9 | Pre-session readiness check (Fresh/Normal/Beat Up); Beat Up drops weights 5% session-only |
| v2.8 | 300 lb progress dashboard — implied 1RM trendline, projected date to goal, header ETA stat |
| v2.7 | Consistency tracking — week streak + 12-week attendance card in Progress tab |
| v2.6 | Pec Deck (3×12–15) added to Day 4; Hammer Strength Incline restored to Day 2; test suite (386 tests) |
| v2.x | Auto-regulation, double progression, deload, fail streak, session notes, GitHub sync, plate calculator |
