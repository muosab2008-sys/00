import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Flex Wall Postback Handler
 * 
 * Parameters (uses {macro} format):
 * - user_id: User unique ID in your platform
 * - offer_name: Completed offer name
 * - amount: Currency amount to add to user
 * - payout: Publisher earnings in USD
 * - user_ip: User IP address
 * - tixid: Unique conversion ID from Flex Wall
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("user_id") || "";
    const offerName = searchParams.get("offer_name") || "FlexWall Offer";
    const amount = parseFloatSafe(searchParams.get("amount"));
    const payout = parseFloatSafe(searchParams.get("payout"));
    const userIp = searchParams.get("user_ip") || searchParams.get("ip") || "";
    const transactionId = searchParams.get("tixid") || searchParams.get("transaction_id") || "";

    // Validate required fields
    if (!userId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Generate transaction ID if not provided
    const txId = transactionId || `flexwall_${userId}_${Date.now()}`;

    // Calculate USD amount and points
    // Payout is in USD, amount is in app currency
    const amountUSD = payout > 0 ? payout : amount / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId: txId,
      offerwall: "FlexWall",
      offerName,
      points,
      amountUSD,
      userIp,
      isChargeback: false, // FlexWall doesn't send chargebacks via same endpoint
    });

    if (!result.success) {
      console.error("FlexWall postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("FlexWall postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
