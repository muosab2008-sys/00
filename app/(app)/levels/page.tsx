"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/auth-context";
import { doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Trophy, Gift, Star, Lock, Check, Loader2, ShieldCheck, Globe, Send } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Points to USD conversion
const pointsToUSD = (points: number) => (points / 1000).toFixed(2);

const levels = Array.from({ length: 20 }, (_, i) => ({
  level: i + 1,
  threshold: (i + 1) * 10000,
  bonus: 1000, // 1000 points = $1
}));

export default function LevelsPage() {
  const { userData, user } = useAuth();
  const [claimedLevels, setClaimedLevels] = useState<number[]>([]);
  const [claiming, setClaiming] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const totalEarned = userData?.totalEarned || 0;
  const currentLevel = Math.floor(totalEarned / 10000) + 1;

  const currentLevelThreshold = currentLevel * 10000;
  const previousLevelThreshold = (currentLevel - 1) * 10000;
  const pointsInCurrentLevel = totalEarned - previousLevelThreshold;
  const pointsNeededForLevel = currentLevelThreshold - previousLevelThreshold;
  const levelProgress = Math.min((pointsInCurrentLevel / pointsNeededForLevel) * 100, 100);

  useEffect(() => {
    const loadClaimedLevels = async () => {
      if (!user?.uid) {
        setLoading(false);
        return;
      }

      try {
        const claimedRef = doc(db, "users", user.uid, "rewards", "levels");
        const claimedSnap = await getDoc(claimedRef);
        
        if (claimedSnap.exists()) {
          setClaimedLevels(claimedSnap.data().claimed || []);
        }
      } catch (error) {
        console.error("Error loading claimed levels:", error);
      } finally {
        setLoading(false);
      }
    };

    loadClaimedLevels();
  }, [user?.uid]);

  const claimLevelBonus = async (level: number) => {
    if (!user?.uid || !userData) return;
    
    if (claimedLevels.includes(level)) {
      toast.error("You have already claimed this level bonus");
      return;
    }

    const levelThreshold = level * 10000;
    if (totalEarned < levelThreshold) {
      toast.error("You have not reached this level yet!");
      return;
    }

    setClaiming(level);
    try {
      const userRef = doc(db, "users", user.uid);
      await updateDoc(userRef, {
        points: increment(1000),
      });

      const claimedRef = doc(db, "users", user.uid, "rewards", "levels");
      const claimedSnap = await getDoc(claimedRef);
      
      if (claimedSnap.exists()) {
        await updateDoc(claimedRef, {
          claimed: [...claimedLevels, level],
        });
      } else {
        await setDoc(claimedRef, {
          claimed: [level],
        });
      }

      setClaimedLevels([...claimedLevels, level]);
      toast.success(`Level ${level} bonus claimed! +1,000 points ($1.00)`);
    } catch {
      toast.error("Failed to claim bonus");
    } finally {
      setClaiming(null);
    }
  };

  const unclaimedBonuses = levels.filter(
    (l) => currentLevel > l.level && !claimedLevels.includes(l.level)
  );

  const claimAllBonuses = async () => {
    if (unclaimedBonuses.length === 0) return;
    
    setClaiming(-1);
    try {
      const totalBonus = unclaimedBonuses.length * 1000;
      const levelsToClaim = unclaimedBonuses.map((l) => l.level);

      const userRef = doc(db, "users", user!.uid);
      await updateDoc(userRef, {
        points: increment(totalBonus),
      });

      const claimedRef = doc(db, "users", user!.uid, "rewards", "levels");
      const newClaimedLevels = [...claimedLevels, ...levelsToClaim];
      
      const claimedSnap = await getDoc(claimedRef);
      if (claimedSnap.exists()) {
        await updateDoc(claimedRef, { claimed: newClaimedLevels });
      } else {
        await setDoc(claimedRef, { claimed: newClaimedLevels });
      }

      setClaimedLevels(newClaimedLevels);
      toast.success(`Claimed ${unclaimedBonuses.length} bonuses! +${totalBonus.toLocaleString()} points`);
    } catch {
      toast.error("Failed to claim bonuses");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-6xl mx-auto w-full">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Level Progression</h1>
          <p className="text-muted-foreground">
            Level up to earn bonus rewards! Each level grants you 1,000 points ($1.00).
          </p>
        </div>

        {/* Current Level Card */}
        <Card className="glass-card border-primary/20">
          <CardHeader className="p-5 pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl brand-gradient shadow-lg glow-primary">
                  <Trophy className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-3xl brand-gradient-text">Level {currentLevel}</CardTitle>
                  <CardDescription className="text-muted-foreground">Your current level</CardDescription>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total Earned</p>
                <p className="text-xl font-black text-primary">
                  {totalEarned.toLocaleString()} PTS
                </p>
                <p className="text-xs text-muted-foreground">= ${pointsToUSD(totalEarned)}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Progress to Level {currentLevel + 1}</span>
                <span className="font-medium text-foreground">
                  {pointsInCurrentLevel.toLocaleString()} / {pointsNeededForLevel.toLocaleString()} PTS
                </span>
              </div>
              <div className="h-3 w-full bg-secondary rounded-xl overflow-hidden border border-border">
                <div 
                  className="h-full brand-gradient transition-all duration-500 rounded-xl" 
                  style={{ width: `${levelProgress}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {(pointsNeededForLevel - pointsInCurrentLevel).toLocaleString()} more points needed
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Unclaimed Bonuses Alert */}
        {unclaimedBonuses.length > 0 && (
          <Card className="glass-card border-emerald-500/20 bg-emerald-500/5">
            <CardContent className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500 shadow-lg">
                  <Gift className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-bold text-emerald-500">
                    {unclaimedBonuses.length} Unclaimed Bonuses!
                  </p>
                  <p className="text-sm text-muted-foreground">
                    You have {(unclaimedBonuses.length * 1000).toLocaleString()} points (${unclaimedBonuses.length}.00) in unclaimed bonuses
                  </p>
                </div>
              </div>
              <Button
                onClick={claimAllBonuses}
                disabled={claiming !== null}
                className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl h-12 px-6"
              >
                {claiming === -1 ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Gift className="mr-2 h-4 w-4" />
                )}
                Claim All ({(unclaimedBonuses.length * 1000).toLocaleString()} PTS)
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Bonuses Earned */}
        <Card className="glass-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-secondary border border-border">
              <Image src="/coin.png" alt="Points" width={32} height={32} className="w-8 h-8 object-contain" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Total Bonuses Claimed</p>
              <p className="text-2xl font-black text-primary">
                {(claimedLevels.length * 1000).toLocaleString()} PTS
              </p>
              <p className="text-xs text-muted-foreground">= ${claimedLevels.length}.00</p>
            </div>
            <Badge className="bg-primary/10 text-primary border border-primary/20 rounded-lg px-3 py-1">
              {claimedLevels.length} of {currentLevel - 1} claimed
            </Badge>
          </CardContent>
        </Card>

        {/* Level Grid */}
        <div>
          <h2 className="mb-4 text-xl font-bold text-foreground">All Levels</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {levels.map((level) => {
              const isCompleted = currentLevel > level.level;
              const isCurrent = currentLevel === level.level;
              const isLocked = currentLevel < level.level;
              const isClaimed = claimedLevels.includes(level.level);
              const canClaim = isCompleted && !isClaimed;

              return (
                <Card
                  key={level.level}
                  className={`glass-card transition-all ${
                    isCurrent
                      ? "border-primary ring-2 ring-primary/20"
                      : isCompleted
                      ? "border-emerald-500/30"
                      : "opacity-60"
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                            isCurrent
                              ? "brand-gradient"
                              : isCompleted
                              ? "bg-emerald-500"
                              : "bg-secondary"
                          }`}
                        >
                          {isCompleted ? (
                            <Check className="h-5 w-5 text-white" />
                          ) : isLocked ? (
                            <Lock className="h-5 w-5 text-muted-foreground" />
                          ) : (
                            <Star className="h-5 w-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className={`font-bold ${isCurrent ? "text-primary" : "text-foreground"}`}>
                            Level {level.level}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {level.threshold.toLocaleString()} PTS
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-1">
                          <Image src="/coin.png" alt="Points" width={16} height={16} className="w-4 h-4" />
                          <span className={`text-sm font-bold ${isCompleted ? "text-emerald-500" : "text-muted-foreground"}`}>
                            +1,000
                          </span>
                        </div>
                        {canClaim ? (
                          <Button
                            size="sm"
                            onClick={() => claimLevelBonus(level.level)}
                            disabled={claiming !== null}
                            className="mt-1 h-7 bg-emerald-500 hover:bg-emerald-600 text-white text-xs rounded-lg"
                          >
                            {claiming === level.level ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Claim"
                            )}
                          </Button>
                        ) : isClaimed ? (
                          <Badge className="mt-1 bg-emerald-500/10 text-emerald-500 border-0 text-xs rounded-lg">
                            Claimed
                          </Badge>
                        ) : null}
                      </div>
                    </div>
                    {isCurrent && (
                      <div className="mt-3">
                        <div className="h-2 w-full bg-secondary rounded-full overflow-hidden border border-border">
                          <div 
                            className="h-full brand-gradient transition-all duration-500 rounded-full" 
                            style={{ width: `${levelProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Info Card */}
        <Card className="glass-card">
          <CardHeader className="p-5 pb-3">
            <CardTitle className="flex items-center gap-2 text-foreground text-lg">
              <Gift className="h-5 w-5 text-primary" />
              Level Rewards
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">1</span>
                Each level requires 10,000 additional points.
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">2</span>
                When you reach a new level, you can claim a 1,000 point bonus ($1.00).
              </li>
              <li className="flex items-start gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">3</span>
                {"Click the \"Claim\" button on completed levels to receive your bonus!"}
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Footer */}
      <footer className="mt-12 border-t border-border bg-card/50 backdrop-blur-xl pt-12 pb-10 w-full px-4 sm:px-8">
        <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Image src="/logo.png" alt="Logo" width={32} height={32} className="rounded-xl" />
              <span className="text-2xl font-black brand-gradient-text tracking-tight">
                MrCash
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed font-medium">The premier destination for turning tasks into real digital rewards securely and instantly.</p>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Trust</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="w-4 h-4 text-primary" /> Secure Encryption</div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground"><Globe className="w-4 h-4 text-primary" /> Global Payouts</div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Legal</h4>
            <nav className="flex flex-col gap-3">
              <Link href="/privacy-policy" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link href="/terms-of-service" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms of Service</Link>
            </nav>
          </div>

          <div className="space-y-4">
            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Community</h4>
            <a href="https://t.me/+HaIWYiOHx-FkNzY0" target="_blank" rel="noopener noreferrer" className="flex items-center gap-4 p-4 rounded-xl bg-secondary/50 border border-border hover:border-primary/30 transition-all group">
              <div className="w-10 h-10 rounded-xl bg-card flex items-center justify-center border border-border group-hover:brand-gradient transition-colors">
                <Send className="w-5 h-5 text-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-foreground uppercase">Telegram</span>
                <span className="text-[10px] text-muted-foreground font-medium">Official Channel</span>
              </div>
            </a>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border text-center">
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest">2026 MR.CASH - ALL RIGHTS RESERVED</p>
        </div>
      </footer>
    </div>
  );
}
