'use client';

import { useState, useEffect } from 'react';
import { Position, castVote, getVoteStatus } from '@/lib/api';

export default function VotingSection({ positions }: { positions: Position[] }) {
  const [votedPositions, setVotedPositions] = useState<Record<string, string>>({});
  const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
  const [errorByPosition, setErrorByPosition] = useState<Record<string, string>>({});

  useEffect(() => {
    getVoteStatus()
      .then(votes => {
        const voted: Record<string, string> = {};
        votes.forEach(v => {
          voted[v.position_id] = v.candidate_id;
        });
        setVotedPositions(voted);
      })
      .catch(err => console.error('Failed to load vote status', err));
  }, []);

  async function handleVote(positionId: string, candidateId: string) {
    setLoadingCandidateId(candidateId);
    setErrorByPosition(prev => ({ ...prev, [positionId]: '' }));

    try {
      await castVote(positionId, candidateId);
      setVotedPositions(prev => ({ ...prev, [positionId]: candidateId }));
    } catch (err: any) {
      setErrorByPosition(prev => ({ ...prev, [positionId]: err.message }));
    } finally {
      setLoadingCandidateId(null);
    }
  }

  return (
    <div className="space-y-6">
      {positions.map(position => {
        const votedCandidateId = votedPositions[position.id];
        const hasVoted = Boolean(votedCandidateId);

        return (
          <section
            key={position.id}
            className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#DADCE0]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#4285F4]" />
              <h2 className="text-base font-medium text-[#202124]">{position.title}</h2>
              {hasVoted && (
                <span className="ml-auto text-xs font-medium text-[#188038] bg-[#E6F4EA] px-2.5 py-1 rounded-full">
                  Vote recorded
                </span>
              )}
            </div>

            {errorByPosition[position.id] && (
              <p className="text-sm text-[#D93025] px-5 pt-3">{errorByPosition[position.id]}</p>
            )}

            <div className="p-5 flex gap-4 overflow-x-auto snap-x snap-mandatory">
              {position.candidates.map(candidate => {
                const isThisCandidateVoted = votedCandidateId === candidate.id;
                const isLoading = loadingCandidateId === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    className="border border-[#DADCE0] rounded-xl p-4 text-center flex-shrink-0 w-40 sm:w-48 snap-start"
                  >
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL}${candidate.photo_url}`}
                      alt={candidate.name}
                      className="w-full aspect-square object-cover rounded-lg mb-3"
                    />
                    <p className="text-sm font-medium text-[#202124] mb-3 truncate">
                      {candidate.name}
                    </p>

                    <button
                      onClick={() => handleVote(position.id, candidate.id)}
                      disabled={hasVoted || isLoading}
                      className={`w-full py-2 rounded-full text-sm font-medium transition-colors
                        ${isThisCandidateVoted
                          ? 'bg-[#E6F4EA] text-[#188038] border border-[#188038]'
                          : hasVoted
                          ? 'bg-[#F1F3F4] text-[#9AA0A6] cursor-not-allowed'
                          : 'bg-[#4285F4] text-white hover:bg-[#3367D6]'}`}
                    >
                      {isThisCandidateVoted ? 'Voted' : isLoading ? 'Voting…' : 'Vote'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
