import { NextResponse } from "next/server";
import { GrsaiClient } from "@/lib/grsai";
import { prisma } from "@/lib/prisma";
import { validateAccessKey } from "@/lib/auth";
import { uploadToR2 } from "@/lib/r2";

export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-access-key");
    if (!validateAccessKey(key)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { prompt, model, images, aspectRatio, imageSize } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    const client = new GrsaiClient();

    // 1. Upload input images to R2 if present (to get public URLs for Grsai)
    let inputImageUrls: string[] = [];
    if (images && images.length > 0) {
      const uploadPromises = images.map(
        async (base64Img: string, index: number) => {
          // Base64 format: "data:image/png;base64,..."
          const matches = base64Img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (!matches || matches.length !== 3) {
            return null;
          }

          const contentType = matches[1];
          const buffer = Buffer.from(matches[2], "base64");
          const filename = `inputs/${Date.now()}-${index}.png`; // Simple unique name

          return await uploadToR2(filename, buffer, contentType);
        }
      );

      const results = await Promise.all(uploadPromises);
      inputImageUrls = results.filter((url): url is string => !!url);
    }

    // 2. Call Grsai API to initiate generation (returns task ID immediately)
    const taskId = await client.draw({
      model: (model as any) || "nano-banana-pro",
      prompt,
      aspectRatio: aspectRatio || "auto",
      imageSize: imageSize || "1K",
      urls: inputImageUrls,
    });

    console.log("Generation task created:", taskId);

    // Save to Supabase (non-blocking)
    import("@/lib/supabase")
      .then(async ({ supabaseAdmin }) => {
        if (supabaseAdmin) {
          await supabaseAdmin.from("generations").insert({
            task_id: taskId,
            prompt,
            model,
            status: "pending",
          });
        }
      })
      .catch((err) => console.error("Failed to save to Supabase:", err));

    // Return task ID immediately for frontend polling
    return NextResponse.json({
      taskId,
      status: "pending",
      prompt,
      model,
    });
  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
