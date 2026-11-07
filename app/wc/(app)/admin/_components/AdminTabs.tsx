'use client';

import { useState } from 'react';
import AwardPanel from './AwardPanel';
import AwardVotesPanel from './AwardVotesPanel';
import FixturePanel from './FixturePanel';
import ManualPredictionsPanel from './ManualPredictionsPanel';
import PollPanel from './PollPanel';
import ScoringPanel from './ScoringPanel';
import UsersPanel from './UsersPanel';
import LeaguesAdminPanel from './LeaguesAdminPanel';
import type { AwardCategory, PollQuestion } from '@/lib/types';

type Props = {
  categories: AwardCategory[];
  resultsByCategory: Record<number, string>;
  teams: { id: number; name: string; tla: string | null; confederation: string | null }[];
  players: { id: number; name: string; position: string | null; team_id: number | null }[];
  fixtures: Parameters<typeof FixturePanel>[0]['fixtures'];
  manualFixtures: Parameters<typeof ManualPredictionsPanel>[0]['fixtures'];
  profiles: Parameters<typeof ManualPredictionsPanel>[0]['profiles'];
  pollQuestions: PollQuestion[];
  scoringRules: { key: string; label: string; description: string; points: number }[];
  leagueRows: Parameters<typeof LeaguesAdminPanel>[0]['leagues'];
  userRows: Parameters<typeof UsersPanel>[0]['users'];
};

const TABS = [
  { key: 'fixtures',   label: 'Fixtures'     },
  { key: 'manual',     label: 'Manual Picks' },
  { key: 'awards',     label: 'Awards'       },
  { key: 'votes',      label: 'Award Votes'  },
  { key: 'poll',       label: 'Poll'         },
  { key: 'scoring',    label: 'Scoring'      },
  { key: 'leagues',    label: 'Leagues'      },
  { key: 'users',      label: 'Users'        },
] as const;

type TabKey = typeof TABS[number]['key'];

export default function AdminTabs({
  categories, resultsByCategory, teams, players,
  fixtures, manualFixtures, profiles,
  pollQuestions, scoringRules, leagueRows, userRows,
}: Props) {
  const [active, setActive] = useState<TabKey>('fixtures');

  return (
    <div>
      {/* Tab bar — horizontally scrollable on mobile */}
      <div className="mb-6 -mx-1 overflow-x-auto">
        <div className="flex min-w-max gap-1 px-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActive(t.key)}
              className={[
                'rounded-xl px-4 py-2.5 font-display text-base uppercase tracking-wide transition whitespace-nowrap',
                active === t.key
                  ? 'bg-lime text-pitch-950'
                  : 'border border-white/10 text-chalk hover:border-white/30 hover:text-lime',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active panel */}
      <div className="rounded-2xl border-2 border-white/15 bg-pitch-900/40 p-6 sm:p-10">
        {active === 'fixtures' && (
          <FixturePanel fixtures={fixtures} />
        )}
        {active === 'manual' && (
          <ManualPredictionsPanel profiles={profiles} fixtures={manualFixtures} />
        )}
        {active === 'awards' && (
          <AwardPanel
            categories={categories}
            resultsByCategory={resultsByCategory}
            teams={teams}
            players={players}
          />
        )}
        {active === 'votes' && (
          <AwardVotesPanel teams={teams} players={players} />
        )}
        {active === 'poll' && (
          <PollPanel questions={pollQuestions} />
        )}
        {active === 'scoring' && (
          <ScoringPanel rules={scoringRules} />
        )}
        {active === 'leagues' && (
          <LeaguesAdminPanel
            leagues={leagueRows}
            users={userRows.map((u) => ({ id: u.id, display_name: u.display_name }))}
          />
        )}
        {active === 'users' && (
          <UsersPanel users={userRows} />
        )}
      </div>
    </div>
  );
}
