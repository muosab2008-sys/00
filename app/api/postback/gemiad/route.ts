import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createSHA256,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * GemiAd Postback Handler
 * 
 * Parameters (uses {MACRO} format):
 * - USER_ID: User ID in your system
 * - OFFER_ID: Offer ID
 * - OFFER_NAME: Completed offer name
 * - EVENT_ID: Event ID (for multi-stage offers)
 * - EVENT_NAME: Event name (e.g., "Reached Level 10")
 * - PAYOUT: Total earnings in USD (negative for rejections)
 * - REWARD: App currency reward (negative for rejections)
 * - TXID: Unique transaction ID
 * - STATUS: "completed" or "rejected"
 * - IPADDR: User IP address
 * - SUB1: Additional source ID
 * - SUB2: Secondary source ID
 * - HASH: SHA-256 verification hash
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters (GemiAd uses uppercase or lowercase)
    const userId = searchParams.get("USER_ID") || searchParams.get("user_id") || "";
    const offerId = searchParams.get("OFFER_ID") || searchParams.get("offer_id") || "";
    const offerName = searchParams.get("OFFER_NAME") || searchParams.get("offer_name") || "GemiAd Offer";
    const eventId = searchParams.get("EVENT_ID") || searchParams.get("event_id") || "";
    const eventName = searchParams.get("EVENT_NAME") || searchParams.get("event_name") || "";
    const payout = parseFloatSafe(searchParams.get("PAYOUT") || searchParams.get("payout"));
    const reward = parseFloatSafe(searchParams.get("REWARD") || searchParams.get("reward"));
    const transactionId = searchParams.get("TXID") || searchParams.get("txid") || "";
    const status = (searchParams.get("STATUS") || searchParams.get("status") || "completed").toLowerCase();
    const userIp = searchParams.get("IPADDR") || searchParams.get("ipaddr") || searchParams.get("ip") || "";
    const sub1 = searchParams.get("SUB1") || searchParams.get("sub1") || "";
    const sub2 = searchParams.get("SUB2") || searchParams.get("sub2") || "";
    const hash = searchParams.get("HASH") || searchParams.get("hash") || "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (SHA-256)
    // GemiAd signature: SHA256(USER_ID + TXID + PAYOUT + SECRET_KEY)
    const secretKey = process.env.GEMIAD_SECRET_KEY || "";
    if (secretKey && hash) {
      const expectedHash = createSHA256(`${userId}${transactionId}${payout}${secretKey}`);
      if (hash.toLowerCase() !== expectedHash.toLowerCase()) {
        console.error("GemiAd: Invalid hash");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback (status = "rejected" or negative payout)
    const isChargeback = status === "rejected" || payout < 0;

    // Calculate points - use absolute value of payout
    const amountUSD = Math.abs(payout);
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Build offer name with event if available
    const fullOfferName = eventName ? `${offerName} - ${eventName}` : offerName;

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "GemiAd",
      offerName: fullOfferName,
      offerId,
      points,
      amountUSD,
      userIp,
      isChargeback,
      eventId,
      eventName,
      sub1,
      sub2,
    });

    if (!result.success) {
      console.error("GemiAd postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("GemiAd postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
