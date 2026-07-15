import { NextResponse } from "next/server";
import { ApiAuthError, requireAdmin } from "@/lib/api-auth";
import { listOperationLogs } from "@/lib/supabase-data";

export async function GET(req: Request) {
  try {
    requireAdmin(req);
    return NextResponse.json({ operations: await listOperationLogs() });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Admin operation log list error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
