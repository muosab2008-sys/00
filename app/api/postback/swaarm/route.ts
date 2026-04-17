import { NextRequest, NextResponse } from "next/server";
import {
  getAdminDb,
  processPostback,
  USD_TO_POINTS,
  parseFloatSafe,
} from "@/lib/postback-utils";

/**
 * Swaarm Postback Handler
 * 
 * Parameters (uses #{macro} format):
 * - click_publisher_clickId: Publisher click ID (user ID)
 * - id: Postback unique ID from Swaarm
 * - click_id: Network click ID
 * - click_publisher_id: Publisher ID
 * - click_publisher_subId: Publisher sub ID
 * - click_publisher_subSubId: Publisher sub-sub ID
 * - peaChain: Privacy tracking code
 * - payout_theyGetInDollars: Publisher earnings in dollars
 * - payout_theyGetInCents: Publisher earnings in cents
 * - payout_theyGetPoints: User points earned
 * - offer_offerId: Offer ID in Swaarm
 * - offer_name: Offer name
 * - status_state: Status (APPROVED or REJECTED)
 * - click_time: Click timestamp
 * - time: Postback timestamp
 * - click_user_connection_ip: User IP
 * - click_user_geo_country: User country
 */

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Extract parameters - Swaarm uses underscores instead of dots in URL params
    const userId = 
      searchParams.get("click_publisher_clickId") || 
      searchParams.get("click.publisher.clickId") ||
      searchParams.get("subId") ||
      searchParams.get("user_id") ||
      "";
    
    const transactionId = 
      searchParams.get("id") || 
      searchParams.get("click_id") ||
      searchParams.get("click.id") ||
      "";
    
    const publisherId = searchParams.get("click_publisher_id") || searchParams.get("click.publisher.id") || "";
    const subId = searchParams.get("click_publisher_subId") || searchParams.get("click.publisher.subId") || "";
    const subSubId = searchParams.get("click_publisher_subSubId") || searchParams.get("click.publisher.subSubId") || "";
    
    // Payout - try different formats
    const payoutDollars = parseFloatSafe(
      searchParams.get("payout_theyGetInDollars") || 
      searchParams.get("payout.theyGetInDollars") ||
      searchParams.get("payout")
    );
    const payoutCents = parseFloatSafe(
      searchParams.get("payout_theyGetInCents") || 
      searchParams.get("payout.theyGetInCents")
    );
    const payoutPoints = parseFloatSafe(
      searchParams.get("payout_theyGetPoints") || 
      searchParams.get("payout.theyGetPoints")
    );
    
    const offerId = 
      searchParams.get("offer_offerId") || 
      searchParams.get("offer.offerId") ||
      searchParams.get("offer_id") ||
      "";
    const offerName = 
      searchParams.get("offer_name") || 
      searchParams.get("offer.name") ||
      "Swaarm Offer";
    
    const status = (
      searchParams.get("status_state") || 
      searchParams.get("status.state") ||
      searchParams.get("status") ||
      "APPROVED"
    ).toUpperCase();
    
    const userIp = 
      searchParams.get("click_user_connection_ip") || 
      searchParams.get("click.user.connection.ip") ||
      searchParams.get("ip") ||
      "";
    const country = 
      searchParams.get("click_user_geo_country") || 
      searchParams.get("click.user.geo.country") ||
      searchParams.get("country") ||
      "";

    // Validate required fields
    if (!userId || !transactionId) {
      return new NextResponse("ok", { status: 200 });
    }

    // Determine if chargeback (status = REJECTED)
    const isChargeback = status === "REJECTED";

    // Calculate USD amount - prioritize dollars, then cents, then points
    let amountUSD = 0;
    if (payoutDollars > 0) {
      amountUSD = payoutDollars;
    } else if (payoutCents > 0) {
      amountUSD = payoutCents / 100;
    } else if (payoutPoints > 0) {
      amountUSD = payoutPoints / USD_TO_POINTS;
    }

    // Calculate points
    const points = Math.round(amountUSD * USD_TO_POINTS);

    // Skip if zero payout
    if (points === 0) {
      return new NextResponse("ok", { status: 200 });
    }

    // Process postback
    const result = await processPostback(adminDb, {
      userId,
      transactionId,
      offerwall: "Swaarm",
      offerName,
      offerId,
      points,
      amountUSD,
      userIp,
      country,
      isChargeback,
      sub1: subId,
      sub2: subSubId,
    });

    if (!result.success) {
      console.error("Swaarm postback failed:", result.message);
    }

    return new NextResponse("ok", { status: 200 });
  } catch (error) {
    console.error("Swaarm postback error:", error);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
