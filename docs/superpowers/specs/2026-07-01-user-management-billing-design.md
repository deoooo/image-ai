# User Management and Model-Based Billing Design

## Goal

Add account-based access to Image AI. Administrators can create users and set
balances. Regular users can sign in with username and password, generate images,
and pay a model-specific price from their balance.

This design uses Prisma as the application data layer. Supabase may still host
the PostgreSQL database, but application code will stop using direct Supabase
table calls for users, generations, history, and billing.

## Scope

- Replace access-key authentication with username/password login.
- Keep the temporary administrator credential fixed as `lynn / lynn2026`.
- Store regular users and generation records through Prisma.
- Charge a fixed code-defined price per generation model.
- Reject generation when a user's balance is insufficient.
- Refund a charged generation exactly once if the task fails.
- Let administrators create users and update balances.
- Show regular users their balance and the selected model price.

Out of scope:

- Administrator password storage or rotation.
- Administrator image generation.
- Admin-configurable model prices.
- Multi-role user tables beyond the fixed admin and regular database users.
- Full migration of old Supabase generation records into the new Prisma table.

## Data Model

`User` stores regular user accounts:

- `id`: primary key.
- `username`: unique login name.
- `passwordHash`: hashed password.
- `balance`: integer credit balance.
- `createdAt`: creation timestamp.
- `updatedAt`: update timestamp.

`Generation` becomes the runtime generation table:

- `id`: primary key.
- `taskId`: external generation task id, unique after task creation.
- `prompt`: submitted prompt.
- `model`: selected model.
- `imageUrl`: final stored image URL when available.
- `status`: generation status such as `pending`, `succeeded`, or `failed`.
- `userId`: owner user id.
- `priceCharged`: price charged for this task.
- `chargeStatus`: `charged`, `refunded`, or `not_charged`.
- `createdAt`: creation timestamp.
- `updatedAt`: update timestamp.

`Generation.userId` relates to `User.id`. History reads must filter by the
current user id.

## Model Pricing

Prices are code constants. Initial supported keys match the existing UI models:

- `nano-banana-fast`
- `nano-banana-pro`

The exact numeric values will live in one shared server/client-safe module so
the frontend can display the selected price and the backend can enforce the
same price. The backend remains authoritative.

Unknown models are rejected before billing.

## Authentication

`/api/auth/login` accepts `username` and `password`.

For `lynn / lynn2026`, it returns an administrator session token. The admin
account is not stored in the database.

For regular users, it looks up `User.username`, verifies `passwordHash`, and
returns a regular user session token with `userId` and `role`.

Session tokens are server-signed and stored by the browser in `localStorage`.
Subsequent API calls use:

```text
Authorization: Bearer <token>
```

The current `ACCESS_KEYS` and `x-access-key` flow will be removed from the main
API path.

## Administrator Flow

After admin login, the application shows a user management area instead of the
regular generation workflow.

The admin can:

- List regular users with username, balance, and creation time.
- Create a user with username, password, and initial balance.
- Update a user's balance to an explicit value.

Admin APIs require an administrator token. Regular user tokens must receive a
forbidden response.

## Regular User Flow

After regular user login, the generation workflow is available.

The page shows:

- Current balance.
- Price for the selected model.
- A disabled or failing generate action when balance is insufficient.
- The user's own generation history.

The client may use the known model prices for display, but all billing decisions
are enforced by the server.

## Billing Flow

`/api/generate` performs the charge before starting the external generation
task:

1. Validate the bearer token and require a regular user.
2. Validate prompt and model.
3. Look up the model price from code constants.
4. In a Prisma transaction, read the user row and reject if balance is too low.
5. Deduct the price and create a `Generation` record with `chargeStatus =
   charged`.
6. Call the external generation API.
7. Store the returned `taskId` on the generation record.
8. Return the task id to the client stream.

If the external generation API fails before a `taskId` is stored, the server
refunds the charge and marks the generation as failed/refunded.

`/api/generate/status` handles completion:

- On success, upload the final image to R2, set `status = succeeded`, and keep
  `chargeStatus = charged`.
- On failure, perform an idempotent refund by updating only records currently
  in `chargeStatus = charged`; then set `chargeStatus = refunded` and
  `status = failed`.

This prevents repeated polling from refunding more than once.

## API Changes

New APIs:

- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/admin/users`
- `POST /api/admin/users`
- `PATCH /api/admin/users/:id`

Updated APIs:

- `POST /api/generate`: bearer auth, Prisma billing and generation record.
- `POST /api/generate/status`: bearer auth, Prisma status update and refund.
- `GET /api/history`: bearer auth, user-scoped Prisma history.
- Upload endpoints: bearer auth instead of access key.

Removed or obsolete APIs:

- `POST /api/auth/verify` access-key verification can be deleted or replaced by
  token verification.

## UI Changes

`AuthGate` becomes a login form with username and password fields.

Authenticated session state includes role, username, user id for regular users,
and balance where applicable.

For regular users:

- Render the existing image generation UI.
- Show balance in the header.
- Show selected model price near the model selector or generate button.
- Update balance after a successful charge or refund-aware status refresh.

For administrators:

- Render a user management view.
- Provide forms for creating users and setting balances.
- Do not show the generation form by default.

## Error Handling

- Invalid login returns `401`.
- Missing or invalid bearer token returns `401`.
- Regular user calling admin APIs returns `403`.
- Unknown model returns `400`.
- Insufficient balance returns `402` or `400` with a clear error message.
- External generation failure after charge triggers a refund path.
- Refund failures are logged and returned clearly when they block consistency.

## Testing

Core tests should be written before production code:

- Admin credentials authenticate with role `admin`.
- Regular user password verification authenticates with role `user`.
- Wrong password fails.
- Unknown model is rejected.
- Insufficient balance prevents generation.
- Successful charge deducts the configured model price.
- Failed generation refunds exactly once.
- History only returns the current user's records.
- Admin APIs reject regular users.

Verification commands:

- Targeted tests for auth and billing.
- `npm run lint`.
- `npm run build` after the migration path compiles.

## Rollout Notes

The database schema must be migrated before deployment. Existing Supabase
`generations` records are not migrated in this scope, so old gallery history may
not appear after the Prisma switch unless a later migration imports it.

Environment variables should include a session signing secret and PostgreSQL
connection details required by Prisma. `ACCESS_KEYS` should be removed from the
documented auth setup once the new login flow is active.
