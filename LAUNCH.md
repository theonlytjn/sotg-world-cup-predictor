# LAUNCH — Go-live runbook

Priority: the group stage is underway, so get the **match predictor live first**.
Awards/specials lock later and can follow this week. Steps marked **[browser]** you do
in a dashboard; **[Claude Code]** you paste as a prompt.

---

## 1. Supabase — [browser] ~5 min
1. supabase.com → **New project** (pick a region near you; UK → London/eu-west-2).
2. **SQL Editor** → paste all of `supabase-schema.sql` → **Run**. (This is the fastest
   route; you can wire the Supabase MCP later for ongoing schema changes.)
3. **Settings → API** → copy your **Project URL**, **anon public key**, and
   **service_role key**.

## 2. football-data.org — [browser] ~2 min
Register at football-data.org/client/register → confirm email → copy the API token.

## 3. Env + seed — [Claude Code]
First paste your keys into `.env.local` (values go in the FILE, never into chat). Then:

> In `scripts/seed.ts`, make dotenv load from `.env.local` instead of the default `.env`
> — i.e. replace `import 'dotenv/config'` with
> `import { config } from 'dotenv'; config({ path: '.env.local' });`.
> Create `.env.local` from `.env.example` if it doesn't exist. I'll fill the values, then
> on my go run `npm run seed` and report how many teams and fixtures imported.
> If football-data returns 403, switch to the openfootball fallback from the README.

## 4. Local smoke test — [Claude Code + browser]
> Run `npm run dev`.

Open http://localhost:3000 → enter your email → click the magic link → make a test pick
on a **future** game → confirm it shows on `/me` and your name appears on `/leaderboard`.

## 5. Push to GitHub — [Claude Code]
> Commit everything and push to GitHub (create the repo if needed). Confirm `.env.local`
> is gitignored and was NOT committed.

## 6. Deploy to Vercel — [browser]
1. vercel.com → **Add New → Project** → import the repo.
2. Add all 5 env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `FOOTBALL_DATA_KEY`, `CRON_SECRET` → **Deploy**.
3. Copy your live URL.

## 7. Make magic links work — [browser, Supabase]
**Authentication → URL Configuration:**
- **Site URL** = your Vercel URL
- **Redirect URLs** → add `https://your-app.vercel.app/**`

## 8. Turn on results polling — [browser, GitHub]
Repo → **Settings → Secrets and variables → Actions** → add:
- `APP_URL` = `https://your-app.vercel.app`
- `CRON_SECRET` = the same value you set in Vercel

Then the **Actions** tab → enable **"Poll World Cup results"**.
Test it once: open `https://your-app.vercel.app/api/cron/results?secret=YOUR_CRON_SECRET`
— you should get JSON back with `fixtures_updated`.

## 9. Go live
Share the Vercel link with your mates. They sign in, picks lock at each kickoff, scores
auto-update, table moves. **Phase 1 done.**

---

## Phase 2 — hand to Claude Code one slice at a time (after it's live)
After each: open the Vercel preview, eyeball it, then push.

1. > Build Phase 2 slice 1 (awards) per CLAUDE.md: schema first
  (`award_categories` / `award_predictions` / `award_results`), then `/predict/awards`
  with two picks per category and the brief's point splits (Winner 35/30, Runners-up
  25/20, Player of Tournament 18/15, Top Scorer 13/10, confederation "furthest" 5/3).
  Update the `leaderboard` view to add award points. Run `npm run build`, then commit.

2. > Slice 2: import squads (players per team) so Golden Boot/Glove/Ball and Young Player
  have real pickers. Goalkeepers flagged for the Glove.

3. > Slice 3: SOTG specials (Team of the Tournament, Top Assists) and SOTG Xtra
  (best African/Asian/South American/North American/European nation) as configurable
  question rows + their pages.

4. > Slice 4: `/admin` page to set award/special correct answers and a manual results
  override, restricted to my user id.

5. > Slice 5: post-tournament opinion poll (best/worst team & player), unlocked at the final.
