import { createClient } from '@/lib/supabase/server';

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
      <h1 className="font-display text-4xl uppercase text-chalk">The Table</h1>
      <p className="mt-1 text-sm text-chalk/55">Live standings — updates as results come in.</p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
        <div className="grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_4rem] items-center gap-2 bg-pitch-800 px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-chalk/40">
          <span>#</span>
          <span>Player</span>
          <span className="text-center">5pt</span>
          <span className="text-center">1pt</span>
          <span className="text-center">Awds</span>
          <span className="text-right">Pts</span>
        </div>

        {rows.length === 0 && (
          <p className="px-4 py-8 text-center font-mono text-sm text-chalk/40">
            No players yet. Be the first to make a pick.
          </p>
        )}

        {rows.map((r, i) => {
          const isMe = r.user_id === me.user?.id;
          return (
            <div
              key={r.user_id}
              className={`grid grid-cols-[2.5rem_1fr_3.5rem_3.5rem_3.5rem_4rem] items-center gap-2 border-t border-white/5 px-4 py-3 ${
                isMe ? 'bg-lime/5' : ''
              }`}
            >
              <span className={`font-display text-lg ${i < 3 ? 'text-lime' : 'text-chalk/40'}`}>
                {i + 1}
              </span>
              <span className="truncate font-display text-base uppercase tracking-wide text-chalk">
                {r.display_name}
                {isMe && <span className="ml-1.5 font-mono text-[10px] text-lime">you</span>}
              </span>
              <span className="text-center font-mono text-sm text-chalk/60">{r.exact_scores}</span>
              <span className="text-center font-mono text-sm text-chalk/60">{r.correct_results}</span>
              <span className="text-center font-mono text-sm text-chalk/60">{r.award_points}</span>
              <span className="text-right font-display text-2xl text-chalk">{r.total_points}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
