import { NextResponse } from "next/server";
import { ApiAuthError, requireSession } from "@/lib/api-auth";
import { BUILT_IN_USER, isBuiltInUserId } from "@/lib/built-in-user";
import { findUserById } from "@/lib/supabase-data";
import { listModelPrices } from "@/lib/model-pricing";

export async function GET(req: Request) {
  try {
    const session = requireSession(req);

    if (session.role === "admin") {
      return NextResponse.json({
        user: { role: "admin", username: session.username },
        modelPrices: listModelPrices(),
      });
    }

    if (isBuiltInUserId(session.userId)) {
      return NextResponse.json({
        user: {
          role: "user",
          id: BUILT_IN_USER.id,
          username: BUILT_IN_USER.username,
          balance: BUILT_IN_USER.balance,
        },
        modelPrices: listModelPrices(),
      });
    }

    const user = await findUserById(session.userId);

    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json({
      user: { role: "user", id: user.id, username: user.username, balance: user.balance },
      modelPrices: listModelPrices(),
    });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Me error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
