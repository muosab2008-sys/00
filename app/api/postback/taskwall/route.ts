import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Taskwall Postback Handler
 * 
 * Parameters (uses {macro} format):
 * - app_name: Your app name
 * - userid: User unique ID
 * - password: Postback password (for verification)
 * - user_amount: Virtual currency reward amount
 * - offer_name: Completed offer name
 * - offer_id: Offer ID
 * - payout: Offer earnings in USD
 * - ip_address: User IP address
 * - currency_name: Currency name from app settings
 * - date: Offer completion date
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const appName = searchParams.get("app_name") || "";
    const userId = searchParams.get("userid") || searchParams.get("user_id") || "";
    const password = searchParams.get("password") || "";
    const userAmount = parseFloatSafe(searchParams.get("user_amount"));
    const offerName = searchParams.get("offer_name") || "Taskwall Offer";
    const offerId = searchParams.get("offer_id") || "";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const userIp = searchParams.get("ip_address") || searchParams.get("ip") || "";
    const currencyName = searchParams.get("currency_name") || "";
    const date = searchParams.get("date") || "";

    // Generate unique transaction ID
    const transactionId = offerId 
      ? `taskwall_${offerId}_${userId}_${Date.now()}` 
      : `taskwall_${userId}_${Date.now()}`;

    // Validate required fields
    if (!userId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify password if configured
    const secretPassword = process.env.TASKWALL_PASSWORD || "";
    if (secretPassword && password !== secretPassword) {
      console.error("Taskwall: Invalid password");
      return new NextResponse("invalid_password", { status: 403 });
    }

    // Calculate USD amount and points
    // Payout is in USD, user_amount is in app currency
    const amountUSD = payout > 0 ? payout : userAmount / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Taskwall",
      offerName,
      offerId,
      points,
      amountUSD,
      userIp,
      isChargeback: false, // Taskwall doesn't send chargebacks via same endpoint
    });

    if (!result.success) {
      console.error("Taskwall postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Taskwall postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
