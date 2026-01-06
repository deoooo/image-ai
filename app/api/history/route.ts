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
    // Fetch from Supabase
    // dynamic import to avoid build errors if env vars missing during build
    const { supabaseAdmin } = await import("@/lib/supabase");

    if (!supabaseAdmin) {
      console.error("Supabase client not initialized");
      return NextResponse.json(
        { error: "Service unavailable" },
        { status: 503 }
      );
    }

    const { data: generations, error } = await supabaseAdmin
      .from("generations")
      .select("*")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    // Map to frontend type
    const history = generations.map((gen: any) => ({
      id: gen.task_id,
      url: gen.image_url,
      prompt: gen.prompt,
      model: gen.model,
      createdAt: new Date(gen.created_at).getTime(),
    }));

    return NextResponse.json(history);
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
