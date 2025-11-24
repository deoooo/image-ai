import { NextResponse } from "next/server";
import { GrsaiClient } from "@/lib/grsai";
import { validateAccessKey } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-access-key");
    if (!validateAccessKey(key)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { taskId } = body;

    if (!taskId) {
      return NextResponse.json(
        { error: "Task ID is required" },
        { status: 400 }
      );
    }

    const client = new GrsaiClient();
    const result = await client.getResult(taskId);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check status" },
      { status: 500 }
    );
  }
}
