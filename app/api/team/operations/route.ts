import { NextResponse } from "next/server";
import { ApiAuthError, requireTeamAdmin } from "@/lib/api-auth";
import { listOperationLogs } from "@/lib/supabase-data";

export async function GET(req: Request) {
  try {
    const session = requireTeamAdmin(req);
    return NextResponse.json({ operations: await listOperationLogs(session.teamId) });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Team operation log list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
