import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert, ServiceAccount } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK
function getAdminDb() {
  if (getApps().length === 0) {
    const privateKey = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQDkfPT57bRgONCx
kzsKgx+GWI3jNxjnu9VWpnAL1MSCd++KYs8L3afZlAIuhWCpMd22/xUzvGGtTyCC
U43E+VBI2rQdw1cywGPK73uvhUIeQ3dNqGwyTWlJG4pk0tv9LcpVNOdAFLVk6FJU
vI2i0WX3mu6AUvzVF9WgkGpN+0bZIE09jm+e0uiLGLSNwF97c7L90QlCv1sGqD/H
xUqEVx9eBBJoXEzFtRmGnuGkQL0Z5s4v7YwdJHSfs2nVlZpgHrUqQkX5jnDBbu6O
xJwltRZW9VKn//BL2Ee2RkMMeyuXh+SOdHQLJNG6MmbpW85qLppOdTuTvjis8EL9
sK7GdAOXAgMBAAECggEAKcGwX5CSe1dGxH0cuCIYe8vpOlISah9IsMpABdl/hDx4
+XhvUELU7w1+jJPxg1pKo6vgaxENZMfmMAsnCI1rn7TgX+QYJn1Ef4zetMgMuk0o
G3ghNdwx1puC4kQq0g0xQfsmG+7s66ENktDWrZ/JG8QjvC3uaN8vOmXKF7BJVVqa
cxuGE3bey3DJ0hMwNR1FroCYAFt+PkOx8ONvsqaeBgsuTJG9iqOGqqCNl4JQOej8
Fxg04YDC5jVsx5rJTR4CXMn/cZKjlBsqeABz5DnMPofvdQ/m8rrlPXxcYC+KnGkw
c+VZWHlZkhxVSSLqLmHHk5n4U8eCqihXAL2QdZhR0QKBgQD5C8MnFgBkVTbu6Ggr
Ah/nHdrJJhuLC+x0xRyCSF2s8oljFzXKVIf+Uu0IsrNiu3gUa2Sw3dxRZo2r6iUi
ZOxXxDSNVuc+dPda4/bqR87ESb6AIpIZa4gOzez9QmyECGuXU9jMvXmzJFmJ9j4I
U67+ifzHAGMsB36nLuwhcHnSmQKBgQDq3j4Urj/3/QkCeuUepPEoiYor1CYpVEWW
t2RvnVPeAQJs+fw1Gg2YETwSAvln32aKDv8OjT3Tmsc/EAUhAuKFhcPuotKE2gjY
fSZQnt+ezLla/wUP9BaDJ15iT/KYK6kC+QkxEIXn5miuqg3+JXYZCLp18uxzA8+s
ae7ecqqVrwKBgDuHPTltf+B7oerPMH7/PgLvVul3q2O8EOQEbYESrRl2y7IczSW0
uODoj3HhzREPgG9ZEDNahJwMaFasW/3xo7CC3JDgMdvy92EJVm6/hUPT4K4eFU/w
LRBk1n3ez7Nrk9QTHaIqtBlG2gQpEMDKx+xdrUcf55SRogtyIs0HZocZAoGARTSt
WEyr/repovhxcOErSkWU2CtP/1eclbd+OcFDCCSGAXR7023U2Z0idTA5K1lRjpay
oygNMr/lu/hNepeuBagPvs5td8YDWz8tPg5CWDl82IpShIvo4kaEcjWahyo+R+j3
w2RaAKYM7IKhUuTY8rF2t/CXqaBS3jvsrdFd4HMCgYBKOy4YbAfHJ0idUwiaMmi/
C6BVtY+uONZyc4n6BjGlVtj6vCbZ7kyycxiifJxWayTZpJXw+djyWpq8LgElJKx7
rlDsU+P4WYyCKWCTpU4AKkNlluUVDG6yMseLEcnBo7VFk2VUzoB5ywViGiCi+xag
slmtyUkuZDNy/ESBNJCEjA==
-----END PRIVATE KEY-----`.replace(/\\n/g, '\n');

    const serviceAccount: ServiceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID || "mrcash-com",
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL || "firebase-adminsdk-fbsvc@mrcash-com.iam.gserviceaccount.com",
      privateKey: privateKey,
    };

    initializeApp({ credential: cert(serviceAccount) });
  }
  return getFirestore();
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // --- 1. Flexible User ID Search ---
    const userKeys = ["user_id", "s1", "sub1", "uid", "subId", "click_id", "external_id"];
    let userId = "";
    for (const key of userKeys) {
      if (searchParams.get(key)) {
        userId = searchParams.get(key) || "";
        break;
      }
    }

    if (!userId) return new NextResponse("ok", { status: 200 });

    // --- 2. Flexible Amount Search (USD directly from companies) ---
    // Companies send payout in USD - we multiply by 1000 to convert to internal points
    // 1 USD = 1000 points internally
    const valueKeys = ["payout_usd", "payout", "amount", "value", "reward", "usd", "revenue"];
    let rawValue = "0";
    for (const key of valueKeys) {
      if (searchParams.get(key)) {
        rawValue = searchParams.get(key) || "0";
        break;
      }
    }

    // Parse the USD value and convert to internal points (1 USD = 1000 points)
    let usdAmount = parseFloat(rawValue);
    if (isNaN(usdAmount) || usdAmount <= 0) return new NextResponse("ok", { status: 200 });

    // Convert USD to internal points (multiply by 1000)
    let points = usdAmount * 1000;

    // --- 3. Flexible Offer and Wall Name Search ---
    const wallName = searchParams.get("wall") || searchParams.get("source") || searchParams.get("network") || "Offerwall";
    const offerName = searchParams.get("offer_name") || searchParams.get("off_name") || searchParams.get("ad_name") || searchParams.get("campaign") || "Task";

    // --- 4. Unique Transaction ID (Duplicate Prevention) ---
    const txId = searchParams.get("signature") || searchParams.get("token") || searchParams.get("txid") || searchParams.get("transaction_id") || searchParams.get("tid") || `AUTO-${Date.now()}`;

    // --- 5. Database Operations ---
    const userRef = adminDb.collection("users").doc(userId);
    const userSnap = await userRef.get();

    // Create user if doesn't exist
    if (!userSnap.exists) {
      await userRef.set({
        userId: userId,
        username: userId.includes("@") ? userId.split("@")[0] : "User",
        points: 0,
        totalEarned: 0,
        level: 1,
        createdAt: FieldValue.serverTimestamp()
      });
    }

    // Check for duplicate transaction
    const dupCheck = await adminDb.collection("transactions").where("transactionId", "==", txId).limit(1).get();
    if (!dupCheck.empty) return new NextResponse("ok", { status: 200 });

    const batch = adminDb.batch();

    // Update points and balance
    batch.update(userRef, {
      points: FieldValue.increment(points),
      totalEarned: FieldValue.increment(points),
    });

    // Record the transaction with USD amount
    batch.set(adminDb.collection("transactions").doc(), {
      userId: userId,
      transactionId: txId,
      offerwall: wallName,
      offerName: offerName,
      points: points,
      amountUSD: usdAmount, // Store original USD amount
      createdAt: FieldValue.serverTimestamp(),
    });

    // Send notification with USD display
    batch.set(adminDb.collection("notifications").doc(), {
      userId: userId,
      title: "Reward Added!",
      message: `You earned $${usdAmount.toFixed(2)} from ${offerName}.`,
      isRead: false,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Add to Live Feed
    batch.set(adminDb.collection("live_feed").doc(), {
      userId: userId,
      username: userId.includes("@") ? userId.split("@")[0] : "User",
      points: points,
      amountUSD: usdAmount,
      source: wallName,
      createdAt: FieldValue.serverTimestamp(),
    });

    await batch.commit();
    return new NextResponse("ok", { status: 200 });

  } catch (err) {
    console.error("Postback Error:", err);
    return new NextResponse("ok", { status: 200 });
  }
}

export async function POST(req: NextRequest) { return GET(req); }
