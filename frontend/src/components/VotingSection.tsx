'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Position, castVote, getVoteStatus } from '@/lib/api';

export default function VotingSection({ positions }: { positions: Position[] }) {
  const router = useRouter();
  const [votedPositions, setVotedPositions] = useState<Record<string, string>>({});
  const [loadingCandidateId, setLoadingCandidateId] = useState<string | null>(null);
  const [errorByPosition, setErrorByPosition] = useState<Record<string, string>>({});
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    getVoteStatus()
      .then(votes => {
        const voted: Record<string, string> = {};
        votes.forEach(v => {
          voted[v.position_id] = v.candidate_id;
        });
        setVotedPositions(voted);
        setStatusLoaded(true);

        if (positions.length > 0 && positions.every(p => voted[p.id])) {
          router.push('/voted');
        }
      })
      .catch(err => {
        console.error('Failed to load vote status', err);
        setStatusLoaded(true);
      });
  }, []);

  async function handleVote(positionId: string, candidateId: string) {
    setLoadingCandidateId(candidateId);
    setErrorByPosition(prev => ({ ...prev, [positionId]: '' }));

    try {
      await castVote(positionId, candidateId);
      const updated = { ...votedPositions, [positionId]: candidateId };
      setVotedPositions(updated);

      if (positions.every(p => updated[p.id])) {
        router.push('/voted');
      }
    } catch (err: any) {
      setErrorByPosition(prev => ({ ...prev, [positionId]: err.message }));
    } finally {
      setLoadingCandidateId(null);
    }
  }

  if (!statusLoaded) {
    return null;
  }

  return (
    <div className="space-y-6">
      {positions.map(position => {
        const votedCandidateId = votedPositions[position.id];
        const hasVoted = Boolean(votedCandidateId);

        return (
          <section
            key={position.id}
            className="bg-white border border-[#BFE0F2] rounded-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[#BFE0F2]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0072BC]" />
              <h2 className="text-base font-medium text-[#10253A]">{position.title}</h2>
              {hasVoted && (
                <span className="ml-auto text-xs font-medium text-[#188038] bg-[#E6F4EA] px-2.5 py-1 rounded-full">
                  Vote recorded
                </span>
              )}
            </div>

            {errorByPosition[position.id] && (
              <p className="text-sm text-red-600 px-5 pt-3">{errorByPosition[position.id]}</p>
            )}

            <div className="p-5 flex gap-4 overflow-x-auto snap-x snap-mandatory">
              {position.candidates.map(candidate => {
                const isThisCandidateVoted = votedCandidateId === candidate.id;
                const isLoading = loadingCandidateId === candidate.id;

                return (
                  <div
                    key={candidate.id}
                    className="border border-[#BFE0F2] rounded-xl p-4 text-center flex-shrink-0 w-40 sm:w-48 snap-start"
                  >
                    <img
                      src={candidate.photo_url}
                      alt={candidate.name}
                      className="w-full aspect-square object-cover rounded-lg mb-3"
                    />
                    <p className="text-sm font-medium text-[#10253A] mb-1 truncate">
                      {candidate.name}
                    </p>

                    {candidate.bio && (
                      <p className="text-xs text-[#5F6368] mb-3 line-clamp-2">
                        {candidate.bio}
                      </p>
                    )}

                    <button
                      onClick={() => handleVote(position.id, candidate.id)}
                      disabled={hasVoted || isLoading}
                      className={`w-full py-2 rounded-full text-sm font-medium transition-colors
                        ${isThisCandidateVoted
                          ? 'bg-[#E6F4EA] text-[#188038] border border-[#188038]'
                          : hasVoted
                          ? 'bg-[#F1F3F4] text-[#9AA0A6] cursor-not-allowed'
                          : 'bg-[#0072BC] text-white hover:bg-[#005A96]'}`}
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
