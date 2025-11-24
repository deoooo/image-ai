import { NextResponse } from "next/server";
import { validateAccessKey } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { key } = await req.json();
    
    if (validateAccessKey(key)) {
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: "Invalid key" }, { status: 401 });
    }
  } catch (error) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
