import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createMD5,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Wannads Postback Handler
 * 
 * Parameters (uses {} format in GET):
 * - user_id: User unique ID
 * - reward: Currency amount (negative for rejections)
 * - status: "credited" for addition, "rejected" for deduction
 * - offer_id: Offer ID
 * - offer_name: Offer name
 * - aff_sub to aff_sub4: Optional values passed by publisher
 * - goal_id / goal_name: Goal ID and name for multi-goal offers
 * - transaction_id: Unique transaction code
 * - ip: User IP address
 * - payout: Offer earnings in USD
 * - signature: MD5 hash for verification
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("user_id") || "";
    const reward = parseFloatSafe(searchParams.get("reward"));
    const status = (searchParams.get("status") || "credited").toLowerCase();
    const offerId = searchParams.get("offer_id") || "";
    const offerName = searchParams.get("offer_name") || "Wannads Offer";
    const affSub1 = searchParams.get("aff_sub") || searchParams.get("aff_sub1") || "";
    const affSub2 = searchParams.get("aff_sub2") || "";
    const affSub3 = searchParams.get("aff_sub3") || "";
    const affSub4 = searchParams.get("aff_sub4") || "";
    const goalId = searchParams.get("goal_id") || "";
    const goalName = searchParams.get("goal_name") || "";
    const transactionId = searchParams.get("transaction_id") || "";
    const userIp = searchParams.get("ip") || "";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const signature = searchParams.get("signature") || "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (MD5)
    // Wannads signature: MD5(user_id + transaction_id + reward + SECRET_KEY)
    const secretKey = process.env.WANNADS_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Wannads: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback (status = "rejected" or negative reward)
    const isChargeback = status === "rejected" || reward < 0;

    // Calculate USD amount - use payout if available, otherwise derive from reward
    let amountUSD = payout > 0 ? payout : Math.abs(reward) / USD_TO_POINTS;
    const points = Math.round(Math.abs(amountUSD) * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Build full offer name with goal if available
    const fullOfferName = goalName ? `${offerName} - ${goalName}` : offerName;

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Wannads",
      offerName: fullOfferName,
      offerId,
      eventId: goalId,
      eventName: goalName,
      points,
      amountUSD: Math.abs(amountUSD),
      userIp,
      isChargeback,
      sub1: affSub1,
      sub2: affSub2,
    });

    if (!result.success) {
      console.error("Wannads postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Wannads postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
