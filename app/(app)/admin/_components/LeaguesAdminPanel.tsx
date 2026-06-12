'use client';

import { useState } from 'react';

type LeagueRow = {
  id: string;
  name: string;
  invite_code: string;
  created_by: string;
  creator_name: string;
  member_count: number;
  created_at: string;
};

type UserRow = { id: string; display_name: string };

export default function LeaguesAdminPanel({
  leagues,
  users,
}: {
  leagues: LeagueRow[];
  users: UserRow[];
}) {
  const [list, setList] = useState(leagues);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Add member form state
  const [addLeagueId, setAddLeagueId] = useState('');
  const [addUserId, setAddUserId] = useState('');
  const [addState, setAddState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [addError, setAddError] = useState('');

  async function deleteLeague(id: string) {
    setDeleting(id);
    setError('');
    const res = await fetch('/api/admin/delete-league', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: id }),
    });
    if (res.ok) {
      setList((prev) => prev.filter((l) => l.id !== id));
      setConfirm(null);
    } else {
      setError('Could not delete league');
    }
    setDeleting(null);
  }

  async function addMember() {
    if (!addLeagueId || !addUserId) return;
    setAddState('saving');
    setAddError('');
    const res = await fetch('/api/admin/add-league-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ league_id: addLeagueId, user_id: addUserId }),
    });
    if (res.ok) {
      setAddState('saved');
      setAddUserId('');
      setTimeout(() => setAddState('idle'), 2000);
    } else {
      const d = await res.json().catch(() => ({}));
      setAddError(d.error ?? 'Could not add member');
      setAddState('error');
    }
  }

  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">All Leagues</h2>
      <p className="mt-1 font-mono text-base text-chalk">{list.length} total</p>

      {/* Add member form */}
      <div className="mt-4 rounded-xl border border-lime/20 bg-lime/5 px-4 py-4">
        <p className="mb-3 font-display text-base uppercase tracking-wide text-lime">Add user to league</p>
        <div className="flex flex-wrap gap-2">
          <select
            value={addLeagueId}
            onChange={(e) => setAddLeagueId(e.target.value)}
            className="flex-1 min-w-[160px] rounded-lg border border-white/15 bg-pitch-800 px-3 py-2 font-mono text-base text-chalk outline-none focus:border-lime/60"
          >
            <option value="">— select league —</option>
            {list.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          <select
            value={addUserId}
            onChange={(e) => setAddUserId(e.target.value)}
            className="flex-1 min-w-[160px] rounded-lg border border-white/15 bg-pitch-800 px-3 py-2 font-mono text-base text-chalk outline-none focus:border-lime/60"
          >
            <option value="">— select user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.display_name}</option>
            ))}
          </select>
          <button
            onClick={addMember}
            disabled={!addLeagueId || !addUserId || addState === 'saving'}
            className="rounded-lg bg-lime/15 px-4 py-2 font-display text-base uppercase tracking-wide text-lime transition hover:bg-lime/25 disabled:opacity-30"
          >
            {addState === 'saving' ? 'Adding…' : addState === 'saved' ? 'Added ✓' : 'Add'}
          </button>
        </div>
        {addError && <p className="mt-2 font-mono text-base text-flame">{addError}</p>}
      </div>

      <div className="mt-4 space-y-1.5">
        {list.length === 0 && (
          <p className="font-mono text-base text-chalk">No leagues created yet.</p>
        )}
        {list.map((l) => (
          <div key={l.id} className="rounded-xl border border-white/10 bg-pitch-900/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-base uppercase text-chalk">{l.name}</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-base tracking-widest text-chalk">{l.invite_code}</span>
                  <span className="font-mono text-base text-chalk">{l.member_count} member{l.member_count !== 1 ? 's' : ''}</span>
                  <span className="font-mono text-base text-chalk">by {l.creator_name}</span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {confirm === l.id ? (
                  <>
                    <button
                      onClick={() => deleteLeague(l.id)}
                      disabled={deleting === l.id}
                      className="rounded-lg bg-flame/20 px-3 py-1 font-mono text-base text-flame transition hover:bg-flame/30 disabled:opacity-40"
                    >
                      {deleting === l.id ? 'Deleting…' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="font-mono text-base text-chalk hover:text-chalk transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirm(l.id)}
                    className="rounded-lg border border-flame/20 px-2.5 py-1 font-mono text-base text-flame transition hover:border-flame/50 hover:text-flame"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 font-mono text-base text-flame">{error}</p>}
    </div>
  );
}
