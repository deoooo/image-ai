import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateAccessKey } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const key = req.headers.get("x-access-key");
  if (!validateAccessKey(key)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // const generations = await prisma.generation.findMany({
    //   orderBy: {
    //     createdAt: "desc",
    //   },
    //   take: 50, // Limit to last 50 generations
    // });

    // // Map to frontend type
    // const history = generations.map((gen: any) => ({
    //   id: gen.id,
    //   url: gen.imageUrl,
    //   prompt: gen.prompt,
    //   model: gen.model,
    //   createdAt: gen.createdAt.getTime(),
    // }));

    return NextResponse.json([]);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
