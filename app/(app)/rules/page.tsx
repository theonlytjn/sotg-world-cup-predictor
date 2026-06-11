import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ScoringRule   = { key: string; label: string; description: string; points: number };
type AwardCategory = { slug: string; label: string; pick_kind: string; pts_pick_1: number; pts_pick_2: number; section: string };

const SECTION_LABEL: Record<string, string> = {
  main:     'Awards',
  specials: 'SOTG Specials',
  xtra:     'SOTG Xtra',
};

export default async function RulesPage() {
  const supabase = await createClient();

  const [{ data: rules }, { data: awards }] = await Promise.all([
    supabase.from('scoring_rules').select('key, label, description, points').order('key'),
    supabase.from('award_categories').select('slug, label, pick_kind, pts_pick_1, pts_pick_2, section').order('sort_order'),
  ]);

  const awardsBySection = new Map<string, AwardCategory[]>();
  for (const a of (awards as AwardCategory[]) ?? []) {
    if (!awardsBySection.has(a.section)) awardsBySection.set(a.section, []);
    awardsBySection.get(a.section)!.push(a);
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-4xl uppercase text-chalk">Rules &amp; Points</h1>
      <p className="mt-2 text-sm text-chalk/55">
        Every point source in the predictor — live from the database.
      </p>

      {/* Match scoring */}
      <section className="mt-8">
        <h2 className="mb-3 font-display text-xl uppercase tracking-wide text-lime">Match predictions</h2>
        <div className="space-y-2">
          {(rules as ScoringRule[])?.map((r) => (
            <div key={r.key} className="flex items-center justify-between rounded-2xl border border-white/10 bg-pitch-900/60 px-5 py-4">
              <div>
                <p className="font-display text-base uppercase tracking-wide text-chalk">{r.label}</p>
                <p className="mt-0.5 text-sm text-chalk/50">{r.description}</p>
              </div>
              <span className="ml-4 shrink-0 font-mono text-2xl font-semibold text-lime">
                {r.points}<span className="ml-1 text-sm text-lime/60">pt{r.points !== 1 ? 's' : ''}</span>
              </span>
            </div>
          ))}
          <div className="rounded-2xl border border-white/10 bg-pitch-900/60 px-5 py-4">
            <p className="font-display text-base uppercase tracking-wide text-chalk">Wrong</p>
            <p className="mt-0.5 text-sm text-chalk/50">Score and result both wrong — no points.</p>
            <span className="mt-1 block font-mono text-2xl font-semibold text-chalk/30">
              0<span className="ml-1 text-sm">pts</span>
            </span>
          </div>
        </div>
      </section>

      {/* Award scoring — grouped by section */}
      {['main', 'specials', 'xtra'].map((section) => {
        const cats = awardsBySection.get(section);
        if (!cats?.length) return null;
        return (
          <section key={section} className="mt-8">
            <h2 className="mb-3 font-display text-xl uppercase tracking-wide text-lime">
              {SECTION_LABEL[section] ?? section}
            </h2>
            <div className="space-y-2">
              {cats.map((cat) => (
                <div key={cat.slug} className="flex items-center justify-between rounded-2xl border border-white/10 bg-pitch-900/60 px-5 py-4">
                  <div>
                    <p className="font-display text-base uppercase tracking-wide text-chalk">{cat.label}</p>
                    <p className="mt-0.5 text-sm text-chalk/50">
                      {cat.pick_kind === 'player' ? 'Pick two players' :
                       cat.pick_kind === 'confederation' ? 'Pick two confederations' :
                       'Pick two teams'}
                    </p>
                  </div>
                  <div className="ml-4 shrink-0 text-right font-mono">
                    <p className="text-xl font-semibold text-lime">
                      {cat.pts_pick_1}<span className="ml-0.5 text-sm text-lime/60">pts</span>
                    </p>
                    <p className="text-xs text-chalk/40">
                      2nd choice: {cat.pts_pick_2}pts
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* General notes */}
      <section className="mt-8 rounded-2xl border border-white/10 bg-pitch-900/40 px-5 py-5">
        <h2 className="font-display text-base uppercase tracking-wide text-chalk/70">How it works</h2>
        <ul className="mt-3 space-y-2 text-sm text-chalk/55">
          <li>• Predictions lock the moment a match kicks off — you can&apos;t edit after that.</li>
          <li>• Award predictions lock at the deadline set by the admin.</li>
          <li>• Points are awarded automatically after each match finishes.</li>
          <li>• The leaderboard updates in real time as results come in.</li>
        </ul>
      </section>
    </div>
  );
}
