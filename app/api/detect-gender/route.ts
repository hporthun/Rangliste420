import { detectGender } from "@/lib/import/detect-gender";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("name") ?? "";
  const result = detectGender(name);
  return NextResponse.json(result);
}
