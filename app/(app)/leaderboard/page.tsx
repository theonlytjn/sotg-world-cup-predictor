import { createClient } from '@/lib/supabase/server';
import { HugeiconsIcon } from '@hugeicons/react';
import { BarChartIcon, CrownIcon } from '@hugeicons-pro/core-stroke-rounded';

type Row = {
  user_id: string;
  display_name: string;
  total_points: number;
  exact_scores: number;
  correct_results: number;
  settled_predictions: number;
  award_points: number;
};

export const dynamic = 'force-dynamic';

const RANK_STYLES = [
  { text: 'text-gold', crown: 'text-gold' },
  { text: 'text-[#cfd6da]', crown: 'text-[#cfd6da]' },
  { text: 'text-[#e0a86b]', crown: 'text-[#e0a86b]' },
];

export default async function LeaderboardPage() {
  const supabase = await createClient();
  const { data: me } = await supabase.auth.getUser();
  const { data } = await supabase
    .from('leaderboard')
    .select('*')
    .order('total_points', { ascending: false })
    .order('exact_scores', { ascending: false });

  const rows = (data as Row[]) ?? [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-lime"><HugeiconsIcon icon={BarChartIcon} size={18} color="currentColor" strokeWidth={1.5} /></span>
        <p className="font-display font-bold text-xs tracking-[0.28em] uppercase text-lime">Live standings</p>
      </div>
      <h1 className="font-display text-4xl uppercase text-chalk">The Table</h1>
      <p className="mt-1 text-sm text-chalk/55">Updates as results come in.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        {/* header */}
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_4.5rem] items-center gap-2 border-b border-white/8 bg-pitch-800 px-4 py-3 font-display text-[10px] font-bold uppercase tracking-widest text-chalk/40">
          <span>#</span>
          <span>Player</span>
          <span className="text-center">5pt</span>
          <span className="text-center">1pt</span>
          <span className="text-center">Awds</span>
          <span className="text-right">Total</span>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-10 text-center font-body text-sm text-chalk/40">
            No players yet. Be the first to make a pick.
          </p>
        )}

        {rows.map((r, i) => {
          const isMe = r.user_id === me.user?.id;
          const rankStyle = RANK_STYLES[i];
          return (
            <div
              key={r.user_id}
              className={`grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_4.5rem] items-center gap-2 border-t border-white/5 px-4 py-3.5 transition-colors ${
                isMe ? 'bg-lime/5' : i < 3 ? 'bg-pitch-900/40' : ''
              }`}
            >
              {/* rank */}
              <div className="flex items-center">
                {i < 3 ? (
                  <span className={rankStyle.crown}>
                    <HugeiconsIcon icon={CrownIcon} size={18} color="currentColor" strokeWidth={1.5} />
                  </span>
                ) : (
                  <span className="font-display text-lg font-black text-chalk/30">{i + 1}</span>
                )}
              </div>

              {/* name */}
              <span className={`truncate font-display text-base font-bold uppercase tracking-wide ${rankStyle ? rankStyle.text : 'text-chalk'}`}>
                {r.display_name}
                {isMe && (
                  <span className="ml-2 rounded-full bg-lime/20 px-2 py-0.5 font-display text-[10px] font-bold uppercase tracking-widest text-lime">
                    you
                  </span>
                )}
              </span>

              <span className="text-center font-mono text-sm text-chalk/60">{r.exact_scores}</span>
              <span className="text-center font-mono text-sm text-chalk/60">{r.correct_results}</span>
              <span className="text-center font-mono text-sm text-chalk/60">{r.award_points}</span>

              {/* total */}
              <span className={`text-right font-display text-2xl font-black ${rankStyle ? rankStyle.text : 'text-chalk'}`}>
                {r.total_points}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
