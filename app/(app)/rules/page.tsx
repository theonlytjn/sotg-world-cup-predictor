import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type ScoringRule   = { key: string; label: string; description: string; points: number };
type AwardCategory = { slug: string; label: string; pick_kind: string; pts_pick_1: number; pts_pick_2: number; section: string };

const SECTION_LABEL: Record<string, string> = {
  main:     'FIFA Awards',
  specials: 'SOTG Specials',
  xtra:     'SOTG Xtra',
};

const PICK_KIND_LABEL: Record<string, string> = {
  team:          'Pick two teams',
  player:        'Pick two players',
  confederation: 'Pick two confederations',
  stage:         'Pick a tournament stage',
};

export default async function RulesPage() {
  const supabase = await createClient();

  const [{ data: rules }, { data: awards }] = await Promise.all([
    supabase.from('scoring_rules').select('key, label, description, points').order('key'),
    supabase.from('award_categories')
      .select('slug, label, pick_kind, pts_pick_1, pts_pick_2, section')
      .not('section', 'eq', 'opinion')
      .order('sort_order'),
  ]);

  const awardsBySection = new Map<string, AwardCategory[]>();
  for (const a of (awards as AwardCategory[]) ?? []) {
    if (!awardsBySection.has(a.section)) awardsBySection.set(a.section, []);
    awardsBySection.get(a.section)!.push(a);
  }

  const matchRules = (rules as ScoringRule[]) ?? [];

  return (
    <div>
      <h1 className="font-display text-4xl uppercase text-chalk">Rules &amp; Points</h1>
      <p className="mt-1 text-sm text-chalk/55">
        Every point source in the predictor — live from the database.
      </p>

      {/* ── Match Predictions ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">Match predictions</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {matchRules.map((r) => (
            <div key={r.key} className="flex flex-col rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
              <p className="font-display text-lg uppercase text-chalk">{r.label}</p>
              <p className="mt-1 flex-1 text-sm text-chalk/50">{r.description}</p>
              <p className="mt-4 font-mono text-4xl font-semibold text-lime">
                {r.points}
                <span className="ml-1.5 text-sm text-lime/60">pts</span>
              </p>
            </div>
          ))}
          {/* Wrong prediction — always 0 */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
            <p className="font-display text-lg uppercase text-chalk">Wrong</p>
            <p className="mt-1 flex-1 text-sm text-chalk/50">Score and result both wrong — no points.</p>
            <p className="mt-4 font-mono text-4xl font-semibold text-chalk/25">
              0<span className="ml-1.5 text-sm">pts</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Award Sections ── */}
      {['main', 'specials', 'xtra'].map((section) => {
        const cats = awardsBySection.get(section);
        if (!cats?.length) return null;
        return (
          <section key={section} className="mt-8">
            <div className="mb-3 flex items-center gap-3">
              <h2 className="font-display text-2xl uppercase text-lime">
                {SECTION_LABEL[section] ?? section}
              </h2>
              <span className="h-px flex-1 bg-white/10" />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cats.map((cat) => (
                <div key={cat.slug} className="flex flex-col rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
                  <p className="font-display text-lg uppercase leading-tight text-chalk">{cat.label}</p>
                  <p className="mt-1 flex-1 text-sm text-chalk/50">
                    {PICK_KIND_LABEL[cat.pick_kind] ?? 'Make a prediction'}
                  </p>
                  <div className="mt-4 flex items-end gap-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-chalk/30">1st choice</p>
                      <p className="font-mono text-3xl font-semibold text-lime">
                        {cat.pts_pick_1}
                        <span className="ml-1 text-sm text-lime/60">pts</span>
                      </p>
                    </div>
                    <div className="mb-1">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-chalk/30">2nd</p>
                      <p className="font-mono text-xl font-semibold text-chalk/50">
                        {cat.pts_pick_2}
                        <span className="ml-1 text-sm text-chalk/30">pts</span>
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      {/* ── Opinion Poll note ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-gold">Opinion Poll</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="rounded-2xl border border-gold/20 bg-pitch-900/60 p-5">
          <p className="text-sm text-chalk/55">
            Five open-ended opinion votes — no points, no deadline. Vote on anything from the Breakthrough Star to the Worst Team. Results are tallied and revealed when the tournament ends.
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">How it works</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Predict',    body: 'Enter your score predictions before each game kicks off. Predictions lock 15 minutes before kick-off.' },
            { title: 'Live',       body: 'The table updates in real time as games are played. Live projected points show during in-progress games.' },
            { title: 'Awards',     body: 'Award predictions lock at the tournament deadline set by the admin. Two choices per category.' },
            { title: 'Win',        body: 'Most total points at the end of the tournament wins. Exact scores beat correct results in tie-breaking.' },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
              <p className="font-display text-lg uppercase text-chalk">{title}</p>
              <p className="mt-2 text-sm text-chalk/55">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
