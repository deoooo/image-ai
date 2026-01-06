import { NextResponse } from "next/server";
import { GrsaiClient } from "@/lib/grsai";
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

    // Create a stream for real-time updates
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: any) => {
          controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"));
        };

        try {
          const client = new GrsaiClient();

          // 1. Use provided image URLs
          let inputImageUrls: string[] = [];
          if (images && Array.isArray(images) && images.length > 0) {
            send({ type: "log", message: "Using uploaded input images..." });
            inputImageUrls = images;
          }

          // 2. Call Grsai API with Retry Logic
          let taskId: string | null = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            attempts++;
            try {
              if (attempts > 1) {
                send({
                  type: "log",
                  message: `Requesting generation (Attempt ${attempts}/${maxAttempts})...`,
                });
              } else {
                send({ type: "log", message: "Requesting generation..." });
              }

              taskId = await client.draw({
                model: (model as any) || "nano-banana-pro",
                prompt,
                aspectRatio: aspectRatio || "auto",
                imageSize: imageSize || "1K",
                urls: inputImageUrls,
              });

              // If successful, break the loop
              break;
            } catch (err: any) {
              console.error(`Attempt ${attempts} failed:`, err);
              if (attempts === maxAttempts) {
                // Determine if we should throw or just report error
                throw new Error(
                  `Failed after ${maxAttempts} attempts: ${err.message}`
                );
              }
              // Wait before retry (exponential backoff or fixed)
              send({
                type: "log",
                message: `Generation request failed, retrying in 2s...`,
              });
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          if (!taskId) {
            throw new Error("Failed to obtain Task ID");
          }

          send({ type: "log", message: "Task started successfully." });

          // 3. Save to Supabase (fire and forget from stream's perspective, or await)
          // We can await it to ensure DB is consistent before sending final result
          const { supabaseAdmin } = await import("@/lib/supabase");
          if (supabaseAdmin) {
            await supabaseAdmin.from("generations").insert({
              task_id: taskId,
              prompt,
              model,
              status: "pending",
            });
          }

          // 4. Send Result
          send({
            type: "result",
            taskId,
            status: "pending",
            prompt,
            model,
          });
        } catch (error: any) {
          console.error("Stream processing error:", error);
          send({
            type: "error",
            message: error.message || "Internal Server Error",
          });
        } finally {
          controller.close();
        }
      },
    });

    return new NextResponse(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
