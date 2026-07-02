import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

type PrismaErrorWithCode = {
  code?: string;
};

function hasPrismaErrorCode(error: unknown, code: string): error is PrismaErrorWithCode {
  return typeof error === "object" && error !== null && "code" in error && error.code === code;
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: { id: true, username: true, balance: true, createdAt: true },
    });
    return NextResponse.json({ users });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin users list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    requireAdmin(req);
    const { username, password, balance } = await req.json();

    if (typeof username !== "string" || username.trim().length < 1) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < 1) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!Number.isInteger(balance) || balance < 0) {
      return NextResponse.json(
        { error: "Balance must be a non-negative integer" },
        { status: 400 }
      );
    }

    const user = await prisma.user.create({
      data: {
        username: username.trim(),
        passwordHash: await hashPassword(password),
        balance,
      },
      select: { id: true, username: true, balance: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (hasPrismaErrorCode(error, "P2002")) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    console.error("Admin user create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
