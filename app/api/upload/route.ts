import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { validateAccessKey } from "@/lib/auth";

export async function POST(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const queryKey = url.searchParams.get("key");
  const headerKey = request.headers.get("x-access-key");
  
  if (!validateAccessKey(headerKey || queryKey)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Optional: Authenticate user here
        // const user = await auth(request);
        // if (!user) {
        //   throw new Error('Unauthorized');
        // }
        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          tokenPayload: JSON.stringify({
            // optional, sent to your server on upload completion
            // userId: user.id,
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Optional: Run code after upload completes
        console.log("blob uploaded", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }, // The webhook will retry 5 times automatically if the status code is 500-599
    );
  }
}
