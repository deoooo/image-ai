import { supabaseAdmin } from "@/lib/supabase";

const USERS_TABLE = "image_ai_users";
const GENERATIONS_TABLE = "image_ai_generations";

type SupabaseResult<T> = {
  data: T | null;
  error: { code?: string; message?: string } | null;
};

type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  balance: number;
  created_at: string;
};

type PublicUserRow = Pick<UserRow, "id" | "username" | "balance" | "created_at">;

type GenerationRow = {
  id: string;
  task_id: string | null;
  prompt: string;
  model: string;
  image_url: string | null;
  status: string;
  user_id: string;
  price_charged: number;
  charge_status: string;
  created_at: string;
};

export type PublicUser = {
  id: string;
  username: string;
  balance: number;
  createdAt: string;
};

export type StoredUser = PublicUser & {
  passwordHash: string;
};

export type StoredGeneration = {
  id: string;
  taskId: string | null;
  prompt: string;
  model: string;
  imageUrl: string | null;
  status?: string;
  userId?: string;
  priceCharged?: number;
  chargeStatus?: string;
  createdAt: string;
};

export class SupabaseDataError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = "SupabaseDataError";
  }
}

function mapPublicUser(row: PublicUserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    balance: Number(row.balance),
    createdAt: row.created_at,
  };
}

function mapStoredUser(row: UserRow): StoredUser {
  return {
    ...mapPublicUser(row),
    passwordHash: row.password_hash,
  };
}

function mapGeneration(row: GenerationRow): StoredGeneration {
  return {
    id: row.id,
    taskId: row.task_id,
    prompt: row.prompt,
    model: row.model,
    imageUrl: row.image_url,
    status: row.status,
    userId: row.user_id,
    priceCharged: Number(row.price_charged),
    chargeStatus: row.charge_status,
    createdAt: row.created_at,
  };
}

function isDuplicateError(error: { code?: string; message?: string }): boolean {
  return error.code === "23505" || /duplicate/i.test(error.message ?? "");
}

function isNotFoundError(error: { code?: string; message?: string }): boolean {
  return (
    error.code === "PGRST116" ||
    /0 rows|user_not_found/i.test(error.message ?? "")
  );
}

function throwDataError(error: { code?: string; message?: string }): never {
  if (isDuplicateError(error)) {
    throw new SupabaseDataError("Username already exists", "duplicate_username");
  }

  if (isNotFoundError(error)) {
    throw new SupabaseDataError("User not found", "not_found");
  }

  if (/insufficient_balance/i.test(error.message ?? "")) {
    throw new SupabaseDataError("Insufficient balance", "insufficient_balance");
  }

  throw new SupabaseDataError(error.message || "Supabase request failed", "supabase_error");
}

function assertNoError<T>(result: SupabaseResult<T>): T {
  if (result.error) {
    throwDataError(result.error);
  }

  if (result.data === null) {
    throw new SupabaseDataError("Supabase request returned no data", "no_data");
  }

  return result.data;
}

function firstRpcRow<T>(result: SupabaseResult<T[]>): T {
  const data = assertNoError(result);
  const row = data[0];

  if (!row) {
    throw new SupabaseDataError("Supabase RPC returned no rows", "no_data");
  }

  return row;
}

export async function listUsers(): Promise<PublicUser[]> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, username, balance, created_at")
    .order("created_at", { ascending: false })) as SupabaseResult<PublicUserRow[]>;

  return assertNoError(result).map(mapPublicUser);
}

export async function createUser({
  username,
  passwordHash,
  balance,
}: {
  username: string;
  passwordHash: string;
  balance: number;
}): Promise<PublicUser> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .insert({
      username,
      password_hash: passwordHash,
      balance,
    })
    .select("id, username, balance, created_at")
    .single()) as SupabaseResult<PublicUserRow>;

  return mapPublicUser(assertNoError(result));
}

