import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST():
Promise<NextResponse> {
  const response =
    NextResponse.json({
      success: true,
      message: "Signed out successfully.",
    });

  /*
   * Delete the authentication session.
   *
   * maxAge: 0 tells the browser that this
   * cookie should expire immediately.
   */
  response.cookies.set(
    "bugbounty_session",
    "",
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite: "lax",

      path: "/",

      maxAge: 0,
    }
  );

  return response;
}