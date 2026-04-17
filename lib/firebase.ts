import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAd9KgnzExZ5RdrJVB_hpzxUvrqHiQ3jmU",
  authDomain: "mrcash-com.firebaseapp.com",
  projectId: "mrcash-com",
  storageBucket: "mrcash-com.firebasestorage.app",
  messagingSenderId: "348374269609",
  appId: "1:348374269609:web:9fed2a4f69f2c0f00ff3b8",
  measurementId: "G-9ZZLG53Z64"
};

// Initialize Firebase (prevent re-initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
