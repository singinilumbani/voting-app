const API_URL = process.env.NEXT_PUBLIC_API_URL;

export type Candidate = {
  id: string;
  name: string;
  photo_url: string;
  bio: string | null;
  position_id: string;
};

export type Position = {
  id: string;
  title: string;
  candidates: Candidate[];
};

export async function getPositions(): Promise<Position[]> {
  const res = await fetch(`${API_URL}/api/positions`, {
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch positions');
  }

  return res.json();
}

export async function castVote(positionId: string, candidateId: string) {
  const res = await fetch(`${API_URL}/api/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ positionId, candidateId })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to vote');
  }

  return data;
}

export async function getVoteStatus(): Promise<{ position_id: string; candidate_id: string }[]> {
  const res = await fetch(`${API_URL}/api/vote/status`, {
    credentials: 'include',
    cache: 'no-store'
  });

  if (!res.ok) {
    throw new Error('Failed to fetch vote status');
  }

  return res.json();
}

export async function adminLogin(email: string, password: string): Promise<{ token: string }> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Login failed');
  }

  return data;
}

export function saveAdminToken(token: string) {
  localStorage.setItem('admin_token', token);
}

export function getAdminToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('admin_token');
}

export function clearAdminToken() {
  localStorage.removeItem('admin_token');
}

async function authFetch(path: string, options: RequestInit = {}) {
  const token = getAdminToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${token}`
    }
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export async function createPosition(title: string) {
  return authFetch('/api/admin/positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  });
}

export async function createCandidate(formData: FormData) {
  const token = getAdminToken();

  const res = await fetch(`${API_URL}/api/admin/candidates`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: formData
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || 'Failed to create candidate');
  }

  return data;
}

export async function deletePosition(id: string) {
  return authFetch(`/api/admin/positions/${id}`, { method: 'DELETE' });
}

export async function deleteCandidate(id: string) {
  return authFetch(`/api/admin/candidates/${id}`, { method: 'DELETE' });
}

export type ResultCandidate = {
  candidateId: string;
  name: string;
  photoUrl: string;
  voteCount: number;
};

export type ResultPosition = {
  positionId: string;
  title: string;
  candidates: ResultCandidate[];
};

export async function getResults(): Promise<ResultPosition[]> {
  return authFetch('/api/admin/results');
}
