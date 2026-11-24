# Release and branch flow

## Beta flow

1. Create a feature branch from `dev`.
2. Implement and test the feature in the frontend.
3. Open a pull request into `dev`.
4. GitHub CI validates the frontend.
5. Vercel creates a Preview Deployment for the pull request.
6. Merge to `dev`; Vercel builds the beta production deployment.

## Production later

When beta stability and paid hosting are approved:

1. Open a release pull request from `dev` into `main`.
2. Verify staging/beta behavior and required environment values.
3. Merge only after review and release approval.
4. Tag the merge with a semantic version, for example `v1.0.0`.
5. Change Vercel production branch/settings only after DNS and backend release
   configuration are ready.

## Rollback

1. Open the Vercel project.
2. Choose **Deployments**.
3. Find the last known-good deployment.
4. Use **Promote to Production** or the dashboard rollback action.
5. Confirm the frontend domain, API environment variables, and Worker release
   are compatible.
6. Keep feature and release branches available; do not rewrite history to hide
   a failed release.
