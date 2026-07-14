import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";
import {
  createTeamWithAdmin,
  listTeams,
  SupabaseDataError,
} from "@/lib/supabase-data";

function validNonNegative(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    return NextResponse.json({ teams: await listTeams() });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin teams list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const { name, balance, adminUsername, adminPassword } = await req.json();
    const normalizedName = typeof name === "string" ? name.trim() : "";
    const normalizedUsername =
      typeof adminUsername === "string" ? adminUsername.trim() : "";

    if (!normalizedName || !normalizedUsername || typeof adminPassword !== "string" || !adminPassword) {
      return NextResponse.json(
        { error: "Team name, admin username, and password are required" },
        { status: 400 }
      );
    }
    if (["lynn", "deo"].includes(normalizedUsername.toLowerCase())) {
      return NextResponse.json({ error: "Username is reserved" }, { status: 409 });
    }
    if (!validNonNegative(balance)) {
      return NextResponse.json({ error: "Balance must be non-negative" }, { status: 400 });
    }

    const result = await createTeamWithAdmin({
      name: normalizedName,
      balance,
      adminUsername: normalizedUsername,
      adminPasswordHash: await hashPassword(adminPassword),
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SupabaseDataError && error.code === "duplicate_username") {
      return NextResponse.json({ error: "Team or username already exists" }, { status: 409 });
    }
    console.error("Admin team create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
