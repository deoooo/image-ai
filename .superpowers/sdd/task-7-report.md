# Task 7 Report

## Scope Delivered

- Switched `app/api/generate/route.ts` from legacy access-key auth to bearer `requireUser`, added Prisma-backed generation ownership persistence, and integrated `chargeForGeneration` / `refundGeneration` around the existing NDJSON streaming flow.
- Switched `app/api/generate/status/route.ts` to bearer `requireUser`, enforced user ownership via Prisma, preserved the generated-image R2 upload rewrite, persisted successful results to Prisma, and refunded failed generations through `refundGeneration`.
- Switched `app/api/history/route.ts` to bearer `requireUser` and Prisma-backed user-scoped history reads.
- Switched `app/api/upload/route.ts` and `app/api/upload/presigned/route.ts` to bearer `requireUser` and removed legacy `validateAccessKey` usage.
- Added focused route coverage in `test/generation-routes.test.ts` for generate, status, history, upload, and presigned upload behavior.

## Validation

- `npm test -- test/generation-routes.test.ts`
- `npm test -- test/model-pricing.test.ts test/billing.test.ts test/auth.test.ts test/password.test.ts test/admin-users.test.ts`
- `npm exec -- eslint app/api/generate/route.ts app/api/generate/status/route.ts app/api/history/route.ts app/api/upload/route.ts app/api/upload/presigned/route.ts`
- `npm exec -- tsc --noEmit --pretty false`
- `git diff --check`

## Self-Review

- Kept the existing generate streaming response shape and retry/log messages intact while adding billing and Prisma persistence.
- Kept the status route’s R2 upload behavior intact; only the storage update path changed from Supabase to Prisma and failure now returns the refunded balance.
- Upload endpoints now consistently require bearer user auth; no legacy access-key fallback remains in the owned files.

## Concerns

- `eslint` emitted the existing `baseline-browser-mapping` staleness warning but exited successfully; it does not come from these route changes.

## Review Fix Evidence

- Tightened the `POST /api/generate` refund boundary so the stream refund path only runs before a provider `taskId` exists. Once `client.draw()` returns a `taskId`, persistence failures are surfaced as stream errors and logged without refunding a live provider job.
- Scoped presigned upload keys to `users/<userId>/...` by sanitizing the requested filename/path before calling `getPresignedUrl`.
- Scoped Vercel Blob upload pathnames to `users/<userId>/...` before delegating to `handleUpload`, and token generation now includes `tokenPayload: {"userId":"..."}`.
- Expanded `test/generation-routes.test.ts` to cover legacy access-key rejection, task owner mismatch returning `404`, repeated failed status polling delegating to idempotent refunds, post-`taskId` generate failures not refunding, and upload key/path scoping.
