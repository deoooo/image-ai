# Task 3 Report: Password and Session Auth Core

## Completed
- Added `test/password.test.ts` with the two required password-hashing cases.
- Added `test/auth.test.ts` with the three required session-auth cases.
- Replaced `lib/auth.ts` with session-token auth:
  - `Session`
  - `createSessionToken`
  - `verifySessionToken`
  - `verifyAdminCredentials`
- Added `lib/password.ts` with scrypt-based password hashing and verification.

## TDD Evidence

### RED
- Command: `npm test -- test/password.test.ts`
- Result: FAIL as expected
- Failure:
  - `Error: Cannot find package '@/lib/password' imported from .../test/password.test.ts`

- Command: `npm test -- test/auth.test.ts`
- Result: FAIL as expected
- Failure:
  - `TypeError: verifyAdminCredentials is not a function`
  - `TypeError: createSessionToken is not a function`
  - `TypeError: createSessionToken is not a function`

### GREEN
- Command: `npm test -- test/password.test.ts test/auth.test.ts`
- Result: PASS
- Output summary: 2 test files passed, 5 tests passed

## Verification
- Command: `npm run lint -- lib/password.ts lib/auth.ts test/password.test.ts test/auth.test.ts`
- Result: PASS for the touched files
- Note: ESLint emitted the repo-wide baseline browser-mapping freshness warning, but no new lint errors in the files changed for this task.

## Commit
- `ccb15bb` `feat: add password and session auth core`

## Concerns
- The wider app still contains old `validateAccessKey` imports outside this task scope. Those will need follow-up updates in later tasks before the full application can be considered migrated end-to-end.

## Fix Update
- Restored `validateAccessKey(key: string | null): boolean` in `lib/auth.ts` as a temporary compatibility export using the original `ACCESS_KEYS` behavior.
- Added a focused regression assertion in `test/auth.test.ts` for the compatibility export.

### Verification After Fix
- Command: `npm test -- test/auth.test.ts test/password.test.ts`
- Result: PASS
- Output summary: 2 test files passed, 6 tests passed

- Command: `npm exec tsc --noEmit --pretty false`
- Result: PASS
- Note: npm printed the existing `--noEmit` / `--pretty` warning, but typecheck completed successfully with exit code 0.
