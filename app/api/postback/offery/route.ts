import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createMD5,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Offery Postback Handler
 * 
 * Sends data via HTTP POST:
 * - subId: User unique ID
 * - transId: Unique transaction ID
 * - offer_id: Completed offer ID
 * - offer_name: Offer name
 * - offer_type: Offer type (ptc, offer, task, shortlink)
 * - reward: Virtual currency amount to add
 * - reward_name: Your currency name
 * - reward_value: Currency units per $1
 * - payout: Offer earnings in USD
 * - userIp: User IP address
 * - country: User country (ISO2)
 * - status: 1 for credit, 2 for chargeback
 * - debug: 1 for test, 0 for production
 * - signature: MD5 hash for verification
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("subId") || searchParams.get("user_id") || "";
    const transactionId = searchParams.get("transId") || searchParams.get("transaction_id") || "";
    const offerId = searchParams.get("offer_id") || "";
    const offerName = searchParams.get("offer_name") || "Offery Offer";
    const offerType = searchParams.get("offer_type") || "";
    const reward = parseFloatSafe(searchParams.get("reward"));
    const rewardName = searchParams.get("reward_name") || "";
    const rewardValue = searchParams.get("reward_value") || "";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const userIp = searchParams.get("userIp") || searchParams.get("ip") || "";
    const country = searchParams.get("country") || "";
    const status = searchParams.get("status") || "1";
    const debug = searchParams.get("debug") || "0";
    const signature = searchParams.get("signature") || "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (MD5)
    // Offery signature: MD5(subId + transId + reward + SECRET_KEY)
    const secretKey = process.env.OFFERY_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Offery: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback (status = 2)
    const isChargeback = status === "2";

    // Calculate USD amount and points
    const amountUSD = payout > 0 ? payout : reward / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Offery",
      offerName,
      offerId,
      offerType,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      isDebug: debug === "1",
    });

    if (!result.success) {
      console.error("Offery postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Offery postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  // Offery sends via POST
  try {
    const adminDb = getAdminDb();
    const body = await request.json().catch(() => ({}));
    
    // Extract from body
    const userId = body.subId || body.user_id || "";
    const transactionId = body.transId || body.transaction_id || "";
    const offerId = body.offer_id || "";
    const offerName = body.offer_name || "Offery Offer";
    const offerType = body.offer_type || "";
    const reward = parseFloatSafe(body.reward);
    const payout = parseFloatSafe(body.payout);
    const userIp = body.userIp || body.ip || "";
    const country = body.country || "";
    const status = body.status || "1";
    const debug = body.debug || "0";
    const signature = body.signature || "";

    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature
    const secretKey = process.env.OFFERY_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Offery: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    const isChargeback = status === "2" || status === 2;
    const amountUSD = payout > 0 ? payout : reward / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Offery",
      offerName,
      offerId,
      offerType,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      isDebug: debug === "1" || debug === 1,
    });

    if (!result.success) {
      console.error("Offery postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Offery POST postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}
