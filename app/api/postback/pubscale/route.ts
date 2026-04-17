import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createSHA256,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * PubScale Postback Handler
 * 
 * S2S Callbacks with custom mobile parameters:
 * - app_id: App unique ID (8 digits)
 * - user_id: User unique ID for tracking
 * - idfa: iOS advertising ID (optional)
 * - ga_id: Android advertising ID (optional)
 * - offer_id: Offer ID
 * - offer_name: Offer name
 * - payout: Publisher earnings in USD
 * - reward: User reward amount
 * - transaction_id: Unique transaction ID
 * - signature: SHA256 verification hash
 * - status: Transaction status
 * - ip: User IP address
 * - country: User country
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const appId = searchParams.get("app_id") || "";
    const userId = searchParams.get("user_id") || "";
    const idfa = searchParams.get("idfa") || "";
    const gaId = searchParams.get("ga_id") || searchParams.get("gaid") || "";
    const offerId = searchParams.get("offer_id") || "";
    const offerName = searchParams.get("offer_name") || "PubScale Offer";
    const payout = parseFloatSafe(searchParams.get("payout"));
    const reward = parseFloatSafe(searchParams.get("reward"));
    const transactionId = searchParams.get("transaction_id") || searchParams.get("txid") || "";
    const signature = searchParams.get("signature") || searchParams.get("hash") || "";
    const status = (searchParams.get("status") || "completed").toLowerCase();
    const userIp = searchParams.get("ip") || "";
    const country = searchParams.get("country") || "";
    const eventName = searchParams.get("event_name") || searchParams.get("goal") || "";

    // Validate required fields
    if (!userId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Generate transaction ID if not provided
    const txId = transactionId || `pubscale_${offerId}_${userId}_${Date.now()}`;

    // Verify signature (SHA256) if provided
    // PubScale signature: SHA256(user_id + transaction_id + payout + SECRET_KEY)
    const secretKey = process.env.PUBSCALE_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createSHA256(`${userId}${txId}${payout}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("PubScale: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback
    const isChargeback = status === "rejected" || status === "reversed" || status === "chargeback";

    // Calculate USD amount and points
    // Payout is in USD, reward is in app currency
    const amountUSD = payout > 0 ? payout : reward / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Build full offer name with event if available
    const fullOfferName = eventName ? `${offerName} - ${eventName}` : offerName;

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId: txId,
      offerwall: "PubScale",
      offerName: fullOfferName,
      offerId,
      eventName,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
    });

    if (!result.success) {
      console.error("PubScale postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("PubScale postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
