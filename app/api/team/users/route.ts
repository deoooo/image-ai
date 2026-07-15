import { NextResponse } from "next/server";
import { ApiAuthError, requireTeamAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";
import { createTeamUser, listTeamUsers, recordOperation, SupabaseDataError } from "@/lib/supabase-data";

export async function GET(req: Request) {
  try {
    const session = requireTeamAdmin(req);
    return NextResponse.json({ users: await listTeamUsers(session.teamId) });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Team users list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = requireTeamAdmin(req);
    const { username, password, dailyLimit } = await req.json();
    const normalized = typeof username === "string" ? username.trim() : "";
    if (!normalized || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    if (["lynn", "deo"].includes(normalized.toLowerCase())) {
      return NextResponse.json({ error: "Username is reserved" }, { status: 409 });
    }
    if (typeof dailyLimit !== "number" || !Number.isFinite(dailyLimit) || dailyLimit < 0) {
      return NextResponse.json({ error: "Daily limit must be non-negative" }, { status: 400 });
    }
    const user = await createTeamUser({
      teamId: session.teamId,
      username: normalized,
      passwordHash: await hashPassword(password),
      dailyLimit,
    });
    await recordOperation({
      actorRole: "team_admin",
      actorUsername: session.username,
      actorUserId: session.userId,
      teamId: session.teamId,
      action: "team_member_created",
      targetType: "team_member",
      targetId: user.id,
      targetName: user.username,
      newValue: dailyLimit,
    });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SupabaseDataError && error.code === "duplicate_username") {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    console.error("Team user create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
