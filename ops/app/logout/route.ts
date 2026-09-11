import { NextResponse } from "next/server";
import { createUserClient } from "@/lib/auth";

export async function POST(req: Request) {
  const client = await createUserClient();
  if (client) await client.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
export const GET = POST;
