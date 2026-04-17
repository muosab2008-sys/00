"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  updateEmail,
  updatePassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useRouter } from "next/navigation";

export interface UserData {
  uid: string;
  email: string;
  username: string;
  photoURL: string | null;
  points: number;
  fragments: number;
  level: number;
  totalEarned: number;
  referredBy: string | null;
  referralCode: string;
  isAdmin: boolean;
  isBanned: boolean;
  createdAt: Date;
}

interface AuthContextType {
  user: User | null;
  userData: UserData | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  register: (email: string, password: string, username: string, referralCode?: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateUserProfile: (username: string) => Promise<void>;
  updateUserEmail: (newEmail: string) => Promise<void>;
  updateUserPassword: (newPassword: string) => Promise<void>;
  updateUserAvatar: (photoURL: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const unsubscribeUser = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userDataObj: UserData = {
              uid: firebaseUser.uid,
              email: data.email,
              username: data.username,
              photoURL: data.photoURL || firebaseUser.photoURL || null,
              points: data.points || 0,
              fragments: data.fragments || 0,
              level: data.level || 1,
              totalEarned: data.totalEarned || 0,
              referredBy: data.referredBy || null,
              referralCode: data.referralCode,
              isAdmin: data.isAdmin || false,
              isBanned: data.isBanned || false,
              createdAt: data.createdAt?.toDate() || new Date(),
            };
            setUserData(userDataObj);

            if (userDataObj.isBanned) {
              router.push("/banned");
            }
          }
          setLoading(false);
        });

        return () => unsubscribeUser();
      } else {
        setUserData(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  const login = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const firebaseUser = result.user;

    // Check if user document exists
    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      // Create new user document for Google sign-in
      await setDoc(userDocRef, {
        uid: firebaseUser.uid,
        email: firebaseUser.email,
        username: firebaseUser.displayName || firebaseUser.email?.split("@")[0] || "User",
        photoURL: firebaseUser.photoURL || null,
        points: 0,
        fragments: 0,
        level: 1,
        totalEarned: 0,
        referredBy: null,
        referralCode: firebaseUser.uid,
        isAdmin: false,
        isBanned: false,
        createdAt: serverTimestamp(),
      });
    } else {
      // Update photoURL if changed for existing Google users
      const existingData = userSnap.data();
      if (firebaseUser.photoURL && existingData?.photoURL !== firebaseUser.photoURL) {
        await setDoc(userDocRef, { photoURL: firebaseUser.photoURL }, { merge: true });
      }
    }
  };

  const register = async (email: string, password: string, username: string, referralCode?: string) => {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;

    await updateProfile(firebaseUser, { displayName: username });

    let referredBy: string | null = null;
    if (referralCode) {
      const usersRef = doc(db, "users", referralCode);
      const referrerSnap = await getDoc(usersRef);
      if (referrerSnap.exists()) {
        referredBy = referralCode;
      }
    }

    await setDoc(doc(db, "users", firebaseUser.uid), {
      uid: firebaseUser.uid,
      email: email,
      username: username,
      points: 0,
      fragments: 0,
      level: 1,
      totalEarned: 0,
      referredBy: referredBy,
      referralCode: firebaseUser.uid,
      isAdmin: false,
      isBanned: false,
      createdAt: serverTimestamp(),
    });
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  const resetPassword = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateUserProfile = async (username: string) => {
    if (!user) throw new Error("No user logged in");
    await updateProfile(user, { displayName: username });
    await setDoc(doc(db, "users", user.uid), { username }, { merge: true });
  };

  const updateUserEmail = async (newEmail: string) => {
    if (!user) throw new Error("No user logged in");
    await updateEmail(user, newEmail);
    await setDoc(doc(db, "users", user.uid), { email: newEmail }, { merge: true });
  };

  const updateUserPassword = async (newPassword: string) => {
    if (!user) throw new Error("No user logged in");
    await updatePassword(user, newPassword);
  };

  const updateUserAvatar = async (photoURL: string) => {
    if (!user) throw new Error("No user logged in");
    await updateProfile(user, { photoURL });
    await setDoc(doc(db, "users", user.uid), { photoURL }, { merge: true });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userData,
        loading,
        login,
        loginWithGoogle,
        register,
        logout,
        resetPassword,
        updateUserProfile,
        updateUserEmail,
        updateUserPassword,
        updateUserAvatar,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
