import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createSHA1,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Playtime SDK Postback Handler
 * 
 * Parameters (automatically appended to URL):
 * - user_id: User unique ID from your app
 * - offer_id: Offer ID
 * - offer_name: Offer name (game name)
 * - payout: Publisher earnings per stage
 * - amount: Reward amount for end user
 * - signature: SHA1 hash for verification
 * - task_name: Task name (e.g., "Reach Level X")
 * - task_id: Task ID
 * - currency_name: Currency name from settings
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("user_id") || "";
    const offerId = searchParams.get("offer_id") || "";
    const offerName = searchParams.get("offer_name") || "Playtime Offer";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const amount = parseFloatSafe(searchParams.get("amount"));
    const signature = searchParams.get("signature") || "";
    const taskName = searchParams.get("task_name") || "";
    const taskId = searchParams.get("task_id") || "";
    const currencyName = searchParams.get("currency_name") || "";

    // Generate unique transaction ID using offer_id + task_id + user_id
    const transactionId = taskId 
      ? `playtime_${offerId}_${taskId}_${userId}` 
      : `playtime_${offerId}_${userId}_${Date.now()}`;

    // Validate required fields
    if (!userId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (SHA1)
    // Playtime signature: SHA1(user_id + offer_id + payout + SECRET_KEY)
    const secretKey = process.env.PLAYTIME_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createSHA1(`${userId}${offerId}${payout}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Playtime: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Calculate USD amount and points
    // Payout is in USD, amount is in app currency
    const amountUSD = payout > 0 ? payout : amount / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Build full offer name with task if available
    const fullOfferName = taskName ? `${offerName} - ${taskName}` : offerName;

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Playtime",
      offerName: fullOfferName,
      offerId,
      eventId: taskId,
      eventName: taskName,
      points,
      amountUSD,
      isChargeback: false, // Playtime doesn't send chargebacks via same endpoint
    });

    if (!result.success) {
      console.error("Playtime postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Playtime postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
