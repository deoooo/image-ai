import { NextResponse } from "next/server";
import { ApiAuthError, requireTeamAdmin } from "@/lib/api-auth";
import { recordOperation, SupabaseDataError, updateTeamUserDailyLimit } from "@/lib/supabase-data";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireTeamAdmin(req);
    const { id } = await params;
    const { dailyLimit } = await req.json();
    if (typeof dailyLimit !== "number" || !Number.isFinite(dailyLimit) || dailyLimit < 0) {
      return NextResponse.json({ error: "Daily limit must be non-negative" }, { status: 400 });
    }
    const user = await updateTeamUserDailyLimit(session.teamId, id, dailyLimit);
    await recordOperation({
      actorRole: "team_admin",
      actorUsername: session.username,
      actorUserId: session.userId,
      teamId: session.teamId,
      action: "member_daily_limit_updated",
      targetType: "team_member",
      targetId: user.id,
      targetName: user.username,
      newValue: dailyLimit,
    });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SupabaseDataError && error.code === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    console.error("Team user update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
