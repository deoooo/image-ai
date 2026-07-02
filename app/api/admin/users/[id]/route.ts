import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

type PrismaErrorWithCode = {
  code?: string;
};

function hasPrismaErrorCode(error: unknown, code: string): error is PrismaErrorWithCode {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

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
