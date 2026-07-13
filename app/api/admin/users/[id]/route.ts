import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { adjustUserBalance, SupabaseDataError } from "@/lib/supabase-data";

function isValidAmount(amount: unknown): amount is number {
  return typeof amount === "number" && Number.isFinite(amount) && amount > 0;
}

function isValidOperation(operation: unknown): operation is "credit" | "debit" {
  return operation === "credit" || operation === "debit";
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { amount, operation } = await req.json();

    if (!isValidAmount(amount)) {
      return NextResponse.json(
        { error: "Amount must be greater than zero" },
        { status: 400 }
      );
    }

    if (!isValidOperation(operation)) {
      return NextResponse.json(
        { error: "Operation must be credit or debit" },
        { status: 400 }
      );
    }

    const user = await adjustUserBalance(id, amount, operation);

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
