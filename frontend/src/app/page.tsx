import { getPositions, Position } from '@/lib/api';
import VotingSection from '@/components/VotingSection';

export default async function Home() {
  let positions: Position[];
  let loadError = false;

  try {
    positions = await getPositions();
  } catch {
    loadError = true;
    positions = [];
  }

  return (
    <main className="min-h-screen px-4 py-10 sm:py-14">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="w-3 h-3 rounded-full bg-[#4285F4]" />
          <span className="w-3 h-3 rounded-full bg-[#EA4335]" />
          <span className="w-3 h-3 rounded-full bg-[#FBBC05]" />
          <span className="w-3 h-3 rounded-full bg-[#34A853]" />
        </div>
        <h1 className="text-2xl font-medium text-[#202124] mb-8">Vote Now</h1>

        {loadError && (
          <p className="text-[#D93025] text-sm mb-6">
            Unable to load candidates right now. Please refresh or try again shortly.
          </p>
        )}

        {!loadError && positions.length === 0 && (
          <p className="text-[#5F6368] text-sm">No positions available yet.</p>
        )}

        <VotingSection positions={positions} />
      </div>
    </main>
  );
}
