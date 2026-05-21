import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

/**
 * For dashboard / human-only API routes. Returns `userId` or a 401 JSON response.
 */
export async function requireClerkUserId(): Promise<string | NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return userId;
}
