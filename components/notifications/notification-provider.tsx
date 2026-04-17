"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase";
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  addDoc
} from "firebase/firestore";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "error";
  read: boolean;
  createdAt: Timestamp;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  pushPermission: NotificationPermission | null;
  requestPushPermission: () => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pushPermission, setPushPermission] = useState<NotificationPermission | null>(null);
  const [hasAskedPermission, setHasAskedPermission] = useState(false);

  // Check initial push notification permission
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window) {
      setPushPermission(Notification.permission);
      
      // Check if we've already asked
      const asked = localStorage.getItem("notification_permission_asked");
      setHasAskedPermission(!!asked);
    }
  }, []);

  // Auto-prompt for notifications on first visit
  useEffect(() => {
    if (
      typeof window !== "undefined" && 
      "Notification" in window && 
      Notification.permission === "default" &&
      !hasAskedPermission
    ) {
      // Show prompt after a short delay
      const timer = setTimeout(() => {
        setHasAskedPermission(true);
        localStorage.setItem("notification_permission_asked", "true");
      }, 3000);
      
      return () => clearTimeout(timer);
    }
  }, [hasAskedPermission]);

  // Listen to user notifications from Firestore
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const notificationsRef = collection(db, "notifications");
    const q = query(
      notificationsRef,
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Notification[];
      setNotifications(notifs);
    });

    return () => unsubscribe();
  }, [user]);

  const requestPushPermission = async (): Promise<boolean> => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      localStorage.setItem("notification_permission_asked", "true");
      setHasAskedPermission(true);
      return permission === "granted";
    } catch {
      return false;
    }
  };

  const markAsRead = async (id: string) => {
    const notifRef = doc(db, "notifications", id);
    await updateDoc(notifRef, { read: true });
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    await Promise.all(
      unread.map((n) => updateDoc(doc(db, "notifications", n.id), { read: true }))
    );
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        markAllAsRead,
        pushPermission,
        requestPushPermission,
      }}
    >
      {children}
      
      {/* Push notification prompt */}
      {!hasAskedPermission && pushPermission === "default" && (
        <NotificationPrompt onClose={() => setHasAskedPermission(true)} />
      )}
    </NotificationContext.Provider>
  );
}

function NotificationPrompt({ onClose }: { onClose: () => void }) {
  const { requestPushPermission } = useNotifications();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) return null;

  const handleAllow = async () => {
    await requestPushPermission();
    localStorage.setItem("notification_permission_asked", "true");
    onClose();
  };

  const handleDeny = () => {
    localStorage.setItem("notification_permission_asked", "true");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-300">
        <div className="flex flex-col items-center text-center">
          {/* Bell icon with animation */}
          <div className="w-16 h-16 rounded-full brand-gradient flex items-center justify-center mb-4 animate-pulse">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
            </svg>
          </div>
          
          <h3 className="text-xl font-bold text-foreground mb-2">
            Enable Notifications
          </h3>
          <p className="text-sm text-muted-foreground mb-6">
            Get notified about new offers, rewards, and when your withdrawal is processed!
          </p>
          
          <div className="flex gap-3 w-full">
            <button
              onClick={handleDeny}
              className="flex-1 px-4 py-3 rounded-xl border border-border text-muted-foreground hover:bg-secondary transition-colors font-medium"
            >
              Not Now
            </button>
            <button
              onClick={handleAllow}
              className="flex-1 px-4 py-3 rounded-xl brand-gradient text-white font-medium hover:opacity-90 transition-opacity"
            >
              Allow
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
