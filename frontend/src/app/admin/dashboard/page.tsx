'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  getAdminToken,
  clearAdminToken,
  getPositions,
  createPosition,
  createCandidate,
  deletePosition,
  deleteCandidate,
  getResults,
  Position,
  ResultPosition
} from '@/lib/api';

export default function AdminDashboardPage() {
  const router = useRouter();
  const [checkingAuth, setCheckingAuth] = useState(true);

  const [positions, setPositions] = useState<Position[]>([]);
  const [results, setResults] = useState<ResultPosition[]>([]);

  const [newPositionTitle, setNewPositionTitle] = useState('');
  const [creatingPosition, setCreatingPosition] = useState(false);

  const [candidateName, setCandidateName] = useState('');
  const [candidateBio, setCandidateBio] = useState('');
  const [candidatePositionId, setCandidatePositionId] = useState('');
  const [candidatePhoto, setCandidatePhoto] = useState<File | null>(null);
  const [creatingCandidate, setCreatingCandidate] = useState(false);

  const [error, setError] = useState('');

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      router.push('/admin/login');
      return;
    }
    setCheckingAuth(false);
    loadData();
  }, []);

  async function loadData() {
    try {
      const [positionsData, resultsData] = await Promise.all([
        getPositions(),
        getResults()
      ]);
      setPositions(positionsData);
      setResults(resultsData);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleLogout() {
    clearAdminToken();
    router.push('/admin/login');
  }

  async function handleCreatePosition(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setCreatingPosition(true);
    try {
      await createPosition(newPositionTitle);
      setNewPositionTitle('');
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingPosition(false);
    }
  }

  async function handleCreateCandidate(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!candidatePhoto) {
      setError('Please select a photo');
      return;
    }

    setCreatingCandidate(true);
    try {
      const formData = new FormData();
      formData.append('name', candidateName);
      formData.append('bio', candidateBio);
      formData.append('positionId', candidatePositionId);
      formData.append('photo', candidatePhoto);

      await createCandidate(formData);

      setCandidateName('');
      setCandidateBio('');
      setCandidatePositionId('');
      setCandidatePhoto(null);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreatingCandidate(false);
    }
  }

  async function handleDeletePosition(id: string) {
    if (!confirm('Delete this position and all its candidates?')) return;
    try {
      await deletePosition(id);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleDeleteCandidate(id: string) {
    if (!confirm('Delete this candidate?')) return;
    try {
      await deleteCandidate(id);
      await loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  if (checkingAuth) {
    return <main className="min-h-screen flex items-center justify-center">Loading...</main>;
  }

  return (
    <main className="min-h-screen p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="text-sm text-red-600 hover:underline"
        >
          Log Out
        </button>
      </div>

      {error && (
        <p className="text-red-600 text-sm mb-6 bg-red-50 border border-red-200 rounded-lg p-3">
          {error}
        </p>
      )}

      <section className="mb-10 border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Create Position</h2>
        <form onSubmit={handleCreatePosition} className="flex gap-3">
          <input
            type="text"
            placeholder="e.g. Class President"
            value={newPositionTitle}
            onChange={(e) => setNewPositionTitle(e.target.value)}
            required
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            type="submit"
            disabled={creatingPosition}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingPosition ? 'Adding...' : 'Add'}
          </button>
        </form>
      </section>

      <section className="mb-10 border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Add Candidate</h2>
        <form onSubmit={handleCreateCandidate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Position</label>
            <select
              value={candidatePositionId}
              onChange={(e) => setCandidatePositionId(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="">Select a position</option>
              {positions.map(p => (
                <option key={p.id} value={p.id}>{p.title}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Name</label>
            <input
              type="text"
              value={candidateName}
              onChange={(e) => setCandidateName(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Bio (optional)</label>
            <textarea
              value={candidateBio}
              onChange={(e) => setCandidateBio(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Photo</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setCandidatePhoto(e.target.files?.[0] || null)}
              required
              className="w-full border rounded-lg px-3 py-2"
            />
          </div>

          <button
            type="submit"
            disabled={creatingCandidate}
            className="bg-blue-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creatingCandidate ? 'Adding...' : 'Add Candidate'}
          </button>
        </form>
      </section>

      <section className="mb-10 border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Manage Positions & Candidates</h2>
        {positions.map(position => (
          <div key={position.id} className="mb-6 pb-6 border-b last:border-b-0">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-medium">{position.title}</h3>
              <button
                onClick={() => handleDeletePosition(position.id)}
                className="text-sm text-red-600 hover:underline"
              >
                Delete Position
              </button>
            </div>
            <ul className="space-y-2">
              {position.candidates.map(c => (
                <li key={c.id} className="flex justify-between items-center text-sm">
                  <span>{c.name}</span>
                  <button
                    onClick={() => handleDeleteCandidate(c.id)}
                    className="text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </li>
              ))}
              {position.candidates.length === 0 && (
                <li className="text-sm text-gray-400">No candidates yet</li>
              )}
            </ul>
          </div>
        ))}
      </section>

      <section className="border rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">Live Results</h2>
        {results.map(position => (
          <div key={position.positionId} className="mb-6">
            <h3 className="font-medium mb-2">{position.title}</h3>
            <div className="space-y-2">
              {position.candidates.map(c => (
                <div key={c.candidateId} className="flex justify-between text-sm border rounded-lg px-3 py-2">
                  <span>{c.name}</span>
                  <span className="font-semibold">{c.voteCount} votes</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
