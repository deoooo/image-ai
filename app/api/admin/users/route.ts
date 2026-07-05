import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { BUILT_IN_USER } from "@/lib/built-in-user";
import { hashPassword } from "@/lib/password";
import { SupabaseDataError, createUser, listUsers } from "@/lib/supabase-data";

function isValidBalance(balance: unknown): balance is number {
  return typeof balance === "number" && Number.isFinite(balance) && balance >= 0;
}

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    const users = await listUsers();
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

    const normalizedUsername = typeof username === "string" ? username.trim() : "";

    if (normalizedUsername.length < 1) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    if (normalizedUsername.toLowerCase() === "lynn") {
      return NextResponse.json({ error: "Username is reserved" }, { status: 409 });
    }

    if (
      normalizedUsername === BUILT_IN_USER.username &&
      password === BUILT_IN_USER.password &&
      balance === BUILT_IN_USER.balance
    ) {
      return NextResponse.json(
        {
          user: {
            id: BUILT_IN_USER.id,
            username: BUILT_IN_USER.username,
            balance: BUILT_IN_USER.balance,
            createdAt: new Date(0).toISOString(),
          },
        },
        { status: 201 }
      );
    }

    if (typeof password !== "string" || password.length < 1) {
      return NextResponse.json({ error: "Password is required" }, { status: 400 });
    }

    if (!isValidBalance(balance)) {
      return NextResponse.json(
        { error: "Balance must be a non-negative number" },
        { status: 400 }
      );
    }

    const user = await createUser({
      username: normalizedUsername,
      passwordHash: await hashPassword(password),
      balance,
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    if (
      error instanceof SupabaseDataError &&
      error.code === "duplicate_username"
    ) {
      return NextResponse.json({ error: "Username already exists" }, { status: 409 });
    }

    console.error("Admin user create error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
