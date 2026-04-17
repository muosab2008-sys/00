import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createMD5,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Adlexy Postback Handler
 * 
 * Sends HTTP POST requests with:
 * - subId: Your user unique ID
 * - transId: Unique transaction ID
 * - reward: Value to add in your currency
 * - payout: Revenue from completing offer
 * - reward_name: Rewarded currency name
 * - offer_name: Completed offer name
 * - offerid: Offer ID
 * - userIp: User IP address
 * - country: User country code
 * - status: Transaction status (1 for valid, 2 for chargeback)
 * - debug: Debug flag (0 for production)
 * - signature: MD5 verification hash
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("subId") || searchParams.get("user_id") || "";
    const transactionId = searchParams.get("transId") || searchParams.get("transaction_id") || "";
    const reward = parseFloatSafe(searchParams.get("reward"));
    const payout = parseFloatSafe(searchParams.get("payout"));
    const rewardName = searchParams.get("reward_name") || "";
    const offerName = searchParams.get("offer_name") || "Adlexy Offer";
    const offerId = searchParams.get("offerid") || searchParams.get("offer_id") || "";
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
    // Adlexy signature: MD5(subId + transId + reward + SECRET_KEY)
    const secretKey = process.env.ADLEXY_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Adlexy: Invalid signature");
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
      offerwall: "Adlexy",
      offerName,
      offerId,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      isDebug: debug === "1",
    });

    if (!result.success) {
      console.error("Adlexy postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Adlexy postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  // Adlexy sends via POST
  try {
    const adminDb = getAdminDb();
    const body = await request.json().catch(() => ({}));
    
    // Extract from body
    const userId = body.subId || body.user_id || "";
    const transactionId = body.transId || body.transaction_id || "";
    const reward = parseFloatSafe(body.reward);
    const payout = parseFloatSafe(body.payout);
    const offerName = body.offer_name || "Adlexy Offer";
    const offerId = body.offerid || body.offer_id || "";
    const userIp = body.userIp || body.ip || "";
    const country = body.country || "";
    const status = body.status || "1";
    const debug = body.debug || "0";
    const signature = body.signature || "";

    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature
    const secretKey = process.env.ADLEXY_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Adlexy: Invalid signature");
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
      offerwall: "Adlexy",
      offerName,
      offerId,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      isDebug: debug === "1" || debug === 1,
    });

    if (!result.success) {
      console.error("Adlexy postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Adlexy POST postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}
