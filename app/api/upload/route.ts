import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";

function normalizeUserScopedPath(pathname: string, userId: string): string {
  const cleanedSegments = pathname
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .filter((segment) => segment !== "." && segment !== "..");

  const relativeSegments =
    cleanedSegments[0] === "users"
      ? cleanedSegments.slice(Math.min(cleanedSegments.length, 2))
      : cleanedSegments;

  if (relativeSegments.length === 0) {
    throw new Error("Upload pathname is required");
  }

  return `users/${userId}/${relativeSegments.join("/")}`;
}

export async function POST(request: Request): Promise<NextResponse> {
  let session: ReturnType<typeof requireUser>;

  try {
    session = requireUser(request);
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    throw error;
  }

  const body = (await request.json()) as HandleUploadBody;

  if (body.type === "blob.generate-client-token") {
    body.payload.pathname = normalizeUserScopedPath(
      body.payload.pathname,
      session.userId
    );
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const normalizedPathname = normalizeUserScopedPath(pathname, session.userId);

        if (pathname !== normalizedPathname) {
          throw new Error("Upload pathname must stay within the authenticated user scope");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
          tokenPayload: JSON.stringify({ userId: session.userId }),
        };
      },
      onUploadCompleted: async ({ blob }) => {
        console.log("blob uploaded", blob.url);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 400 });
  }
}
