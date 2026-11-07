'use client';

import { useState } from 'react';
import type { PollQuestion } from '@/lib/types';
import DateTimePicker from './DateTimePicker';

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
              className="rounded-xl bg-lime/15 px-4 py-2 font-display text-base uppercase tracking-wide text-lime transition hover:bg-lime/25"
            >
              Unlock all
            </button>
          )}
          {anyOpen && (
            <button
              onClick={() => setOpensAt(null, null)}
              className="rounded-xl border border-flame/30 px-4 py-2 font-display text-base uppercase tracking-wide text-flame transition hover:bg-flame/10"
            >
              Lock all
            </button>
          )}
        </div>
      </div>
      <p className="mt-1 text-base text-chalk">
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
  const isOpen = question.opens_at != null && new Date(question.opens_at) <= new Date();

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/10 bg-pitch-900/60 px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="font-display text-base uppercase tracking-wide text-chalk">{question.label}</p>
        <p className={`font-mono text-sm uppercase tracking-widest ${isOpen ? 'text-lime' : 'text-chalk/60'}`}>
          {isOpen
            ? `Open since ${new Date(question.opens_at!).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
            : question.opens_at
              ? `Scheduled ${new Date(question.opens_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`
              : 'Locked'}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <DateTimePicker
          value={question.opens_at ?? null}
          onChange={(iso) => onSetOpensAt(question.id, iso)}
          placeholder="Schedule open date"
        />
        {!isOpen && (
          <button
            onClick={() => onSetOpensAt(question.id, new Date().toISOString())}
            className="rounded-lg bg-lime/15 px-3 py-1.5 font-mono text-sm uppercase tracking-widest text-lime transition hover:bg-lime/25"
          >
            Open now
          </button>
        )}
        {isOpen && (
          <button
            onClick={() => onSetOpensAt(question.id, null)}
            className="rounded-lg bg-flame/15 px-3 py-1.5 font-mono text-sm uppercase tracking-widest text-flame transition hover:bg-flame/25"
          >
            Lock
          </button>
        )}
      </div>
    </div>
  );
}
