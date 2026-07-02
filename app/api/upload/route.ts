import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    requireUser(request);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
        tokenPayload: JSON.stringify({}),
      }),
      onUploadCompleted: async ({ blob }) => {
        console.log("blob uploaded", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
