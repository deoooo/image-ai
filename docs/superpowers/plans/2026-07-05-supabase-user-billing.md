# Supabase User Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the newly added user management, login, balance, and generation billing persistence from Prisma/PostgreSQL to the project’s existing Supabase configuration.

**Architecture:** Keep public API responses and UI behavior unchanged. Add one focused Supabase data layer that maps app camelCase types to Supabase snake_case tables and RPC functions, then update routes to use that layer.

**Tech Stack:** Next.js App Router, Vitest, Supabase JS service-role client, SQL RPC functions for atomic charge/refund.

## Global Constraints

- Admin credentials stay fixed at `lynn` / `lynn2026`.
- Built-in regular user stays `deo` / `deo2026`.
- Model prices stay `nano-banana-pro = 0.25 RMB` and `nano-banana-fast = 0.08 RMB`.
- Production must not require `DATABASE_URL`, `POSTGRES_URL`, Prisma Client, or Prisma migrations at runtime.
- Supabase SQL must be explicit because the app service role key should not create schema from route handlers.

---

### Task 1: Supabase Data Layer Contract

**Files:**
- Create: `lib/supabase-data.ts`
- Test: `test/supabase-data.test.ts`
- Modify: `test/admin-users.test.ts`, `test/billing.test.ts`, `test/generation-routes.test.ts`, `test/built-in-user-routes.test.ts`

**Interfaces:**
- Produces:
  - `listUsers()`
  - `createUser({ username, passwordHash, balance })`
  - `updateUserBalance(id, balance)`
  - `findUserByUsername(username)`
  - `findUserById(id)`
  - `chargeGeneration({ userId, prompt, model, price })`
  - `refundChargedGeneration(generationId)`
  - `attachTaskToGeneration(generationId, taskId)`
  - `findGenerationByTaskIdForUser(taskId, userId)`
  - `markGenerationSucceeded(generationId, imageUrl)`
  - `listSucceededGenerations(userId, limit)`

- [ ] Write tests that mock `@/lib/supabase-data`, not `@/lib/prisma`.
- [ ] Add mapper tests showing `created_at` becomes ISO string/date milliseconds at route boundaries.
- [ ] Run targeted tests and verify they fail because `@/lib/supabase-data` is missing.

### Task 2: Route Replacement

**Files:**
- Modify: `app/api/admin/users/route.ts`
- Modify: `app/api/admin/users/[id]/route.ts`
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/me/route.ts`
- Modify: `app/api/generate/route.ts`
- Modify: `app/api/generate/status/route.ts`
- Modify: `app/api/history/route.ts`
- Modify: `lib/billing.ts`

**Interfaces:**
- Consumes all functions from `lib/supabase-data.ts`.

- [ ] Replace Prisma imports with Supabase data-layer imports.
- [ ] Keep duplicate username and missing user status codes unchanged.
- [ ] Keep provider task persistence and refund behavior unchanged.
- [ ] Run route and billing tests until green.

### Task 3: Supabase Schema

**Files:**
- Create: `supabase/migrations/20260705000000_user_billing.sql`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Tables:
  - `image_ai_users`
  - `image_ai_generations`
- RPC:
  - `image_ai_charge_for_generation`
  - `image_ai_refund_generation`

- [ ] Add table DDL, indexes, updated-at trigger, and atomic RPC functions.
- [ ] Document how to run the SQL in Supabase before creating users in production.
- [ ] Remove Prisma/Postgres setup instructions from README/env sample.

### Task 4: Prisma Runtime Removal

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Delete obsolete Prisma-specific tests or replace them with Supabase config tests.

**Interfaces:**
- Production build should not run `prisma generate`.

- [ ] Remove Prisma scripts from `package.json`.
- [ ] Remove unused Prisma packages if no code imports them.
- [ ] Run `npm install` to update lockfile.
- [ ] Run `rg "prisma|Prisma|DATABASE_URL|POSTGRES"` and ensure no runtime paths depend on them.

### Task 5: Verification and Delivery

**Files:**
- All modified files.

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Commit the Supabase migration fix.
- [ ] Push `main`.
