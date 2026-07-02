import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type PrismaErrorWithCode = {
  code?: string;
};

function hasPrismaErrorCode(error: unknown, code: string): error is PrismaErrorWithCode {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requireAdmin(req);
    const { id } = await params;
    const { balance } = await req.json();

    if (!Number.isInteger(balance) || balance < 0) {
      return NextResponse.json(
        { error: "Balance must be a non-negative integer" },
        { status: 400 }
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data: { balance },
      select: { id: true, username: true, balance: true, createdAt: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (hasPrismaErrorCode(error, "P2025")) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    console.error("Admin user update error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
