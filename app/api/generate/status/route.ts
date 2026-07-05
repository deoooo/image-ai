import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";
import { refundGeneration } from "@/lib/billing";
import { GrsaiClient } from "@/lib/grsai";
import { fetchWithProxy } from "@/lib/http";
import {
  findGenerationByTaskIdForUser,
  markGenerationSucceeded,
} from "@/lib/supabase-data";

type StatusRequestBody = {
  taskId?: unknown;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: Request) {
  try {
    const session = requireUser(req);
    const body = (await req.json()) as StatusRequestBody;
    const taskId = typeof body.taskId === "string" ? body.taskId : null;

    if (!taskId) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const generation = await findGenerationByTaskIdForUser(taskId, session.userId);

    if (!generation) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const client = new GrsaiClient();
    const result = await client.getResult(taskId);

    if (result.status === "succeeded" && result.results && result.results.length > 0) {
      const imageUrl = result.results[0].url;
      let finalImageUrl = imageUrl;

      try {
        const { uploadToR2 } = await import("@/lib/r2");
        const imageRes = await fetchWithProxy(imageUrl);

        if (imageRes.ok) {
          const arrayBuffer = await imageRes.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          const r2Key = `generations/${
            new Date().toISOString().split("T")[0]
          }/${taskId}.png`;

          finalImageUrl = await uploadToR2(r2Key, buffer, "image/png");
          result.results[0].url = finalImageUrl;
        }
      } catch (error) {
        console.error("Failed to upload generated image to R2:", error);
      }

      await markGenerationSucceeded(generation.id, finalImageUrl);
    } else if (result.status === "failed") {
      const refund = await refundGeneration(generation.id);
      return NextResponse.json({ ...result, balance: refund.balance });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Status check error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to check status") },
      { status: 500 }
    );
  }
}
