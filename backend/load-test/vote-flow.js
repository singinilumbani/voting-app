/* global __ENV */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';
import exec from 'k6/execution';

const totalVoters = Number(__ENV.TOTAL_VOTERS || 2500);
const steadyMinutes = Number(__ENV.STEADY_MINUTES || 125);
const target = __ENV.K6_TARGET;
const hostCookie = __ENV.HOST_SESSION_COOKIE;
const stationId = __ENV.STATION_ID;
const publicId = __ENV.PUBLIC_ID;
const categoryId = __ENV.CATEGORY_ID;
const candidateId = __ENV.CANDIDATE_ID;
const errors = new Rate('journey_error_rate');
const rateLimited = new Counter('rate_limited_requests');

function resolveBaseUrl() {
  if (target === 'local') return 'http://127.0.0.1:8787';
  if (target !== 'staging' || !__ENV.K6_STAGING_URL) {
    throw new Error('Set K6_TARGET=local or provide K6_TARGET=staging with K6_STAGING_URL');
  }
  const url = new URL(__ENV.K6_STAGING_URL);
  if (
    url.protocol !== 'https:' ||
    /(^|[.-])(prod|production)([.-]|$)/iu.test(url.hostname)
  ) {
    throw new Error('The staging target must be HTTPS and must not be a production hostname');
  }
  return url.origin;
}

const baseUrl = resolveBaseUrl();

if (
  !Number.isSafeInteger(totalVoters) ||
  totalVoters < 1 ||
  !Number.isSafeInteger(steadyMinutes) ||
  steadyMinutes < 1 ||
  !hostCookie ||
  !stationId ||
  !publicId ||
  !categoryId ||
  !candidateId
) {
  throw new Error(
    'Set HOST_SESSION_COOKIE, STATION_ID, PUBLIC_ID, CATEGORY_ID and CANDIDATE_ID; counts must be positive integers'
  );
}

export const options = {
  scenarios: {
    voter_journey: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '5m', target: 5 },
        { duration: '10m', target: 15 },
        { duration: '10m', target: 30 },
        { duration: `${steadyMinutes}m`, target: 30 },
        { duration: '1m', target: 0 }
      ],
      gracefulRampDown: '30s'
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    journey_error_rate: ['rate<0.05']
  }
};

export default function () {
  const index = exec.scenario.iterationInTest;
  if (index >= totalVoters) return;

  const sequence = 9_000_000 + index;
  const phone = `099${sequence}`;
  const deviceUuid = `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
  const headers = { 'Content-Type': 'application/json' };
  const registration = http.post(
    `${baseUrl}/api/v1/public/stations/${publicId}/register`,
    JSON.stringify({
      fullName: `Load Test Voter ${index + 1}`,
      phone,
      deviceUuid,
      fingerprintHash: `k6-fingerprint-${index + 1}`
    }),
    { headers }
  );
  if (!record(registration, 201)) return;

  const registrationBody = registration.json();
  if (!registrationBody || typeof registrationBody.token !== 'string') {
    errors.add(true);
    return;
  }
  const token = registrationBody.token;

  const approval = http.post(
    `${baseUrl}/api/v1/host/stations/${stationId}/voters/bulk-approve`,
    JSON.stringify({ allPending: true }),
    { headers: { ...headers, Cookie: hostCookie } }
  );
  if (!record(approval, 200)) return;

  const status = http.post(
    `${baseUrl}/api/v1/public/stations/${publicId}/status`,
    JSON.stringify({ token }),
    { headers }
  );
  if (!record(status, 200) || status.json('status') !== 'APPROVED') {
    errors.add(true);
    return;
  }

  const enter = http.post(
    `${baseUrl}/api/v1/public/stations/${publicId}/vote/enter`,
    JSON.stringify({ token }),
    { headers }
  );
  if (!record(enter, 200)) return;
  const ballotSession = enter.json('ballotSession');
  if (typeof ballotSession !== 'string') {
    errors.add(true);
    return;
  }

  const submission = http.post(
    `${baseUrl}/api/v1/public/stations/${publicId}/vote/submit`,
    JSON.stringify({ selections: [{ categoryId, candidateId }] }),
    { headers: { ...headers, Authorization: `Bearer ${ballotSession}` } }
  );
  record(submission, 200);
  sleep(0.1);
}

function record(response, expectedStatus) {
  const successful = response.status === expectedStatus;
  errors.add(!successful);
  if (response.status === 429) rateLimited.add(1);
  check(response, {
    [`HTTP ${expectedStatus}`]: (result) => result.status === expectedStatus
  });
  return successful;
}

export function handleSummary(data) {
  const requestRate = data.metrics.http_reqs?.values?.rate || 0;
  const perMinute = requestRate * 60;
  const perDay = requestRate * 86_400;
  const summary = {
    target,
    attemptedVoterCeiling: totalVoters,
    httpRequestsPerMinute: Number(perMinute.toFixed(2)),
    projectedRequestsPerDay: Math.round(perDay),
    workersDailyLimit: 100_000,
    workersPerMinuteLimit: 1_000,
    projectedDailyLimitExceeded: perDay > 100_000,
    perMinuteLimitExceeded: perMinute > 1_000,
    p95LatencyMs: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
    errorRate: data.metrics.journey_error_rate?.values?.rate ?? null,
    rateLimitedRequests: data.metrics.rate_limited_requests?.values?.count ?? 0
  };
  return {
    stdout: `${JSON.stringify(summary, null, 2)}\n`
  };
}
