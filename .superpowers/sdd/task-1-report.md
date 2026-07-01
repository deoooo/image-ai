# Task 1 Report: Test Runner and Model Pricing

## Completed
- Added `vitest` as dev dependency in `package.json` and locked it in `package-lock.json` via `npm install --save-dev vitest`.
- Added `test` script to `package.json`: `vitest run`.
- Added `vitest.config.ts` with the exact config in the brief.
- Added `lib/model-pricing.ts` implementing:
  - `MODEL_PRICES`
  - `getModelPrice`
  - `isSupportedModel`
  - `listModelPrices`
- Added `test/model-pricing.test.ts` with the three required cases.

## Verification
- Command run: `npm test -- test/model-pricing.test.ts`
- Result: PASS — 1 test file, 3 tests passed.

## Notes
- Baseline repo had existing lint/test noise outside this task; only task-relevant files were changed and no unrelated logic was modified.
