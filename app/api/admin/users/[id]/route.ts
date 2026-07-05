import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { SupabaseDataError, updateUserBalance } from "@/lib/supabase-data";

function isValidBalance(balance: unknown): balance is number {
  return typeof balance === "number" && Number.isFinite(balance) && balance >= 0;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { balance } = await req.json();

    if (!isValidBalance(balance)) {
      return NextResponse.json(
        { error: "Balance must be a non-negative number" },
        { status: 400 }
      );
    }

    const user = await updateUserBalance(id, balance);

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (error instanceof SupabaseDataError && error.code === "not_found") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
