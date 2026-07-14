import { NextResponse } from "next/server";
import { ApiAuthError, requireSession } from "@/lib/api-auth";
import { BUILT_IN_USER, isBuiltInUserId } from "@/lib/built-in-user";
import { findTeamById, findUserById } from "@/lib/supabase-data";
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

    if (session.role === "team_admin") {
      const [admin, team] = await Promise.all([
        findUserById(session.userId),
        findTeamById(session.teamId),
      ]);
      if (
        !admin ||
        admin.role !== "team_admin" ||
        admin.teamId !== session.teamId ||
        !team
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.json({
        user: {
          role: "team_admin",
          id: admin.id,
          username: admin.username,
          teamId: team.id,
          teamName: team.name,
          teamBalance: team.balance,
        },
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

    if (user.role !== "user") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let balance = user.balance;
    let teamName: string | undefined;
    if (user.teamId) {
      const team = await findTeamById(user.teamId);
      if (!team) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      balance = team.balance;
      teamName = team.name;
    }

    const dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const getDatePart = (type: Intl.DateTimeFormatPartTypes) =>
      dateParts.find((part) => part.type === type)?.value;
    const today = `${getDatePart("year")}-${getDatePart("month")}-${getDatePart("day")}`;

    return NextResponse.json({
      user: {
        role: "user",
        id: user.id,
        username: user.username,
        balance,
        ...(user.teamId
          ? {
              teamId: user.teamId,
              teamName,
              dailyLimit: user.dailyLimit ?? 0,
              dailySpent: user.dailySpentDate === today ? user.dailySpent : 0,
            }
          : {}),
      },
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
