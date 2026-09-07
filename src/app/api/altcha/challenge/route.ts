import { NextResponse } from "next/server";
import { createAltchaChallenge } from "@/lib/altcha";
import { getAuthSecret } from "@/lib/auth";

export const runtime = "nodejs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-altcha-response",
  "Cache-Control": "no-store, no-cache, must-revalidate",
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const maxNumberParam = url.searchParams.get("maxnumber");
    const maxNumber = maxNumberParam ? Math.min(Math.max(Number(maxNumberParam) || 50_000, 10_000), 200_000) : 50_000;

    let hmacKey = getAuthSecret();
    if (!hmacKey) {
      hmacKey = "formforge_altcha_secret_fallback_key";
    }

    const challenge = await createAltchaChallenge({
      hmacKey,
      maxNumber,
      expiresSeconds: 900, // 15 minutes
    });

    return NextResponse.json(challenge, {
      headers: corsHeaders,
    });
  } catch (error) {
    console.error("Failed to generate ALTCHA challenge:", error);
    return NextResponse.json(
      { error: "Internal server error generating ALTCHA challenge" },
      { status: 500, headers: corsHeaders }
    );
  }
}
