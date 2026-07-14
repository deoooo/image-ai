import { NextResponse } from "next/server";
import { createSessionToken, verifyAdminCredentials } from "@/lib/auth";
import { BUILT_IN_USER, verifyBuiltInUserCredentials } from "@/lib/built-in-user";
import { verifyPassword } from "@/lib/password";
import { findUserByUsername } from "@/lib/supabase-data";

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

    if (username === BUILT_IN_USER.username) {
      if (!verifyBuiltInUserCredentials(username, password)) {
        return NextResponse.json(
          { error: "Invalid username or password" },
          { status: 401 }
        );
      }

      const token = createSessionToken({
        role: "user",
        userId: BUILT_IN_USER.id,
        username: BUILT_IN_USER.username,
      });
      return NextResponse.json({
        token,
        user: {
          role: "user",
          id: BUILT_IN_USER.id,
          username: BUILT_IN_USER.username,
          balance: BUILT_IN_USER.balance,
        },
      });
    }

    const user = await findUserByUsername(username);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 }
      );
    }

    if (user.role === "team_admin" && user.teamId) {
      const token = createSessionToken({
        role: "team_admin",
        userId: user.id,
        username: user.username,
        teamId: user.teamId,
      });
      return NextResponse.json({
        token,
        user: {
          role: "team_admin",
          id: user.id,
          username: user.username,
          teamId: user.teamId,
        },
      });
    }

    const token = createSessionToken({ role: "user", userId: user.id, username: user.username });
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
