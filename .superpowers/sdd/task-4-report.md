# Task 4: Billing Core Report

## Scope
- Implemented `lib/billing.ts`
- Added `test/billing.test.ts`

## TDD Evidence

### RED
Command:
```bash
npm test -- test/billing.test.ts
```

Result:
```text
FAIL  test/billing.test.ts [ test/billing.test.ts ]
Error: Cannot find package '@/lib/billing' imported from /Users/deo/workspace/github.com/deoooo/image-ai/.worktrees/user-management-billing/test/billing.test.ts
```

### GREEN
Command:
```bash
npm test -- test/billing.test.ts
```

Result:
```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

Command:
```bash
npm test
```

Result:
```text
Test Files  4 passed (4)
Tests      17 passed (17)
```

Command:
```bash
npx eslint lib/billing.ts test/billing.test.ts
```

Result:
```text
[baseline-browser-mapping] The data in this module is over two months old. To ensure accurate Baseline data, please update: `npm i baseline-browser-mapping@latest -D`
```

## Implementation Summary
- Added `BillingError` with a `status` field.
- Implemented `chargeForGeneration` to reject unsupported models, charge atomically inside a Prisma transaction, create a pending generation, and return the new generation id, charged price, and current balance.
- Implemented `refundGeneration` to read the generation, skip non-charged records, prevent double refunds with `updateMany`, restore the user balance, and return the refund result.
- Added mocked Prisma coverage for unsupported models, insufficient balance, successful charge, successful refund, and duplicate refund prevention.

## Self-Review
- Behavior matches the task brief and the exact Prisma call shapes asserted by the tests.
- No new lint errors were introduced in the touched files.
- No open concerns.
