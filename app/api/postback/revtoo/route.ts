import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createMD5,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Revtoo Postback Handler
 * 
 * Parameters:
 * - subId: User ID
 * - transId: Transaction ID
 * - offer_id: Offer ID
 * - offer_name: Offer Name
 * - offer_type: Offer Type (survey, video, install, etc.)
 * - reward: Virtual currency amount
 * - reward_name: Currency name
 * - payout: Publisher earnings in USD
 * - userIp: User IP address
 * - country: Country code (ISO2)
 * - status: 1 = credit, 2 = chargeback
 * - debug: 1 = test, 0 = production
 * - signature: MD5 hash for verification
 * - reward_value: Exchange rate per dollar
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("subId") || "";
    const transactionId = searchParams.get("transId") || "";
    const offerId = searchParams.get("offer_id") || "";
    const offerName = searchParams.get("offer_name") || "Revtoo Offer";
    const offerType = searchParams.get("offer_type") || "";
    const reward = parseFloatSafe(searchParams.get("reward"));
    const rewardName = searchParams.get("reward_name") || "";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const userIp = searchParams.get("userIp") || "";
    const country = searchParams.get("country") || "";
    const status = searchParams.get("status") || "1";
    const debug = searchParams.get("debug") || "0";
    const signature = searchParams.get("signature") || "";
    const rewardValue = searchParams.get("reward_value") || "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (MD5)
    // Revtoo signature: MD5(subId + transId + reward + SECRET_KEY)
    const secretKey = process.env.REVTOO_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Revtoo: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback (status = 2)
    const isChargeback = status === "2";

    // Calculate points - use payout (USD) * 1000
    const amountUSD = payout > 0 ? payout : reward / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Revtoo",
      offerName,
      offerId,
      offerType,
      points: isChargeback ? points : points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      isDebug: debug === "1",
    });

    if (!result.success) {
      console.error("Revtoo postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Revtoo postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  // Revtoo can send via POST as well
  try {
    const adminDb = getAdminDb();
    const body = await request.json().catch(() => ({}));
    
    // Extract from body or fall back to URL params
    const { searchParams } = new URL(request.url);
    
    const userId = body.subId || searchParams.get("subId") || "";
    const transactionId = body.transId || searchParams.get("transId") || "";
    const offerId = body.offer_id || searchParams.get("offer_id") || "";
    const offerName = body.offer_name || searchParams.get("offer_name") || "Revtoo Offer";
    const offerType = body.offer_type || searchParams.get("offer_type") || "";
    const reward = parseFloatSafe(body.reward || searchParams.get("reward"));
    const payout = parseFloatSafe(body.payout || searchParams.get("payout"));
    const userIp = body.userIp || searchParams.get("userIp") || "";
    const country = body.country || searchParams.get("country") || "";
    const status = body.status || searchParams.get("status") || "1";
    const debug = body.debug || searchParams.get("debug") || "0";
    const signature = body.signature || searchParams.get("signature") || "";

    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature
    const secretKey = process.env.REVTOO_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${reward}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Revtoo: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    const isChargeback = status === "2";
    const amountUSD = payout > 0 ? payout : reward / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Revtoo",
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
      console.error("Revtoo postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Revtoo POST postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}
