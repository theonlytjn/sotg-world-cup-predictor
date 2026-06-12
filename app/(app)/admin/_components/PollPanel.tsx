'use client';

import { useState } from 'react';
import type { PollQuestion } from '@/lib/types';

export default function PollPanel({ questions }: { questions: PollQuestion[] }) {
  const allOpen = questions.every((q) => q.opens_at && new Date(q.opens_at) <= new Date());
  const anyOpen = questions.some((q) => q.opens_at && new Date(q.opens_at) <= new Date());

  async function setOpensAt(question_id: number | null, opens_at: string | null) {
    await fetch('/api/admin/set-poll-opens-at', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question_id, opens_at }),
    });
    // Reload to reflect changes
    window.location.reload();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl uppercase text-chalk">Opinion Poll</h2>
        <div className="flex gap-2">
          {!allOpen && (
            <button
              onClick={() => setOpensAt(null, new Date().toISOString())}
              className="rounded-xl bg-lime/15 px-4 py-2 font-display text-xs uppercase tracking-wide text-lime transition hover:bg-lime/25"
            >
              Unlock all
            </button>
          )}
          {anyOpen && (
            <button
              onClick={() => setOpensAt(null, null)}
              className="rounded-xl border border-flame/30 px-4 py-2 font-display text-xs uppercase tracking-wide text-flame transition hover:bg-flame/10"
            >
              Lock all
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-sm text-chalk/50">
        Questions are locked until you open them — typically after the final.
      </p>

      <div className="mt-4 space-y-2">
        {questions.map((q) => (
          <QuestionRow key={q.id} question={q} onSetOpensAt={setOpensAt} />
        ))}
      </div>
    </div>
  );
}

function QuestionRow({
  question,
  onSetOpensAt,
}: {
  question: PollQuestion;
  onSetOpensAt: (id: number | null, opens_at: string | null) => void;
}) {
  const open = question.opens_at != null && new Date(question.opens_at) <= new Date();
  const [datetime, setDatetime] = useState(
    question.opens_at ? new Date(question.opens_at).toISOString().slice(0, 16) : ''
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-pitch-900/60 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base uppercase tracking-wide text-chalk">{question.label}</p>
        <p className={`font-mono text-xs uppercase tracking-widest ${open ? 'text-lime' : 'text-chalk/40'}`}>
          {open
            ? `Open since ${new Date(question.opens_at!).toLocaleString()}`
            : question.opens_at
              ? `Scheduled ${new Date(question.opens_at).toLocaleString()}`
              : 'Locked'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="datetime-local"
          value={datetime}
          onChange={(e) => setDatetime(e.target.value)}
          className="rounded-lg border border-white/15 bg-pitch-800 px-2 py-1 font-mono text-xs text-chalk outline-none focus:border-lime/60"
        />
        <button
          onClick={() => onSetOpensAt(question.id, datetime ? new Date(datetime).toISOString() : null)}
          className="rounded-lg bg-pitch-700 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-chalk/70 transition hover:bg-pitch-600"
        >
          Set
        </button>
        {!open && (
          <button
            onClick={() => onSetOpensAt(question.id, new Date().toISOString())}
            className="rounded-lg bg-lime/15 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-lime transition hover:bg-lime/25"
          >
            Open now
          </button>
        )}
        {open && (
          <button
            onClick={() => onSetOpensAt(question.id, null)}
            className="rounded-lg bg-flame/15 px-3 py-1.5 font-mono text-xs uppercase tracking-widest text-flame transition hover:bg-flame/25"
          >
            Lock
          </button>
        )}
      </div>
    </div>
  );
}
