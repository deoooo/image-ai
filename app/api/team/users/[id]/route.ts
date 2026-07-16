import { NextResponse } from "next/server";
import { ApiAuthError, requireTeamAdmin } from "@/lib/api-auth";
import { recordOperation, SupabaseDataError, updateTeamUserDailyLimit } from "@/lib/supabase-data";
import { isValidMoney, normalizeMoney } from "@/lib/money";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireTeamAdmin(req);
    const { id } = await params;
    const { dailyLimit } = await req.json();
    if (!isValidMoney(dailyLimit)) {
      return NextResponse.json(
        { error: "Daily limit must be non-negative with at most 3 decimal places" },
        { status: 400 }
      );
    }
    const normalizedDailyLimit = normalizeMoney(dailyLimit);
    const user = await updateTeamUserDailyLimit(session.teamId, id, normalizedDailyLimit);
    await recordOperation({
      actorRole: "team_admin",
      actorUsername: session.username,
      actorUserId: session.userId,
      teamId: session.teamId,
      action: "member_daily_limit_updated",
      targetType: "team_member",
      targetId: user.id,
      targetName: user.username,
      newValue: normalizedDailyLimit,
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
