# SOTG World Cup 2026 Predictor — Phase 1

Predict every group-stage scoreline. **5 pts** for an exact score, **1 pt** for the
right result, **0** otherwise. Results auto-update from football-data.org and the
leaderboard recomputes itself.

Stack: **Next.js 14 (App Router) · TypeScript · Tailwind · Supabase (magic-link auth) · Vercel**
— same flow as the fitness tracker.

---

## What's in Phase 1
- Magic-link sign-in (no passwords)
- All 72 group fixtures imported from football-data.org
- Score predictor that **locks at kickoff** (enforced in the database, not just the UI)
- Auto-updating results via a cron route + GitHub Actions poller
- Self-healing leaderboard (a SQL view — never a stored total)
- Pages: `/predict`, `/fixtures`, `/leaderboard`, `/me`

Phase 2 (awards, SOTG specials, SOTG Xtra, post-tournament opinions) layers on top of
this without touching what's here.

---

## Quick start (in order)

### 1 — Open the project
```bash
cd ~
code sotg-world-cup-predictor   # or wherever you unzipped it
npm install
```

### 2 — Create a Supabase project
1. [supabase.com](https://supabase.com) → New project
2. **SQL Editor** → paste the entire contents of `supabase-schema.sql` → **Run**
3. **Project Settings → API** → copy your **Project URL**, **anon public key**, and
   **service_role key** (the service_role key is secret — server only)

### 3 — Get a football-data.org token (free)
1. Register at [football-data.org/client/register](https://www.football-data.org/client/register)
2. Copy the API token from the email / your account page
3. Free tier = 10 calls/min, which is plenty here (we make 1 call per refresh)

### 4 — Environment variables
```bash
cp .env.example .env.local
```
Fill in `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FOOTBALL_DATA_KEY=...
CRON_SECRET=<any long random string>
```

### 5 — Seed the fixtures
```bash
npm run seed
```
This imports all teams + fixtures. Re-runnable any time. If you get a 403 here, see
**Fallback** at the bottom.

### 6 — Run it
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) → enter your email → click the
magic link → you land on `/predict`.

---

## Deploy to Vercel

### 7 — Push to GitHub
```bash
git init
git add .
git commit -m "SOTG World Cup Predictor — Phase 1"
git branch -M main
git remote add origin https://github.com/theonlytjn/sotg-world-cup-predictor.git
git push -u origin main
```
Create the empty repo on GitHub first (don't tick any initialise options).

### 8 — Import on Vercel
[vercel.com](https://vercel.com) → New Project → import the repo → add **all five**
environment variables from `.env.local` → Deploy.

### 9 — Update Supabase redirect URLs (critical for magic links)
Supabase → **Authentication → URL Configuration**:
- **Site URL** = your Vercel URL
- **Redirect URLs** → add `https://your-app.vercel.app/**`

### 10 — Install on your phone
Open the Vercel URL in Safari → **Share → Add to Home Screen**.

---

## Keeping scores updated (read this)

The refresh endpoint is `GET /api/cron/results` — it pulls live scores, updates
fixtures, and recomputes everyone's points. It's protected by `CRON_SECRET`.

There are three ways to trigger it; you can use all three:

1. **Vercel Cron** — `vercel.json` already schedules a daily safety run. ⚠️ Vercel's
   **Hobby plan only allows once-a-day crons**, so this alone won't refresh mid-match.

2. **GitHub Actions (recommended, free, every 15 min)** — `.github/workflows/poll-results.yml`
   polls during matches. Add two repo secrets (**Settings → Secrets and variables → Actions**):
   - `APP_URL` = `https://your-app.vercel.app`
   - `CRON_SECRET` = the same value as in Vercel
   Disable the workflow outside tournament dates to save Action minutes.

3. **Manual** — hit it yourself any time:
   `https://your-app.vercel.app/api/cron/results?secret=YOUR_CRON_SECRET`

Because points are recomputed from results every run, the system is idempotent — if a
score is corrected, the next poll fixes everyone's points automatically.

---

## How scoring works
- Group games have no extra time, so football-data's full-time score **is** the 90' score.
- Exact score → 5, correct result (W/D/L matches) → 1, else 0. Logic lives in
  `lib/scoring.ts` (change it in one place).
- The leaderboard is the `leaderboard` SQL view summing `match_predictions.points`.

## Fairness / locking
- Predictions can only be inserted/updated **before kickoff** — enforced by RLS policies
  in `supabase-schema.sql`, so it can't be bypassed from the client.
- You can't see anyone else's pick for a game until that game has kicked off.

---

## Fallback: seeding without football-data.org
If the WC competition isn't available on your football-data plan, you can seed fixtures
from the free, no-key **openfootball/worldcup.json** dataset instead, and keep using the
cron only for live results once matches begin. Ask and I'll drop in `scripts/seed-openfootball.ts`
— it matches teams by name so the live updater still lines up.

---

## Phase 2 roadmap (not built yet)
- `award_categories` / `award_predictions` / `award_results` tables → `/predict/awards`
- SOTG specials (Team of the Tournament, Top Assists) and SOTG Xtra (best African/Asian/
  South American/North American nation) as configurable question rows
- Player import (squads) for Golden Boot / Glove / Ball / Young Player
- Post-tournament opinion poll, unlocked at the final
- `/admin` for entering award answers + a manual results override
