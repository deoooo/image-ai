import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";
import {
  BillingError,
  chargeForGeneration,
  refundGeneration,
} from "@/lib/billing";
import { GrsaiClient } from "@/lib/grsai";
import { prisma } from "@/lib/prisma";

type GenerateRequestBody = {
  prompt?: unknown;
  model?: unknown;
  images?: unknown;
  aspectRatio?: unknown;
  imageSize?: unknown;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: Request) {
  let generationId: string | null = null;

  try {
    const session = requireUser(req);
    const body = (await req.json()) as GenerateRequestBody;
    const prompt = typeof body.prompt === "string" ? body.prompt : null;
    const model =
      typeof body.model === "string" ? body.model : "nano-banana-pro";
    const inputImageUrls = Array.isArray(body.images)
      ? body.images.filter((image): image is string => typeof image === "string")
      : [];
    const aspectRatio =
      typeof body.aspectRatio === "string" ? body.aspectRatio : "auto";
    const imageSize = typeof body.imageSize === "string" ? body.imageSize : "1K";

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const charge = await chargeForGeneration({
      userId: session.userId,
      prompt,
      model,
    });
    generationId = charge.generationId;
    const drawModel = model as "nano-banana-fast" | "nano-banana-pro";

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: unknown) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(data)}\n`));
        };
        let acceptedTaskId: string | null = null;

        try {
          const client = new GrsaiClient();

          if (inputImageUrls.length > 0) {
            send({ type: "log", message: "Using uploaded input images..." });
          }

          let taskId: string | null = null;
          let attempts = 0;
          const maxAttempts = 3;

          while (attempts < maxAttempts) {
            attempts += 1;

            try {
              send({
                type: "log",
                message:
                  attempts > 1
                    ? `Requesting generation (Attempt ${attempts}/${maxAttempts})...`
                    : "Requesting generation...",
              });

              taskId = await client.draw({
                model: drawModel,
                prompt,
                aspectRatio,
                imageSize: imageSize as "1K" | "2K" | "4K",
                urls: inputImageUrls,
              });
              acceptedTaskId = taskId;
              break;
            } catch (error) {
              console.error(`Attempt ${attempts} failed:`, error);

              if (attempts === maxAttempts) {
                throw new Error(
                  `Failed after ${maxAttempts} attempts: ${getErrorMessage(
                    error,
                    "Unknown generation error"
                  )}`
                );
              }

              send({
                type: "log",
                message: "Generation request failed, retrying in 2s...",
              });
              await new Promise((resolve) => setTimeout(resolve, 2000));
            }
          }

          if (!taskId) {
            throw new Error("Failed to obtain Task ID");
          }

          try {
            await prisma.generation.update({
              where: { id: charge.generationId },
              data: { taskId, status: "pending" },
            });
          } catch (error) {
            console.error(
              "Provider accepted generation task but persistence failed:",
              {
                generationId: charge.generationId,
                taskId,
                error,
              }
            );
            throw error;
          }

          send({ type: "log", message: "Task started successfully." });
          send({
            type: "result",
            taskId,
            generationId: charge.generationId,
            status: "pending",
            prompt,
            model,
            balance: charge.balance,
            priceCharged: charge.priceCharged,
          });
        } catch (error) {
          console.error("Stream processing error:", error);

          if (generationId && !acceptedTaskId) {
            await refundGeneration(generationId);
          } else if (generationId && acceptedTaskId) {
            console.error("Skipping refund because provider task is already in flight:", {
              generationId,
              taskId: acceptedTaskId,
            });
          }

          send({
            type: "error",
            message: getErrorMessage(error, "Internal Server Error"),
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
  } catch (error) {
    if (error instanceof ApiAuthError || error instanceof BillingError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Generation error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to generate image") },
      { status: 500 }
    );
  }
}
