# 🏋️ IRON 300 — Bench Press & Hypertrophy Tracker

A personal, self-contained workout tracking app built to get you to a **300 lb bench press** while simultaneously building muscle in your back, shoulders, biceps, and triceps.

No account required. No subscription. No internet needed after the first load. Everything runs in your browser and saves locally on your device.

---

## 🎯 Goals

- Hit a **300 lb bench press 1RM**
- Build **16 sets/week** of hypertrophy volume across back, shoulders, biceps, and triceps
- Automate all weight progressions so you never have to think about what to do next

---

## 📋 The Program

### Bench Press Structure (4-Day Powerbuild)

| Day | Focus | What You Do |
|-----|-------|-------------|
| **Day 1 — Weekend** | Heavy Bench | Top single @ RPE 7.5–8 + 4×5 back-offs at 83% |
| **Day 2 — Monday** | OHP | Overhead Press 4×5, progressing to 4×8 before adding weight |
| **Day 3 — Wednesday** | Volume Bench | 4×6 at ~74% of training max |
| **Day 4 — Thursday** | Speed Bench | 8×3 at 65%, 60–90s rest — every rep explosive |

The bench single climbs **+2.5 lbs every week**. Every 4th week is an automatic deload at 60–70%.

### Hypertrophy Accessory Work

Each training day includes one exercise per muscle group at **4 sets each**, totaling **16 sets/week** per muscle — the scientifically established sweet spot for hypertrophy.

| Day | Back | Shoulders | Biceps | Triceps | Chest |
|-----|------|-----------|--------|---------|-------|
| Day 1 | Seated Chest-Supported Row | Rear Delt Fly | EZ Bar Curl | Skull Crusher | Hammer Strength Incline |
| Day 2 | Lat Pulldown | Lateral Raise | Dumbbell Curl | Tricep Pushdown | — |
| Day 3 | Seated Cable Row | Face Pull | Hammer Curl | Overhead Tricep Ext | Cable Fly |
| Day 4 | Dumbbell Row | Lateral Raise | Incline DB Curl | JM Press | — |

---

## 🤖 How Progression Works

### Bench / OHP
- Training max increases **+2.5 lbs per completed week**
- OHP progresses from 4×5 → 4×8, then **+5 lbs and reset** to 4×5
- **Deload automatically** every 4th week (weights drop to 60–70%)

### Assistance Exercises
Each exercise is classified by type, which determines how it responds to failure and success:

| Type | Examples | On Success | On Failure |
|------|----------|-----------|------------|
| **Strength** | Seated Row, JM Press | +5 lbs when top of range hit | Drop 10%, reset reps |
| **Hypertrophy** | Curls, Skull Crusher, Pulldowns | +weight when top of range hit | Hold weight, drop to bottom of rep range, add 1 rep/week |
| **Pump** | Laterals, Face Pulls, Flies | +weight when top of range hit | Hold weight, slow the eccentric, focus on form |

> **Important:** Only sets explicitly tagged as **DONE** count toward progression. Sets left as **—** or tagged **SKIP** hold the weight and reps exactly where they are — no penalty, no reward.

---

## ⚠️ Failure Protocols

When you mark a set as **FAIL**, the app immediately calculates your next session's targets and shows you a failure guidance card with exact instructions — no guesswork.

**Bench Press:**
- Fail the heavy single twice in a row → training max drops 10% and rebuilds
- Volume and speed days don't affect the failure counter

**All other exercises:**
- Failure guidance is shown automatically after you log the workout
- Each exercise shows its movement type (strength / hypertrophy / pump) so you know what to expect

---

## 📱 Running as a Web App (GitHub Pages)

This app is a single HTML file and runs entirely in the browser. To host it for free on your phone:

1. Upload `index.html` to a GitHub repository
2. Enable **GitHub Pages** under Settings → Pages → Deploy from branch (main)
3. Your app will be live at `https://yourusername.github.io/your-repo-name`

**Add to iPhone home screen:**
- Open in Safari → Share → Add to Home Screen

**Add to Android home screen:**
- Open in Chrome → three dots → Add to Home Screen

---

## 💾 Data & Storage

All workout data is stored in your **browser's localStorage** — nothing is sent to any server.

| What | Details |
|------|---------|
| Storage | Browser localStorage (no account, no server) |
| Persistence | Survives app closes and phone restarts |
| Risk | Clearing browser data will erase logs |
| Backup | Use **Export CSV** in the History tab regularly |
| Sync | Data does not sync between devices |

> **Tip:** Export your CSV every few weeks from the History tab as a backup.

---

## ⚙️ Setup

On first launch, go to **Settings** and enter:

- Your current estimated bench 1RM (or use the pre-calculated value from your last known lift)
- Your goal (default: 300 lbs)
- OHP starting weight
- Days per week (3, 4, or 5)
- Bar weight and smallest plate available

Hit **Save & Generate Program** — your first workout appears immediately.

---

## 🗂️ Files

```
index.html    — The entire app (rename from iron300_workout_app.html before uploading)
README.md     — This file
```

---

## 📊 Pages

| Page | What It Does |
|------|-------------|
| **Today** | Shows your current workout with all target weights, warmups, and set logging |
| **Program** | Full 4-week block view with all bench weights, plus weekly volume summary per muscle |
| **Progress** | 1RM history chart, projected timeline to 300, total stats |
| **History** | Every logged workout with set-by-set detail and CSV export |
| **Settings** | Configure training max, OHP weight, equipment, and days per week |

---

## 🏆 Credits

Built for one goal: **300 lbs**. Program methodology based on a 4-day powerbuild approach combining weekly heavy singles (RPE-based), volume work, and speed/dynamic effort — adapted from a proven personal training template.
