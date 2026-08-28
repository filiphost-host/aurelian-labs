import { NextResponse } from "next/server";

export function proxy() {
  // The analytical workbench is public. Private database routes still enforce
  // authentication and row-level security independently.
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
