import Link from 'next/link';

export default function VotedPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="max-w-sm w-full text-center bg-white border border-[#BFE0F2] rounded-2xl p-8">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-[#E6F4EA] flex items-center justify-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="w-8 h-8 text-[#188038]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="text-xl font-medium text-[#10253A] mb-2">
          Your vote has been recorded
        </h1>
        <p className="text-sm text-[#5F6368] mb-6">
          Thank you for participating. You have successfully voted in every position.
        </p>

        <Link
          href="/"
          className="inline-block text-sm text-[#0072BC] font-medium hover:underline"
        >
          Back to voting page
        </Link>
      </div>
    </main>
  );
}
