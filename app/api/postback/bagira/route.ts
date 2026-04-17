import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  createMD5,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Bagira Wall Postback Handler
 * 
 * Parameters (uses {macro} format):
 * - user_id: User unique ID
 * - amount: Calculated currency amount
 * - currency: Virtual currency name
 * - revenue: Publisher earnings in USD
 * - transaction_id: Unique hash for completion
 * - offer_title: Completed offer name
 * - offer_id: Network offer ID
 * - status: 1 for credit, 2 for chargeback
 * - ip_address: User IP address
 * - country_code: Two-letter country code
 * - timestamp: Unix timestamp of completion
 * - sig: MD5 signature for verification
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const userId = searchParams.get("user_id") || "";
    const amount = parseFloatSafe(searchParams.get("amount"));
    const currency = searchParams.get("currency") || "";
    const revenue = parseFloatSafe(searchParams.get("revenue"));
    const transactionId = searchParams.get("transaction_id") || "";
    const offerTitle = searchParams.get("offer_title") || "Bagira Offer";
    const offerId = searchParams.get("offer_id") || "";
    const status = searchParams.get("status") || "1";
    const userIp = searchParams.get("ip_address") || searchParams.get("ip") || "";
    const country = searchParams.get("country_code") || "";
    const timestamp = searchParams.get("timestamp") || "";
    const signature = searchParams.get("sig") || searchParams.get("signature") || "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Verify signature (MD5)
    // Bagira signature: MD5(user_id + transaction_id + revenue + SECRET_KEY)
    const secretKey = process.env.BAGIRA_SECRET_KEY || "";
    if (secretKey && signature) {
      const expectedSignature = createMD5(`${userId}${transactionId}${revenue}${secretKey}`);
      if (signature.toLowerCase() !== expectedSignature.toLowerCase()) {
        console.error("Bagira: Invalid signature");
        return new NextResponse("invalid_signature", { status: 403 });
      }
    }

    // Determine if chargeback (status = 2)
    const isChargeback = status === "2";

    // Calculate USD amount and points
    // Revenue is in USD, amount is in app currency
    const amountUSD = revenue > 0 ? revenue : amount / USD_TO_POINTS;
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Bagira",
      offerName: offerTitle,
      offerId,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
    });

    if (!result.success) {
      console.error("Bagira postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Bagira postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
