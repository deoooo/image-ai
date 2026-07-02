import { NextResponse } from "next/server";
import { ApiAuthError, requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
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

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true, balance: true },
    });

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