export async function adjustUserBalance(
  id: string,
  amount: number,
  operation: "credit" | "debit"
): Promise<PublicUser> {
  const result = (await supabaseAdmin.rpc("image_ai_adjust_user_balance", {
    p_user_id: id,
    p_amount: amount,
    p_operation: operation,
  })) as SupabaseResult<PublicUserRow[]>;

  return mapPublicUser(firstRpcRow(result));
}

export async function findUserByUsername(username: string): Promise<StoredUser | null> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, username, password_hash, balance, created_at")
    .eq("username", username)
    .maybeSingle()) as SupabaseResult<UserRow>;

  if (result.error) {
    throwDataError(result.error);
  }

  return result.data ? mapStoredUser(result.data) : null;
}

export async function findUserById(id: string): Promise<PublicUser | null> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, username, balance, created_at")
    .eq("id", id)
    .maybeSingle()) as SupabaseResult<PublicUserRow>;

  if (result.error) {
    throwDataError(result.error);
  }

  return result.data ? mapPublicUser(result.data) : null;
}

export async function chargeGeneration({
  userId,
  prompt,
  model,
  price,
}: {
  userId: string;
  prompt: string;
  model: string;
  price: number;
}): Promise<{ generationId: string; priceCharged: number; balance: number }> {
  const result = (await supabaseAdmin.rpc("image_ai_charge_for_generation", {
    p_user_id: userId,
    p_prompt: prompt,
    p_model: model,
    p_price: price,
  })) as SupabaseResult<
    Array<{ generation_id: string; price_charged: number; balance: number }>
  >;

  const row = firstRpcRow(result);
  return {
    generationId: row.generation_id,
    priceCharged: Number(row.price_charged),
    balance: Number(row.balance),
  };
}

export async function refundChargedGeneration(
  generationId: string
): Promise<{ refunded: boolean; balance?: number }> {
  const result = (await supabaseAdmin.rpc("image_ai_refund_generation", {
    p_generation_id: generationId,
  })) as SupabaseResult<Array<{ refunded: boolean; balance: number | null }>>;

  const row = firstRpcRow(result);
  return {
    refunded: Boolean(row.refunded),
    balance: row.balance === null ? undefined : Number(row.balance),
  };
}

export async function attachTaskToGeneration(
  generationId: string,
  taskId: string
): Promise<void> {
  const result = (await supabaseAdmin
    .from(GENERATIONS_TABLE)
    .update({ task_id: taskId, status: "pending" })
    .eq("id", generationId)
    .select("id")
    .single()) as SupabaseResult<{ id: string }>;

  assertNoError(result);
}

export async function findGenerationByTaskIdForUser(
  taskId: string,
  userId: string
): Promise<StoredGeneration | null> {
  const result = (await supabaseAdmin
    .from(GENERATIONS_TABLE)
    .select(
      "id, task_id, prompt, model, image_url, status, user_id, price_charged, charge_status, created_at"
    )
    .eq("task_id", taskId)
    .eq("user_id", userId)
    .maybeSingle()) as SupabaseResult<GenerationRow>;

  if (result.error) {
    throwDataError(result.error);
  }

  return result.data ? mapGeneration(result.data) : null;
}

export async function markGenerationSucceeded(
  generationId: string,
  imageUrl: string
): Promise<void> {
  const result = (await supabaseAdmin
    .from(GENERATIONS_TABLE)
    .update({ status: "succeeded", image_url: imageUrl })
    .eq("id", generationId)
    .select("id")
    .single()) as SupabaseResult<{ id: string }>;

  assertNoError(result);
}

export async function listSucceededGenerations(
  userId: string,
  limit: number
): Promise<StoredGeneration[]> {
  const result = (await supabaseAdmin
    .from(GENERATIONS_TABLE)
    .select(
      "id, task_id, prompt, model, image_url, status, user_id, price_charged, charge_status, created_at"
    )
    .eq("user_id", userId)
    .eq("status", "succeeded")
    .not("image_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)) as SupabaseResult<GenerationRow[]>;

  return assertNoError(result).map(mapGeneration);
}
