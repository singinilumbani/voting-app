# Beta deployment

## Vercel project setup

Create a Vercel project manually:

1. Import `singinilumbani/voting-app` in the Vercel dashboard.
2. Set **Root Directory** to `frontend`.
3. Set the Framework Preset to **Next.js**.
4. Set the production branch to `dev`.
5. Enable Preview Deployments for pull requests.
6. Deploy only after the beta Worker URL and environment values are available.

Do not deploy from this repository workspace yourself.

## Beta environment variables

Add these in **Project Settings > Environment Variables**:

| Variable | Beta value | Scope |
| --- | --- | --- |
| `NEXT_PUBLIC_ENV` | `staging` | Production and Preview |
| `NEXT_PUBLIC_APP_URL` | `https://beta.yourplatform.mw` or the actual beta frontend origin | Production and Preview |
| `NEXT_PUBLIC_API_MODE` | `proxy` | Production and Preview |
| `API_PROXY_TARGET` | `https://<beta-worker>.workers.dev` | Production and Preview |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Beta Cloudinary cloud name | Production and Preview |
| `NEXT_PUBLIC_ENABLE_PAYMENTS` | `false` | Production and Preview |
| `NEXT_PUBLIC_ENABLE_MOCKS` | `false` | Production and Preview |

Replace placeholder origins before deployment. Never put secrets in
`NEXT_PUBLIC_*` values.

## Ignoring unchanged frontend builds

Because the frontend is the repository's workspace root for this project, use
Vercel's **Ignored Build Step** setting. Set it to the command:

```sh
git diff HEAD^ HEAD --quiet -- frontend
```

Vercel documentation describes unchanged monorepo builds and automatic skipping
behavior, and project builds provide an Ignored Build Step setting for custom
control:

- https://vercel.com/docs/builds/configure-a-build
- https://vercel.com/docs/monorepos
- https://vercel.com/docs/deployments/skipping-a-build

In shell terms, exit `0` to skip and exit `1` to build. `git diff` checks whether
the last commit changed `frontend/**`. New monorepo projects may also skip
unaffected projects automatically, but do not rely on that replacement for
explicit frontend-only preview policy.

## Hobby plan

Vercel Hobby is suitable only for personal, non-commercial use. The app is a
closed beta, not a production commercial service yet. Before charging hosts,
collecting payments, or promoting the app commercially, upgrade to a paid plan
and review the current Vercel limits for concurrent builds, bandwidth,
function execution, and deployment frequency.

## Custom domain

When funding and production approval are available:

1. Add the frontend domain in Vercel project settings.
2. Configure the DNS record shown by Vercel.
3. Set `NEXT_PUBLIC_APP_URL` to the final HTTPS origin.
4. Add the domain to backend CORS and `COOKIE_DOMAIN` configuration.
5. Verify SSL, host auth cookies, public links, API proxying, and Cloudinary.

## Copy the CI workflow

Copy:

```text
frontend/ci/github-workflows/frontend-ci.yml
```

to:

```text
.github/workflows/frontend-ci.yml
```

Then commit the workflow at the repository root. This frontend workspace does
not create `.github/` itself.
