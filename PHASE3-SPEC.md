# PHASE 3 — Platform polish

Work through these **in order**, one prompt per Claude Code turn. After each: run
`npm run build`, eyeball the result, commit. Don't batch them into one prompt.

---

## Before you start — gather these
- **Fonts:** Rubik (headers) + **Manrope** (body). Both on Google Fonts — nothing to download.
- **Hugeicons Pro:** your **Universal License Key** from your Hugeicons account, and the
  exact private-registry `.npmrc` lines from hugeicons.com/docs → "Pro with React".
- **Figma style guide:** a screenshot of the style-guide frame (drag it into the Claude
  Code terminal so it can read it), or the raw values as text — colours (hex), type scale,
  spacing, border radii.

---

## Step 1 — Auth: password + magic link
> Add email+password login alongside the existing magic link. On the login page offer
> both: a "Send magic link" button and email+password fields, plus a sign-up path that
> sets a password. Use Supabase `signUp` / `signInWithPassword`, keep `signInWithOtp` for
> the magic link, and keep the existing `/auth/callback` and middleware session flow
> intact. Run `npm run build`.

**You also do:** Supabase → Authentication → Providers → Email is on by default. While
testing you can turn **off "Confirm email"** so logins don't depend on email delivery
(your magic-link issues are almost certainly Supabase's default email rate limits/spam —
passwords sidestep that). Add real SMTP later for production email.

## Step 2 — Single admin + forced nicknames
> Treat the user whose email is `tony@theonlytjn.com` as the only admin. Add:
> 1. A SQL function `is_admin()` returning `auth.jwt() ->> 'email' = 'tony@theonlytjn.com'`,
>    used in RLS for all admin-only writes.
> 2. A server-side guard so only that email can open `/admin`.
> 3. Onboarding: after first login, if a user hasn't set a nickname, send them to a
>    one-time "Choose your nickname" screen before they can use the app. The nickname is
>    their leaderboard `display_name`, must be unique, and is required.
> Run `npm run build`.

## Step 3 — Database-driven scoring + Rules page
Live match results stay as pulled from the API — this step makes the **points values**
editable, not the results.
> Create a `scoring_rules` table: rows keyed by a string `key` (e.g. `match_exact`,
> `match_result`, and later the award keys) with an editable integer `points` and a
> human-readable `label` + `description`. Seed it with the current values
> (match_exact = 5, match_result = 1). Refactor `lib/scoring.ts` and the cron route to
> read these values from the table instead of hardcoded constants. Build a `/rules` page
> that reads the same table and explains every question type and its points in plain
> language, so it always matches live scoring. Add an admin section in `/admin` (guarded
> by `is_admin()`) to edit the point values. Run `npm run build`.

## Step 4 — Design system foundation
This is the big visual pass. Drag your Figma style-guide screenshot into the terminal first.
> Restyle the foundation:
> 1. **Fonts:** Rubik for headings, Manrope for body — both via `next/font/google`,
>    wired through CSS variables in the Tailwind config (replace the current
>    Anton/Hanken/IBM Plex setup).
> 2. **Icons: Hugeicons Pro.** Use the CURRENT packages — renderer `@hugeicons/react`
>    plus pack `@hugeicons-pro/core-stroke-rounded`. Do NOT use the deprecated
>    `hugeicons-react` package or import icons from it. Render with
>    `<HugeiconsIcon icon={SomeIcon} size={24} color="currentColor" strokeWidth={1.5} />`.
>    I've added the private-registry `.npmrc` (token via `${HUGEICONS_TOKEN}` env var).
>    Replace the emoji/placeholder icons across the app with Hugeicons equivalents.
> 3. **Layout:** centre the app at a max width of 1920px on large screens, fully
>    responsive and mobile-first with Tailwind.
> 4. **AOS** (animate-on-scroll): add `aos`, initialise it in a client component mounted
>    in the root layout, and apply tasteful scroll reveals.
> 5. Apply these design tokens from my Figma style guide: [paste or reference the
>    screenshot — colours, type scale, spacing, radii].
> Run `npm run build`.

**You also do (Hugeicons auth):**
- Create `.npmrc` in the project root with the two lines from the Hugeicons Pro docs,
  but reference the key as an env var so it's never committed, e.g.:
  ```
  @hugeicons-pro:registry=https://<registry-host-from-hugeicons-docs>
  //<same-host>/:_authToken=${HUGEICONS_TOKEN}
  ```
- Set `HUGEICONS_TOKEN` in your shell locally (`export HUGEICONS_TOKEN=...`) AND in
  **Vercel → Settings → Environment Variables**, or the Vercel build can't install the
  Pro packages.

## Step 5 — Homepage build-out
> Expand the homepage using the new design system: a strong hero, a "how it works"
> section that pulls live from the `scoring_rules` table, the points breakdown, a
> leaderboard teaser, and clear CTAs to sign in / view the rules. Use Rubik/Manrope,
> Hugeicons, and AOS reveals. Keep it responsive to mobile. Run `npm run build`.

## Step 6 (optional) — Restyle existing app pages
> Bring `/predict`, `/fixtures`, `/leaderboard`, and `/me` in line with the new design
> system (fonts, Hugeicons, tokens, spacing). No logic changes. Run `npm run build`.

---

### Order rationale
Auth first (it's blocking you now) → admin + nicknames (needed before anyone can edit
scoring) → DB scoring + rules (core data change) → design system before homepage (so the
homepage is built on it) → homepage → optional page-by-page restyle. The two highest-risk
steps for regressions are **1 (auth)** and **4 (design)** — keep those as their own
isolated commits so a problem is easy to trace.
