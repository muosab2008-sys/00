import { NextRequest, NextResponse } from "next/server";
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

// Safe Firebase Admin initialization
function getAdminDb() {
  if (!getApps().length) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        }),
      });
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
  return getFirestore();
}

const USD_TO_POINTS = 1000;

// Find user by userId, username, or email
async function findUser(
  adminDb: FirebaseFirestore.Firestore,
  identifier: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData } | null> {
  // Try direct userId lookup first
  const userByIdRef = adminDb.collection("users").doc(identifier);
  const userByIdSnap = await userByIdRef.get();
  if (userByIdSnap.exists) {
    return { id: userByIdSnap.id, data: userByIdSnap.data()! };
  }

  // Try username lookup
  const userByUsernameSnap = await adminDb
    .collection("users")
    .where("username", "==", identifier)
    .limit(1)
    .get();
  if (!userByUsernameSnap.empty) {
    const doc = userByUsernameSnap.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  // Try email lookup
  const userByEmailSnap = await adminDb
    .collection("users")
    .where("email", "==", identifier)
    .limit(1)
    .get();
  if (!userByEmailSnap.empty) {
    const doc = userByEmailSnap.docs[0];
    return { id: doc.id, data: doc.data() };
  }

  return null;
}

// Auto-create user if not found
async function createUser(
  adminDb: FirebaseFirestore.Firestore,
  identifier: string
): Promise<{ id: string; data: FirebaseFirestore.DocumentData }> {
  const newUserId = identifier;
  const isEmail = identifier.includes("@");
  const username = isEmail ? identifier.split("@")[0] : identifier;

  const newUserData = {
    uid: newUserId,
    email: isEmail ? identifier : `${identifier}@mrcash.app`,
    username: username,
    points: 0,
    fragments: 0,
    level: 1,
    totalEarned: 0,
    referredBy: null,
    referralCode: newUserId,
    isAdmin: false,
    isBanned: false,
    autoCreated: true,
    createdAt: FieldValue.serverTimestamp(),
  };

  await adminDb.collection("users").doc(newUserId).set(newUserData);
  return { id: newUserId, data: newUserData };
}

// Add to live feed
async function addToLiveFeed(
  adminDb: FirebaseFirestore.Firestore,
  username: string,
  points: number,
  source: string
) {
  try {
    await adminDb.collection("live_feed").add({
      username,
      points,
      source,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Clean up old entries (keep last 100)
    const oldEntries = await adminDb
      .collection("live_feed")
      .orderBy("createdAt", "desc")
      .offset(100)
      .get();

    const batch = adminDb.batch();
    oldEntries.docs.forEach((doc) => batch.delete(doc.ref));
    if (!oldEntries.empty) {
      await batch.commit();
    }
  } catch (error) {
    console.error("Live feed error:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    const adminDb = getAdminDb();
    const { searchParams } = new URL(request.url);

    // Get parameters with multiple fallback names
    const secretKey = searchParams.get("secret_key") || searchParams.get("key") || "";
    const userIdentifier =
      searchParams.get("user_id") ||
      searchParams.get("uid") ||
      searchParams.get("subid") ||
      searchParams.get("username") ||
      searchParams.get("email") ||
      "";
    const transactionId =
      searchParams.get("transaction_id") ||
      searchParams.get("tid") ||
      searchParams.get("offer_id") ||
      `cb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const payout = parseFloat(
      searchParams.get("payout") ||
        searchParams.get("amount") ||
        searchParams.get("reward") ||
        searchParams.get("points") ||
        "0"
    );
    const source = searchParams.get("source") || searchParams.get("wall") || "callback";
    const offerName = searchParams.get("offer_name") || searchParams.get("offer") || "External Reward";
    const ip = searchParams.get("ip") || request.headers.get("x-forwarded-for") || "";
    const autoCreate = searchParams.get("auto_create") !== "false";

    // Validate secret key
    const validSecretKey = process.env.CALLBACK_SECRET_KEY || process.env.SECRET_KEY;
    if (!validSecretKey || secretKey !== validSecretKey) {
      return NextResponse.json(
        { success: false, error: "Invalid or missing secret key" },
        { status: 401 }
      );
    }

    // Validate required parameters
    if (!userIdentifier) {
      return NextResponse.json(
        { success: false, error: "Missing user identifier (user_id, username, or email)" },
        { status: 400 }
      );
    }

    if (payout <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid payout amount" },
        { status: 400 }
      );
    }

    // Check for duplicate transaction
    const existingTx = await adminDb
      .collection("transactions")
      .where("transactionId", "==", transactionId)
      .get();

    if (!existingTx.empty) {
      return NextResponse.json(
        { success: false, error: "Duplicate transaction" },
        { status: 200 }
      );
    }

    // Find or create user
    let user = await findUser(adminDb, userIdentifier);
    let wasAutoCreated = false;

    if (!user) {
      if (autoCreate) {
        user = await createUser(adminDb, userIdentifier);
        wasAutoCreated = true;
      } else {
        return NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        );
      }
    }

    // Check if user is banned
    if (user.data.isBanned) {
      return NextResponse.json(
        { success: false, error: "User is banned" },
        { status: 403 }
      );
    }

    // Calculate points (if payout is already in points, use it directly; otherwise convert)
    const isPointsValue = searchParams.has("points");
    const points = isPointsValue ? Math.round(payout) : Math.round(payout * USD_TO_POINTS);

    // Record transaction
    await adminDb.collection("transactions").add({
      userId: user.id,
      transactionId,
      offerwall: source,
      offerwallName: source,
      offerName,
      payout: isPointsValue ? payout / USD_TO_POINTS : payout,
      points,
      ip,
      status: "completed",
      autoCreatedUser: wasAutoCreated,
      createdAt: FieldValue.serverTimestamp(),
    });

    // Get current user data for level calculation
    const currentLevel = user.data.level || 1;
    const currentTotalEarned = user.data.totalEarned || 0;
    const newTotalEarned = currentTotalEarned + points;

    // Calculate new level based on total earned
    const levelThresholds = [
      0, 1000, 5000, 15000, 35000, 75000, 150000, 300000, 500000, 1000000,
    ];
    let newLevel = 1;
    for (let i = levelThresholds.length - 1; i >= 0; i--) {
      if (newTotalEarned >= levelThresholds[i]) {
        newLevel = i + 1;
        break;
      }
    }

    // Update user points and level
    const userRef = adminDb.collection("users").doc(user.id);
    await userRef.update({
      points: FieldValue.increment(points),
      totalEarned: FieldValue.increment(points),
      level: newLevel > currentLevel ? newLevel : currentLevel,
    });

    // Add to live feed
    await addToLiveFeed(adminDb, user.data.username || userIdentifier, points, source);

    // Handle referral bonus (10%)
    if (user.data.referredBy) {
      const referralBonus = Math.round(points * 0.1);
      const referrerRef = adminDb.collection("users").doc(user.data.referredBy);
      const referrerSnap = await referrerRef.get();

      if (referrerSnap.exists && !referrerSnap.data()?.isBanned) {
        await referrerRef.update({
          points: FieldValue.increment(referralBonus),
          totalEarned: FieldValue.increment(referralBonus),
        });

        await adminDb.collection("referral_earnings").add({
          referrerId: user.data.referredBy,
          referredUserId: user.id,
          earnedPoints: referralBonus,
          sourceTransaction: transactionId,
          createdAt: FieldValue.serverTimestamp(),
        });
      }
    }

    // Update stats
    const statsRef = adminDb.collection("stats").doc("offerwalls");
    await statsRef.set(
      {
        [source]: {
          totalTransactions: FieldValue.increment(1),
          totalPayout: FieldValue.increment(isPointsValue ? payout / USD_TO_POINTS : payout),
          totalPoints: FieldValue.increment(points),
        },
        totalTransactions: FieldValue.increment(1),
        totalPayout: FieldValue.increment(isPointsValue ? payout / USD_TO_POINTS : payout),
        totalPoints: FieldValue.increment(points),
        lastUpdated: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      points,
      userId: user.id,
      newLevel: newLevel > currentLevel ? newLevel : undefined,
      autoCreated: wasAutoCreated,
    });
  } catch (error) {
    console.error("Callback error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
