import { NextResponse } from "next/server";
import { getPresignedUrl } from "@/lib/r2";
import { validateAccessKey } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const key = req.headers.get("x-access-key");
    if (!validateAccessKey(key)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { filename, contentType } = body;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename and content type are required" },
        { status: 400 }
      );
    }

    const { uploadUrl, publicUrl } = await getPresignedUrl(
      filename,
      contentType
    );

    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error: any) {
    console.error("Upload URL generation error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate upload URL" },
      { status: 500 }
    );
  }
}
