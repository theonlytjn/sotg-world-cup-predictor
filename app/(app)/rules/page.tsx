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
  team:          'Back two teams. First choice pays more.',
  player:        'Back two players. First choice pays more.',
  confederation: 'Back two confederations. First choice pays more.',
  stage:         'Call the stage. One shot.',
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
      <h1 className="font-display text-4xl uppercase text-chalk">How Points Work</h1>
      <p className="mt-1 text-base text-chalk">
        Know the rules. Know the points. No excuses on matchday.
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
              <p className="mt-1 flex-1 text-base text-chalk">{r.description}</p>
              <p className="mt-4 font-mono text-4xl font-semibold text-lime">
                {r.points}
                <span className="ml-1.5 text-base text-lime">pts</span>
              </p>
            </div>
          ))}
          {/* Wrong prediction — always 0 */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
            <p className="font-display text-lg uppercase text-chalk">Sent to the stands</p>
            <p className="mt-1 flex-1 text-base text-chalk">Wrong result. No points. Move on to the next fixture.</p>
            <p className="mt-4 font-mono text-4xl font-semibold text-chalk">
              0<span className="ml-1.5 text-base">pts</span>
            </p>
          </div>
        </div>
      </section>

      {/* ── Banker Pick ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-gold">Banker Pick</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <span className="text-3xl leading-none">⭐</span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg uppercase text-chalk">Your one power move per matchday</p>
              <p className="mt-2 text-base text-chalk">
                Before any match in a matchday kicks off, you can mark one of your predictions as your
                <span className="text-gold font-semibold"> Banker</span>. If that prediction scores points,
                they&apos;re doubled. Simple as that.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gold/20 bg-pitch-900/80 p-4">
              <p className="font-mono text-sm uppercase tracking-widest text-gold">Exact score + Banker</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-lime">
                {matchRules.find(r => r.key === 'match_exact')?.points
                  ? `${(matchRules.find(r => r.key === 'match_exact')!.points * 2)}`
                  : '6'}
                <span className="ml-1.5 text-base text-lime">pts</span>
              </p>
              <p className="mt-1 text-sm text-chalk">
                {matchRules.find(r => r.key === 'match_exact')?.points ?? 3} pts × 2 — you nailed it and doubled down
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-pitch-900/80 p-4">
              <p className="font-mono text-sm uppercase tracking-widest text-chalk">Correct result + Banker</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-lime">
                {matchRules.find(r => r.key === 'match_result')?.points
                  ? `${(matchRules.find(r => r.key === 'match_result')!.points * 2)}`
                  : '2'}
                <span className="ml-1.5 text-base text-lime">pts</span>
              </p>
              <p className="mt-1 text-sm text-chalk">
                {matchRules.find(r => r.key === 'match_result')?.points ?? 1} pt × 2 — right result, still doubled
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-pitch-900/80 p-4">
              <p className="font-mono text-sm uppercase tracking-widest text-flame">Wrong prediction + Banker</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-chalk">
                0<span className="ml-1.5 text-base">pts</span>
              </p>
              <p className="mt-1 text-sm text-chalk">
                The banker burns with the pick. No bonus for a miss.
              </p>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg leading-none">📌</span>
              <p className="text-base text-chalk">
                <span className="font-semibold text-chalk">One banker per matchday.</span>{' '}
                You can set it on any prediction you&apos;ve already made, right up to the moment that match kicks off.
                Switching it to another game automatically removes the old one.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-lg leading-none">☆</span>
              <p className="text-base text-chalk">
                <span className="font-semibold text-chalk">How to set it.</span>{' '}
                On the Predict page, save your pick first, then tap the star (☆) that appears next to the save button.
                The card gains a gold border to confirm it&apos;s your banker.
              </p>
            </div>
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
                  <p className="mt-1 flex-1 text-base text-chalk">
                    {PICK_KIND_LABEL[cat.pick_kind] ?? 'Call your shot.'}
                  </p>
                  <div className="mt-4 flex items-end gap-4">
                    <div>
                      <p className="font-mono text-sm uppercase tracking-widest text-chalk">1st choice</p>
                      <p className="font-mono text-3xl font-semibold text-lime">
                        {cat.pts_pick_1}
                        <span className="ml-1 text-base text-lime">pts</span>
                      </p>
                    </div>
                    <div className="mb-1">
                      <p className="font-mono text-sm uppercase tracking-widest text-chalk">2nd</p>
                      <p className="font-mono text-xl font-semibold text-chalk">
                        {cat.pts_pick_2}
                        <span className="ml-1 text-base text-chalk">pts</span>
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
          <p className="text-base text-chalk">
            Five open-ended votes — no points, no deadline. Breakthrough Star to Worst Team. Have your say. Results revealed when the final whistle blows.
          </p>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="mt-8">
        <div className="mb-3 flex items-center gap-3">
          <h2 className="font-display text-2xl uppercase text-lime">The rules</h2>
          <span className="h-px flex-1 bg-white/10" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { title: 'Call your shot',    body: 'Back a scoreline for every fixture before kick-off. Change your mind right up until the whistle.' },
            { title: 'Whistle means locked', body: 'Kick-off hits, predictions freeze. No edits. No second chances. Own every call you made.' },
            { title: 'Awards deadline',   body: 'Award predictions lock at the tournament deadline. Back your first and second choice — first always pays more.' },
            { title: 'Champions',         body: 'Most points when the final whistle blows wins the table. Exact scores beat correct results in any tie.' },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-pitch-900/60 p-5">
              <p className="font-display text-lg uppercase text-chalk">{title}</p>
              <p className="mt-2 text-base text-chalk">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
