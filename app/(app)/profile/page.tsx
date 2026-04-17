"use client";

export const dynamic = "force-dynamic";

import { useState, useRef } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  User,
  Mail,
  Lock,
  Trophy,
  Calendar,
  Shield,
  Loader2,
  Save,
  Copy,
  Camera,
  TrendingUp,
} from "lucide-react";
import Image from "next/image";

// Points to USD conversion
const pointsToUSD = (points: number) => (points / 1000).toFixed(2);

export default function ProfilePage() {
  const { userData, updateUserProfile, updateUserEmail, updateUserPassword, updateUserAvatar, logout } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [username, setUsername] = useState(userData?.username || "");
  const [email, setEmail] = useState(userData?.email || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const currentLevelThreshold = (userData?.level || 1) * 10000;
  const previousLevelThreshold = ((userData?.level || 1) - 1) * 10000;
  const pointsInCurrentLevel = (userData?.totalEarned || 0) - previousLevelThreshold;
  const pointsNeededForLevel = currentLevelThreshold - previousLevelThreshold;
  const levelProgress = Math.min((pointsInCurrentLevel / pointsNeededForLevel) * 100, 100);

  const handleUpdateUsername = async () => {
    if (!username.trim()) {
      toast.error("Username cannot be empty");
      return;
    }

    setLoading("username");
    try {
      await updateUserProfile(username);
      toast.success("Username updated successfully");
    } catch {
      toast.error("Failed to update username");
    } finally {
      setLoading(null);
    }
  };

  const handleUpdateEmail = async () => {
    if (!email.trim()) {
      toast.error("Email cannot be empty");
      return;
    }

    setLoading("email");
    try {
      await updateUserEmail(email);
      toast.success("Email updated successfully");
    } catch {
      toast.error("Failed to update email. You may need to re-login.");
    } finally {
      setLoading(null);
    }
  };

  const handleUpdatePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    setLoading("password");
    try {
      await updateUserPassword(newPassword);
      toast.success("Password updated successfully");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      toast.error("Failed to update password. You may need to re-login.");
    } finally {
      setLoading(null);
    }
  };

  const copyUserId = async () => {
    if (userData?.uid) {
      await navigator.clipboard.writeText(userData.uid);
      toast.success("User ID copied to clipboard");
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !userData?.uid) return;

    setLoading("avatar");
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", userData.uid);

      const response = await fetch("/api/upload-avatar", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Upload failed");
      }

      const { url } = await response.json();
      await updateUserAvatar(url);
      toast.success("Avatar updated successfully");
    } catch {
      toast.error("Failed to upload avatar");
    } finally {
      setLoading(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-4xl mx-auto">
      {/* Header with Avatar */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="relative group">
          <Avatar className="h-24 w-24 border-4 border-primary/30 rounded-xl">
            <AvatarImage src={userData?.photoURL || ""} alt={userData?.username || "User"} className="rounded-xl" />
            <AvatarFallback className="text-2xl brand-gradient text-white rounded-xl">
              {userData?.username?.charAt(0).toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading === "avatar"}
            className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-white shadow-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading === "avatar" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleAvatarChange}
            className="hidden"
          />
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold text-foreground">{userData?.username || "Profile"}</h1>
          <p className="text-muted-foreground">
            Manage your account settings and view your stats
          </p>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border">
              <Image src="/coin.png" alt="Points" width={32} height={32} className="w-8 h-8 object-contain" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Balance</p>
              <p className="text-2xl font-black text-foreground">
                {(userData?.points || 0).toLocaleString()}
              </p>
              <p className="text-xs text-primary">= ${pointsToUSD(userData?.points || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20">
              <Trophy className="h-7 w-7 text-amber-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Level</p>
              <p className="text-2xl font-black text-amber-500">
                {userData?.level || 1}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl brand-gradient shadow-lg glow-primary">
              <TrendingUp className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Earned</p>
              <p className="text-2xl font-black text-primary">
                {(userData?.totalEarned || 0).toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">= ${pointsToUSD(userData?.totalEarned || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border">
              <Calendar className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Joined</p>
              <p className="text-lg font-bold text-foreground">
                {userData?.createdAt?.toLocaleDateString() || "N/A"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Level Progress */}
      <Card className="glass-card">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5 text-amber-500" />
              <span className="font-bold text-foreground">Level {userData?.level || 1} Progress</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {pointsInCurrentLevel.toLocaleString()} / {pointsNeededForLevel.toLocaleString()} PTS
            </span>
          </div>
          <div className="h-3 w-full bg-secondary rounded-xl overflow-hidden border border-border">
            <div 
              className="h-full brand-gradient transition-all duration-500 rounded-xl" 
              style={{ width: `${levelProgress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* User ID */}
      <Card className="glass-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-lg">
            <Shield className="h-5 w-5 text-primary" />
            Account Information
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <div>
            <p className="mb-2 text-[10px] font-bold uppercase text-muted-foreground tracking-widest">User ID</p>
            <div className="flex gap-2">
              <Input
                value={userData?.uid || ""}
                readOnly
                className="font-mono text-sm h-12 rounded-xl bg-secondary/30 border-border"
              />
              <Button variant="outline" onClick={copyUserId} className="rounded-xl h-12 border-border hover:bg-secondary">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {userData?.isAdmin && (
            <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-lg px-3 py-1.5">
              <Shield className="mr-1 h-3 w-3" />
              Administrator
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Update Username */}
      <Card className="glass-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-lg">
            <User className="h-5 w-5 text-primary" />
            Update Username
          </CardTitle>
          <CardDescription className="text-muted-foreground">Change your display name</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex gap-2">
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter new username"
              className="h-12 rounded-xl bg-secondary/30 border-border focus:border-primary/50"
            />
            <Button
              onClick={handleUpdateUsername}
              disabled={loading === "username"}
              className="brand-gradient text-white h-12 rounded-xl px-6"
            >
              {loading === "username" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Email */}
      <Card className="glass-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-lg">
            <Mail className="h-5 w-5 text-primary" />
            Update Email
          </CardTitle>
          <CardDescription className="text-muted-foreground">Change your email address</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter new email"
              className="h-12 rounded-xl bg-secondary/30 border-border focus:border-primary/50"
            />
            <Button
              onClick={handleUpdateEmail}
              disabled={loading === "email"}
              className="brand-gradient text-white h-12 rounded-xl px-6"
            >
              {loading === "email" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Update Password */}
      <Card className="glass-card">
        <CardHeader className="p-5 pb-3">
          <CardTitle className="flex items-center gap-2 text-foreground text-lg">
            <Lock className="h-5 w-5 text-primary" />
            Update Password
          </CardTitle>
          <CardDescription className="text-muted-foreground">Change your account password</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 space-y-4">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="New password"
            className="h-12 rounded-xl bg-secondary/30 border-border focus:border-primary/50"
          />
          <Input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            className="h-12 rounded-xl bg-secondary/30 border-border focus:border-primary/50"
          />
          <Button
            onClick={handleUpdatePassword}
            disabled={loading === "password"}
            className="brand-gradient text-white h-12 rounded-xl"
          >
            {loading === "password" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Update Password
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Logout */}
      <Card className="glass-card border-destructive/20">
        <CardContent className="p-5">
          <Button
            variant="destructive"
            onClick={logout}
            className="w-full h-12 rounded-xl bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20"
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
