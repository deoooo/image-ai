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
      const uploadPromises = images.map(async (base64Img: string, index: number) => {
        // Base64 format: "data:image/png;base64,..."
        const matches = base64Img.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          return null;
        }
        
        const contentType = matches[1];
        const buffer = Buffer.from(matches[2], "base64");
        const filename = `inputs/${Date.now()}-${index}.png`; // Simple unique name
        
        return await uploadToR2(filename, buffer, contentType);
      });
      
      const results = await Promise.all(uploadPromises);
      inputImageUrls = results.filter((url): url is string => !!url);
    }

    // 2. Call Grsai API (Streaming/Blocking)
    // The new draw method waits for the stream to finish and returns URLs
    const resultUrls = await client.draw({
      model: (model as any) || "nano-banana-fast", // Cast to match literal types
      prompt,
      aspectRatio: aspectRatio || "auto",
      imageSize: imageSize || "1K",
      urls: inputImageUrls,
    });

    const imageUrl = resultUrls[0];
    let finalImageUrl = imageUrl;

    // Note: If GrsaiClient already uploaded to R2 (image stream), finalImageUrl is already an R2 URL.
    // If it returned a URL from Grsai (JSON response), we might still want to upload it to R2 if it's not already there.
    
    // Check if it's already an R2 URL (simple check)
    const isR2Url = imageUrl.includes("r2.cloudflarestorage.com") || (process.env.R2_PUBLIC_URL && imageUrl.includes(process.env.R2_PUBLIC_URL));

    if (!isR2Url) {
       try {
        const imageRes = await fetch(imageUrl);
        const imageBuffer = await imageRes.arrayBuffer();
        const id = Date.now().toString();
        const r2Url = await uploadToR2(
          `generated/${id}.png`,
          Buffer.from(imageBuffer),
          "image/png"
        );
        finalImageUrl = r2Url;
      } catch (uploadError) {
        console.error("Failed to upload to R2, using original URL:", uploadError);
      }
    }

    // Save to Database
    // Note: We are re-enabling DB save now that we have R2 storage
    // const generation = await prisma.generation.create({
    //   data: {
    //     prompt,
    //     model: model || "nano-banana-pro",
    //     imageUrl: finalImageUrl,
    //   },
    // });

    return NextResponse.json({
      id: Date.now().toString(), // generation.id,
      url: finalImageUrl, // generation.imageUrl,
      prompt, // generation.prompt,
      model, // generation.model,
      createdAt: Date.now(), // generation.createdAt.getTime(),
    });

  } catch (error: any) {
    console.error("Generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate image" },
      { status: 500 }
    );
  }
}
