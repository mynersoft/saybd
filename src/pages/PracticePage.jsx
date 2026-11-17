import React from 'react';
import { Link } from 'react-router-dom';
import { Shuffle } from 'lucide-react';
import { MatchingLobby } from '../features/matching/MatchingLobby.jsx';

export function PracticePage() {
  return (
    <div className="py-2">
      <Link
        to="/chat/room"
        className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-4 py-3 text-white shadow-lg transition hover:opacity-95"
      >
        <span className="flex items-center gap-3">
          <Shuffle className="h-5 w-5" />
          <span>
            <span className="block text-sm font-bold">Random Chat Room</span>
            <span className="block text-xs text-white/80">Meet a new learner on video instantly, tap Next to switch.</span>
          </span>
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-bold">Join</span>
      </Link>
      <MatchingLobby />
    </div>
  );
}
