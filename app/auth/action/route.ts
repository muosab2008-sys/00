import { NextRequest, NextResponse } from "next/server";

// Firebase Auth Action Handler
// This route handles Firebase authentication actions like:
// - Email verification
// - Password reset
// - Email change confirmation

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  
  const mode = searchParams.get("mode");
  const oobCode = searchParams.get("oobCode");
  const apiKey = searchParams.get("apiKey");
  const continueUrl = searchParams.get("continueUrl");
  const lang = searchParams.get("lang") || "en";

  // Build redirect URL based on mode
  let redirectPath = "/login";

  switch (mode) {
    case "resetPassword":
      // Redirect to password reset page with the oobCode
      redirectPath = `/reset-password?oobCode=${oobCode}&mode=${mode}`;
      break;
    
    case "verifyEmail":
      // Redirect to email verification handler
      redirectPath = `/verify-email?oobCode=${oobCode}&mode=${mode}`;
      break;
    
    case "recoverEmail":
      // Redirect to email recovery handler
      redirectPath = `/recover-email?oobCode=${oobCode}&mode=${mode}`;
      break;
    
    default:
      // Unknown mode, redirect to login
      redirectPath = "/login";
  }

  // Redirect to the appropriate page
  return NextResponse.redirect(new URL(redirectPath, request.url));
}

export async function POST(request: NextRequest) {
  return GET(request);
}
