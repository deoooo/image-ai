import { NextResponse } from "next/server";
import { ApiAuthError, requireUser } from "@/lib/api-auth";
import { isBuiltInUserId } from "@/lib/built-in-user";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const session = requireUser(req);
    if (isBuiltInUserId(session.userId)) {
      return NextResponse.json([]);
    }

    const generations = await prisma.generation.findMany({
      where: {
        userId: session.userId,
        status: "succeeded",
        imageUrl: { not: null },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return NextResponse.json(
      generations.map((generation) => ({
        id: generation.taskId || generation.id,
        url: generation.imageUrl || undefined,
        prompt: generation.prompt,
        model: generation.model,
        createdAt: generation.createdAt.getTime(),
      }))
    );
  } catch (error) {
    if (error instanceof ApiAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Error fetching history:", error);
    return NextResponse.json({ error: "Failed to fetch history" }, { status: 500 });
  }
}
