import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { adjustUserBalance, recordOperation, SupabaseDataError } from "@/lib/supabase-data";
import { addMoney, isValidMoney, normalizeMoney, subtractMoney } from "@/lib/money";

function isValidAmount(amount: unknown): amount is number {
  return isValidMoney(amount, { positive: true });
}

function isValidOperation(operation: unknown): operation is "credit" | "debit" {
  return operation === "credit" || operation === "debit";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = requireAdmin(req);
    const { id } = await params;
    const { amount, operation } = await req.json();

    if (!isValidAmount(amount)) {
      return NextResponse.json(
        { error: "Amount must be greater than zero with at most 3 decimal places" },
        { status: 400 }
      );
    }

    if (!isValidOperation(operation)) {
      return NextResponse.json(
        { error: "Operation must be credit or debit" },
        { status: 400 }
      );
    }

    const normalizedAmount = normalizeMoney(amount);
    const user = await adjustUserBalance(id, normalizedAmount, operation);
    await recordOperation({
      actorRole: "admin",
      actorUsername: session.username,
      action: operation === "credit" ? "user_balance_credited" : "user_balance_debited",
      targetType: "user",
      targetId: user.id,
      targetName: user.username,
      amount: normalizedAmount,
      previousValue:
        operation === "credit"
          ? subtractMoney(user.balance, normalizedAmount)
          : addMoney(user.balance, normalizedAmount),
      newValue: user.balance,
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof SupabaseDataError && error.code === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (
      error instanceof SupabaseDataError &&
      error.code === "insufficient_balance"
    ) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 409 });
    }

    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
