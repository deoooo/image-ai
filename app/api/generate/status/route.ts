import { NextResponse } from "next/server";
import { GrsaiClient } from "@/lib/grsai";
import { validateAccessKey } from "@/lib/auth";
import { fetchWithProxy } from "@/lib/http";

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

    // If succeeded, update Supabase
    if (
      result.status === "succeeded" &&
      result.results &&
      result.results.length > 0
    ) {
      const imageUrl = result.results[0].url;

      // Upload to R2
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
          console.log("Uploaded generated image to R2:", finalImageUrl);

          // Update result url in response so frontend uses R2 url immediately
          result.results[0].url = finalImageUrl;
        }
      } catch (err) {
        console.error("Failed to upload generated image to R2:", err);
      }

      import("@/lib/supabase")
        .then(async ({ supabaseAdmin }) => {
          if (supabaseAdmin) {
            await supabaseAdmin
              .from("generations")
              .update({
                status: "succeeded",
                image_url: finalImageUrl,
              })
              .eq("task_id", taskId);
          }
        })
        .catch((err) => console.error("Failed to update Supabase:", err));
    } else if (result.status === "failed") {
      import("@/lib/supabase")
        .then(async ({ supabaseAdmin }) => {
          if (supabaseAdmin) {
            await supabaseAdmin
              .from("generations")
              .update({
                status: "failed",
              })
              .eq("task_id", taskId);
          }
        })
        .catch((err) => console.error("Failed to update Supabase:", err));
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Status check error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to check status" },
      { status: 500 }
    );
  }
}
