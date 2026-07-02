import { NextResponse } from "next/server";
import { createSessionToken, verifyAdminCredentials } from "@/lib/auth";
import { verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

const ADMIN_USERNAME = "lynn";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 }
      );
    }

    if (username === ADMIN_USERNAME) {
      if (!verifyAdminCredentials(username, password)) {
        return NextResponse.json(
          { error: "Invalid username or password" },
          { status: 401 }
        );
      }

      const token = createSessionToken({ role: "admin", username });
      return NextResponse.json({ token, user: { role: "admin", username } });
    }

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    const token = createSessionToken({
      role: "user",
      userId: user.id,
      username: user.username,
    });
    return NextResponse.json({
      token,
      user: {
        role: "user",
        id: user.id,
        username: user.username,
        balance: user.balance,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
