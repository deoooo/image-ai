import { supabaseAdmin } from "@/lib/supabase";

const USERS_TABLE = "image_ai_users";
const GENERATIONS_TABLE = "image_ai_generations";
const TEAMS_TABLE = "image_ai_teams";
const OPERATION_LOGS_TABLE = "image_ai_operation_logs";
const OPERATION_LOGS_VIEW = "image_ai_operation_logs_with_team";

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
  role: "user" | "team_admin";
  team_id: string | null;
  daily_limit: number | null;
  daily_spent: number;
  daily_spent_date: string | null;
};

type PublicUserRow = Omit<UserRow, "password_hash">;

type TeamRow = {
  id: string;
  name: string;
  balance: number;
  created_at: string;
};

type OperationLogRow = {
  id: string;
  actor_role: "admin" | "team_admin";
  actor_username: string;
  team_id: string | null;
  team_name: string | null;
  action: string;
  target_type: string;
  target_id: string | null;
  target_name: string;
  amount: number | null;
  previous_value: number | null;
  new_value: number | null;
  created_at: string;
};

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
  role: "user" | "team_admin";
  teamId: string | null;
  dailyLimit: number | null;
  dailySpent: number;
  dailySpentDate: string | null;
};

export type Team = {
  id: string;
  name: string;
  balance: number;
  createdAt: string;
};

export type OperationLog = {
  id: string;
  actorRole: "admin" | "team_admin";
  actorUsername: string;
  teamId: string | null;
  teamName: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  targetName: string;
  amount: number | null;
  previousValue: number | null;
  newValue: number | null;
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
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value;
  const today = `${get("year")}-${get("month")}-${get("day")}`;
  return {
    id: row.id,
    username: row.username,
    balance: Number(row.balance),
    createdAt: row.created_at,
    role: row.role ?? "user",
    teamId: row.team_id ?? null,
    dailyLimit: row.daily_limit == null ? null : Number(row.daily_limit),
    dailySpent:
      row.daily_spent_date === today && row.daily_spent != null
        ? Number(row.daily_spent)
        : 0,
    dailySpentDate: row.daily_spent_date ?? null,
  };
}

function mapTeam(row: TeamRow): Team {
  return {
    id: row.id,
    name: row.name,
    balance: Number(row.balance),
    createdAt: row.created_at,
  };
}

function mapOperationLog(row: OperationLogRow): OperationLog {
  return {
    id: row.id,
    actorRole: row.actor_role,
    actorUsername: row.actor_username,
    teamId: row.team_id,
    teamName: row.team_name,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    targetName: row.target_name,
    amount: row.amount == null ? null : Number(row.amount),
    previousValue: row.previous_value == null ? null : Number(row.previous_value),
    newValue: row.new_value == null ? null : Number(row.new_value),
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

  if (/daily_limit_exceeded/i.test(error.message ?? "")) {
    throw new SupabaseDataError("Daily limit exceeded", "daily_limit_exceeded");
  }

  if (/team_not_found/i.test(error.message ?? "")) {
    throw new SupabaseDataError("Team not found", "team_not_found");
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
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
    .is("team_id", null)
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
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
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
    .select("id, username, password_hash, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
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
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
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
}): Promise<{
  generationId: string;
  priceCharged: number;
  balance: number;
  dailySpent?: number;
  dailyLimit?: number;
}> {
  const result = (await supabaseAdmin.rpc("image_ai_charge_for_generation", {
    p_user_id: userId,
    p_prompt: prompt,
    p_model: model,
    p_price: price,
  })) as SupabaseResult<
    Array<{
      generation_id: string;
      price_charged: number;
      balance: number;
      daily_spent: number | null;
      daily_limit: number | null;
    }>
  >;

  const row = firstRpcRow(result);
  return {
    generationId: row.generation_id,
    priceCharged: Number(row.price_charged),
    balance: Number(row.balance),
    dailySpent: row.daily_spent == null ? undefined : Number(row.daily_spent),
    dailyLimit: row.daily_limit == null ? undefined : Number(row.daily_limit),
  };
}

export async function listTeams(): Promise<Team[]> {
  const result = (await supabaseAdmin
    .from(TEAMS_TABLE)
    .select("id, name, balance, created_at")
    .order("created_at", { ascending: false })) as SupabaseResult<TeamRow[]>;

  return assertNoError(result).map(mapTeam);
}

export async function findTeamById(id: string): Promise<Team | null> {
  const result = (await supabaseAdmin
    .from(TEAMS_TABLE)
    .select("id, name, balance, created_at")
    .eq("id", id)
    .maybeSingle()) as SupabaseResult<TeamRow>;

  if (result.error) throwDataError(result.error);
  return result.data ? mapTeam(result.data) : null;
}

export async function createTeamWithAdmin({
  name,
  balance,
  adminUsername,
  adminPasswordHash,
}: {
  name: string;
  balance: number;
  adminUsername: string;
  adminPasswordHash: string;
}): Promise<{ team: Team; admin: PublicUser }> {
  const result = (await supabaseAdmin.rpc("image_ai_create_team_with_admin", {
    p_name: name,
    p_balance: balance,
    p_admin_username: adminUsername,
    p_admin_password_hash: adminPasswordHash,
  })) as SupabaseResult<Array<TeamRow & {
    admin_id: string;
    admin_username: string;
    admin_created_at: string;
  }>>;
  const row = firstRpcRow(result);
  return {
    team: mapTeam(row),
    admin: {
      id: row.admin_id,
      username: row.admin_username,
      balance: 0,
      createdAt: row.admin_created_at,
      role: "team_admin",
      teamId: row.id,
      dailyLimit: null,
      dailySpent: 0,
      dailySpentDate: null,
    },
  };
}

export async function adjustTeamBalance(
  id: string,
  amount: number,
  operation: "credit" | "debit"
): Promise<Team> {
  const result = (await supabaseAdmin.rpc("image_ai_adjust_team_balance", {
    p_team_id: id,
    p_amount: amount,
    p_operation: operation,
  })) as SupabaseResult<TeamRow[]>;
  return mapTeam(firstRpcRow(result));
}

export async function listTeamUsers(teamId: string): Promise<PublicUser[]> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
    .eq("team_id", teamId)
    .order("created_at", { ascending: false })) as SupabaseResult<PublicUserRow[]>;
  return assertNoError(result).map(mapPublicUser);
}

