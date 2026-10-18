# Load test plan

## Scope and safety

The k6 scenario exercises a Closed Vote station with up to 2,500 unique voters:
registration, host approval, status check, vote entry, and ballot submission.
It measures the existing API; it does not create or change endpoints.

**Never point this test at production.** Use local `wrangler dev` or a staging
Worker and a staging/test database only. The script accepts local mode as a
fixed loopback URL. Staging mode requires an explicit HTTPS URL and rejects
hostnames containing `prod` or `production`; verify the URL and connected
database yourself before running it.

## Preparation

1. Start local PostgreSQL with the `vote_app_test` database, apply migrations,
   and start `pnpm run dev:worker` from the backend directory. For staging,
   confirm the Worker is connected to the staging database.
2. Create a Closed Vote station with `voter_cap >= 2500`, a category, and at
   least two candidates. Configure voting and launch it so registration is
   open. Ensure the station has enough voting time for the run.
3. Sign in as that station's host and obtain the host session cookie. The script
   uses the cookie only to call the existing bulk-approval endpoint; it does
   not print the cookie, voter token, or ballot session.
4. Use the station's internal UUID for `STATION_ID`, its public link ID for
   `PUBLIC_ID`, and one category/candidate UUID for `CATEGORY_ID` and
   `CANDIDATE_ID`.
5. Keep the Workers plan limits in mind: 100,000 requests per day, 1,000
   requests per minute, and 10 ms CPU per request. The script reports observed
   requests per minute and a linear requests-per-day projection; the projection
   is a comparison, not a forecast of daily user demand.

## Run locally

Use `K6_TARGET=local`; the script sends requests only to
`http://127.0.0.1:8787`.

```sh
K6_TARGET=local \
HOST_SESSION_COOKIE='host_session=<session-cookie-value>' \
STATION_ID='<station-uuid>' \
PUBLIC_ID='<station-public-id>' \
CATEGORY_ID='<category-uuid>' \
CANDIDATE_ID='<candidate-uuid>' \
k6 run load-test/vote-flow.js
```

## Run against staging

Confirm the exact URL and database are staging resources before setting
`K6_STAGING_URL`. Do not set it to a production Worker or production hostname.

```sh
K6_TARGET=staging \
K6_STAGING_URL='https://<staging-worker-host>' \
HOST_SESSION_COOKIE='host_session=<session-cookie-value>' \
STATION_ID='<station-uuid>' \
PUBLIC_ID='<station-public-id>' \
CATEGORY_ID='<category-uuid>' \
CANDIDATE_ID='<candidate-uuid>' \
k6 run load-test/vote-flow.js
```

The default run caps attempts at 2,500 voters. `TOTAL_VOTERS` can lower that
count for a smoke test; do not raise it until the database and the staging
Worker plan can support it. `STEADY_MINUTES` controls the final 30-VU stage.
The ramp is 1 to 5 VUs, then 15, then 30, followed by a configurable steady
stage and ramp-down.

The app applies stricter per-IP limits to registration and voting than
Workers' platform request limits. A single load generator shares one source IP,
so 429 responses may be expected well below 1,000 requests per minute. The
script counts these separately and includes them in the overall error rate.
For an infrastructure-capacity run, use a staging-only rate-limit configuration
and/or multiple controlled load-generator egress IPs; never weaken production
limits for a test.

## Metrics and interpretation

- Error rate: fraction of journey API calls not returning the expected status;
  429s are failures and are also counted as rate-limited requests.
- Latency: k6 `http_req_duration`, including p95; the default guard is p95 under
  1 second.
- Worker request-budget comparison: request rate multiplied by 60 and 86,400
  is shown against 1,000 requests/minute and 100,000 requests/day.
- CPU time is not inferred from HTTP latency. Collect Worker CPU/subrequest
  metrics from the staging dashboard separately; target the documented 10 ms
  CPU and 50 subrequests per invocation limits.
- The test is an application-level workflow check, not a guarantee that every
  2,500-voter event fits the free tier. The 2,500-voter recommendation remains
  provisional until a controlled staging run is reviewed.

The script was not run as part of this change.
