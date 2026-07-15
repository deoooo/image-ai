import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";
import { createTeamUser, findTeamById, recordOperation, SupabaseDataError } from "@/lib/supabase-data";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(req);
    const { id } = await params;
    const team = await findTeamById(id);
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    const { username, password } = await req.json();
    const normalized = typeof username === "string" ? username.trim() : "";
    if (!normalized || typeof password !== "string" || !password) {
      return NextResponse.json({ error: "Username and password are required" }, { status: 400 });
    }
    if (["lynn", "deo"].includes(normalized.toLowerCase())) {
      return NextResponse.json({ error: "Username is reserved" }, { status: 409 });
    }
    const admin = await createTeamUser({
      teamId: id,
      username: normalized,
      passwordHash: await hashPassword(password),
      dailyLimit: null,
      role: "team_admin",
    });
    await recordOperation({
      actorRole: "admin",
      actorUsername: session.username,
      teamId: id,
      action: "team_admin_created",
      targetType: "team_admin",
      targetId: admin.id,
      targetName: admin.username,
    });
    return NextResponse.json({ admin }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SupabaseDataError && error.code === "duplicate_username") {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }
    console.error("Admin team admin create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
