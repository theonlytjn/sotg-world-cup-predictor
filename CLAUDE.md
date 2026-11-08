# CLAUDE.md — SOTG World Cup 2026 Predictor

Project context for Claude Code. Read this before making changes.

## What this is
A World Cup 2026 score-prediction game for a group of friends. Phase 1 (group-stage
match predictor + leaderboard) is already built and type-checks clean. You are
extending it, not rebuilding it.

## Stack & conventions
- **Next.js 14 App Router + TypeScript** (strict mode — no implicit `any`)
- **Tailwind** with custom tokens in `tailwind.config.ts` (pitch/lime/chalk/flame).
  Reuse these; don't introduce new colour systems.
- **Supabase** for auth (magic link) + Postgres + RLS. Clients live in `lib/supabase/`:
  `client.ts` (browser), `server.ts` (RSC/route handlers), `admin.ts` (service-role,
  SERVER ONLY — never import into client code).
- **Fonts:** Anton (display), Hanken Grotesk (body), IBM Plex Mono (numbers) via next/font.
- Deployed on **Vercel**; pushed via **GitHub**.

## Hard rules (do not break)
1. **Never commit secrets.** All keys go in `.env.local` (gitignored). The service-role
   key and `CRON_SECRET` are server-only and must never reach the browser bundle or git.
2. **Prediction locking is enforced in the database**, not just the UI — see the RLS
   policies in `supabase-schema.sql`. Keep it that way. Any new prediction type must
   lock at its deadline via an equivalent policy.
3. **The leaderboard is a SQL view** that recomputes from results. Never store running
   totals on a row.
4. Scoring logic lives ONLY in `lib/scoring.ts`. Group games: exact score = 5,
   correct result = 1, else 0.

## Commands
- `npm run dev` — local dev
- `npm run build` — production build (must pass before any commit)
- `npm run seed` — import teams + fixtures from football-data.org

## Results pipeline
- `scripts/seed.ts` seeds fixtures by football-data.org `external_id`.
- `GET /api/cron/results` refreshes scores + recomputes points (idempotent). Protected
  by `CRON_SECRET`. Polled every 15 min by `.github/workflows/poll-results.yml` (because
  Vercel Hobby cron only runs daily).

## Phase 2 roadmap (build in this order, one slice at a time)
1. **Awards** — tables `award_categories`, `award_predictions`, `award_results`; page
   `/predict/awards`. Two choices per category with the point splits from the brief
   (Winner 35/30, Runners-up 25/20, Player of Tournament 18/15, Top Scorer 13/10,
   confederation "furthest" 5/3).
2. **Player import** — squads for Golden Boot/Glove/Ball/Young Player pickers.
3. **SOTG specials** (Team of the Tournament, Top Assists) + **SOTG Xtra** (best African/
   Asian/South American/North American/European nation) as configurable question rows.
4. **`/admin`** — set award/special answers + manual results override.
5. **Post-tournament opinion poll** (best/worst team & player), unlocked at the final.

Always: extend the schema additively (new tables/policies), run `npm run build`, then a
small focused commit per slice. Update the `leaderboard` view to sum new point sources.

## Site structure (Nov 2026)
- `/` — hub / game selector (`app/page.tsx`). Add new games to the `GAMES` array.
- `/wc` — the World Cup 2026 game (moved from the root; `app/wc/**`). Old root paths
  (`/predict`, `/leagues/...`, etc.) redirect via `next.config.js`. `/auth/callback` and `/api/*`
  stay at the root so Supabase auth redirect URLs and the results cron are unchanged.
- `/pl` — Premier League season predictor. Static app in `public/pl` (no build step), config from
  `app/pl/config.js/route.ts`. Data in `pred_seasons` / `pred_entries` via `pred_*` RPCs
  (`supabase-predictors-schema.sql` + migrations `002-close-time`, `003-ucl`), keyed by competition + season. Seasons auto-close at `closes_at` (set on the admin page). Yearly reset = admin page
  (`/pl#admin`) → "Start new season"; update `public/pl/data.js` (teams/players/cup lists) too.
- `/ucl` — Champions League predictor, same engine: shared app in `public/predictor/` (question sets per comp in `app.js`), page in `public/ucl`, squads from football-data via `app/ucl/players.js/route.ts`. Seasons can have `opens_at` (voting not open yet) and `closes_at`.
