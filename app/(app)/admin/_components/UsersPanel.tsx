'use client';

import { useState } from 'react';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  created_at: string;
  total_points: number;
  league_count: number;
};

export default function UsersPanel({ users }: { users: UserRow[] }) {
  const [list, setList] = useState(users);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function deleteUser(id: string) {
    setDeleting(id);
    setError('');
    const res = await fetch('/api/admin/delete-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: id }),
    });
    if (res.ok) {
      setList((prev) => prev.filter((u) => u.id !== id));
      setConfirm(null);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? 'Could not delete user');
    }
    setDeleting(null);
  }

  return (
    <div>
      <h2 className="font-display text-2xl uppercase text-chalk">Users</h2>
      <p className="mt-1 font-mono text-smtext-chalk/40">{list.length} registered</p>

      <div className="mt-4 space-y-1.5">
        {list.map((u) => (
          <div key={u.id} className="rounded-xl border border-white/10 bg-pitch-900/60 px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-sm uppercase text-chalk truncate">{u.display_name}</p>
                <p className="font-mono text-smtext-chalk/40 truncate">{u.email}</p>
                <div className="mt-1 flex items-center gap-3">
                  <span className="font-mono text-smtext-lime">{u.total_points}pts</span>
                  <span className="font-mono text-smtext-chalk/40">{u.league_count} league{u.league_count !== 1 ? 's' : ''}</span>
                  <span className="font-mono text-smtext-chalk/25">
                    {new Date(u.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {confirm === u.id ? (
                  <>
                    <button
                      onClick={() => deleteUser(u.id)}
                      disabled={deleting === u.id}
                      className="rounded-lg bg-flame/20 px-3 py-1 font-mono text-smtext-flame transition hover:bg-flame/30 disabled:opacity-40"
                    >
                      {deleting === u.id ? 'Deleting…' : 'Confirm delete'}
                    </button>
                    <button
                      onClick={() => setConfirm(null)}
                      className="font-mono text-smtext-chalk/40 hover:text-chalk transition"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirm(u.id)}
                    className="rounded-lg border border-flame/20 px-2.5 py-1 font-mono text-smtext-flame/60 transition hover:border-flame/50 hover:text-flame"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && <p className="mt-3 font-mono text-smtext-flame">{error}</p>}
    </div>
  );
}
