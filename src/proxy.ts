import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { readClerkConfig } from "@/shared/config/clerk";

export async function proxy(request: NextRequest, event: NextFetchEvent) {
  if (!readClerkConfig(process.env).configured) {
    return NextResponse.next();
  }
  const { clerkMiddleware } = await import("@clerk/nextjs/server");
  return clerkMiddleware()(request, event);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
