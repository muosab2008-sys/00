import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * MyLead Postback Handler
 * 
 * Parameters (uses [macro] format):
 * - transaction_id: Unique transaction ID
 * - payout: Earnings in cents (e.g., 1.2 EUR shows as 120)
 * - payout_decimal: Earnings in dollars/euros as decimal (1.2)
 * - status: Status (pending, approved, rejected, pre_approved)
 * - currency: Currency used (usually EUR or USD)
 * - ip: IP address from conversion
 * - country_code: Country code (e.g., US)
 * - ml_sub1 to ml_sub5: Custom publisher IDs
 * - player_id: Player ID from setup URL
 * - virtual_amount: Points earned by player
 * - goal_name / goal_id: Goal name and ID for multi-goal offers
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters
    const transactionId = searchParams.get("transaction_id") || "";
    const payoutCents = parseFloatSafe(searchParams.get("payout")); // in cents
    const payoutDecimal = parseFloatSafe(searchParams.get("payout_decimal")); // in decimal
    const status = (searchParams.get("status") || "approved").toLowerCase();
    const currency = (searchParams.get("currency") || "USD").toUpperCase();
    const userIp = searchParams.get("ip") || "";
    const country = searchParams.get("country_code") || "";
    
    // User ID from ml_sub1 or player_id
    const userId = 
      searchParams.get("ml_sub1") || 
      searchParams.get("player_id") || 
      searchParams.get("user_id") ||
      "";
    
    const mlSub2 = searchParams.get("ml_sub2") || "";
    const mlSub3 = searchParams.get("ml_sub3") || "";
    const mlSub4 = searchParams.get("ml_sub4") || "";
    const mlSub5 = searchParams.get("ml_sub5") || "";
    
    const virtualAmount = parseFloatSafe(searchParams.get("virtual_amount"));
    const goalName = searchParams.get("goal_name") || "";
    const goalId = searchParams.get("goal_id") || "";
    const offerName = searchParams.get("offer_name") || goalName || "MyLead Offer";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Skip pending status - wait for approved/rejected
    if (status === "pending" || status === "pre_approved") {
      return new NextResponse("ok", { status: 200 });
    }

    // Determine if chargeback (status = "rejected")
    const isChargeback = status === "rejected";

    // Calculate USD amount
    // If payout_decimal is available, use it; otherwise convert from cents
    let amountUSD = 0;
    if (payoutDecimal > 0) {
      amountUSD = payoutDecimal;
    } else if (payoutCents > 0) {
      amountUSD = payoutCents / 100;
    } else if (virtualAmount > 0) {
      amountUSD = virtualAmount / USD_TO_POINTS;
    }

    // Convert EUR to USD if needed (approximate)
    if (currency === "EUR") {
      amountUSD = amountUSD * 1.08; // EUR to USD approximate
    }

    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Build full offer name with goal if available
    const fullOfferName = goalName && offerName !== goalName 
      ? `${offerName} - ${goalName}` 
      : offerName;

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "MyLead",
      offerName: fullOfferName,
      eventId: goalId,
      eventName: goalName,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      sub1: mlSub2,
      sub2: mlSub3,
    });

    if (!result.success) {
      console.error("MyLead postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("MyLead postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
