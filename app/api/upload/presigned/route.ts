import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";
import { getPresignedUrl } from "@/lib/r2";

type PresignedUploadRequestBody = {
  filename?: unknown;
  contentType?: unknown;
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export async function POST(req: Request) {
  try {
    requireUser(req);

    const body = (await req.json()) as PresignedUploadRequestBody;
    const filename = typeof body.filename === "string" ? body.filename : null;
    const contentType =
      typeof body.contentType === "string" ? body.contentType : null;

    if (!filename || !contentType) {
      return NextResponse.json(
        { error: "Filename and content type are required" },
        { status: 400 }
      );
    }

    const { uploadUrl, publicUrl } = await getPresignedUrl(filename, contentType);
    return NextResponse.json({ uploadUrl, publicUrl });
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Upload URL generation error:", error);
    return NextResponse.json(
      { error: getErrorMessage(error, "Failed to generate upload URL") },
      { status: 500 }
    );
  }
}
