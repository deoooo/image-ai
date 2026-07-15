import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { adjustTeamBalance, recordOperation, SupabaseDataError } from "@/lib/supabase-data";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(req);
    const { id } = await params;
    const { amount, operation } = await req.json();
    if (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }
    if (operation !== "credit" && operation !== "debit") {
      return NextResponse.json({ error: "Operation must be credit or debit" }, { status: 400 });
    }
    const team = await adjustTeamBalance(id, amount, operation);
    await recordOperation({
      actorRole: "admin",
      actorUsername: session.username,
      teamId: id,
      action: operation === "credit" ? "team_balance_credited" : "team_balance_debited",
      targetType: "team",
      targetId: id,
      targetName: team.name,
      amount,
      previousValue: operation === "credit" ? team.balance - amount : team.balance + amount,
      newValue: team.balance,
    });
    return NextResponse.json({ team });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SupabaseDataError && error.code === "team_not_found") {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }
    if (error instanceof SupabaseDataError && error.code === "insufficient_balance") {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 409 });
    }
    console.error("Admin team update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