export async function createTeamUser({
  teamId,
  username,
  passwordHash,
  dailyLimit,
  role = "user",
}: {
  teamId: string;
  username: string;
  passwordHash: string;
  dailyLimit: number | null;
  role?: "user" | "team_admin";
}): Promise<PublicUser> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .insert({
      username,
      password_hash: passwordHash,
      balance: 0,
      role,
      team_id: teamId,
      daily_limit: role === "user" ? dailyLimit : null,
    })
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
    .single()) as SupabaseResult<PublicUserRow>;
  return mapPublicUser(assertNoError(result));
}

export async function updateTeamUserDailyLimit(
  teamId: string,
  userId: string,
  dailyLimit: number
): Promise<PublicUser> {
  const result = (await supabaseAdmin
    .from(USERS_TABLE)
    .update({ daily_limit: dailyLimit })
    .eq("id", userId)
    .eq("team_id", teamId)
    .eq("role", "user")
    .select("id, username, balance, created_at, role, team_id, daily_limit, daily_spent, daily_spent_date")
    .single()) as SupabaseResult<PublicUserRow>;
  return mapPublicUser(assertNoError(result));
}

export async function recordOperation({
  actorRole,
  actorUsername,
  actorUserId = null,
  teamId = null,
  action,
  targetType,
  targetId = null,
  targetName,
  amount = null,
  previousValue = null,
  newValue = null,
}: {
  actorRole: "admin" | "team_admin";
  actorUsername: string;
  actorUserId?: string | null;
  teamId?: string | null;
  action: string;
  targetType: string;
  targetId?: string | null;
  targetName: string;
  amount?: number | null;
  previousValue?: number | null;
  newValue?: number | null;
}): Promise<void> {
  const result = (await supabaseAdmin
    .from(OPERATION_LOGS_TABLE)
    .insert({
      actor_role: actorRole,
      actor_username: actorUsername,
      actor_user_id: actorUserId,
      team_id: teamId,
      action,
      target_type: targetType,
      target_id: targetId,
      target_name: targetName,
      amount,
      previous_value: previousValue,
      new_value: newValue,
    })
    .select("id")
    .single()) as SupabaseResult<{ id: string }>;
  assertNoError(result);
}

export async function listOperationLogs(teamId?: string): Promise<OperationLog[]> {
  let query = supabaseAdmin
    .from(OPERATION_LOGS_VIEW)
    .select("id, actor_role, actor_username, team_id, team_name, action, target_type, target_id, target_name, amount, previous_value, new_value, created_at");
  if (teamId) query = query.eq("team_id", teamId);
  const result = (await query
    .order("created_at", { ascending: false })
    .limit(100)) as SupabaseResult<OperationLogRow[]>;
  return assertNoError(result).map(mapOperationLog);
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
