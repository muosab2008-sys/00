"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Gift,
  Plus,
  Trash2,
  ArrowLeft,
  Loader2,
  Trophy,
  Clock,
  Crown,
} from "lucide-react";
import Link from "next/link";

interface Giveaway {
  id: string;
  title: string;
  prize: string;
  prizeAmount: number;
  tier: "daily" | "weekly" | "monthly";
  totalFragments: number;
  endsAt: Date;
  winnerId: string | null;
  winnerUsername: string | null;
  isActive: boolean;
  createdAt: Date;
}

const tierConfig = {
  daily: { label: "Daily (24h)", hours: 24 },
  weekly: { label: "Weekly", hours: 168 },
  monthly: { label: "Monthly", hours: 720 },
};

export default function AdminGiveawaysPage() {
  const [giveaways, setGiveaways] = useState<Giveaway[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    title: "",
    prize: "",
    prizeAmount: "",
    tier: "daily" as "daily" | "weekly" | "monthly",
  });

  useEffect(() => {
    const q = query(collection(db, "giveaways"), orderBy("endsAt", "desc"));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((doc) => {
          const d = doc.data();
          return {
            id: doc.id,
            title: d.title,
            prize: d.prize,
            prizeAmount: d.prizeAmount || 0,
            tier: d.tier,
            totalFragments: d.totalFragments || 0,
            endsAt: d.endsAt?.toDate() || new Date(),
            winnerId: d.winnerId || null,
            winnerUsername: d.winnerUsername || null,
            isActive: d.isActive ?? true,
            createdAt: d.createdAt?.toDate() || new Date(),
          };
        }) as Giveaway[];
        setGiveaways(data);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsubscribe();
  }, []);

  const createGiveaway = async () => {
    if (!formData.title.trim() || !formData.prize.trim()) {
      toast.error("Please fill in title and prize");
      return;
    }

    setCreating(true);
    try {
      const tier = tierConfig[formData.tier];
      const endsAt = new Date();
      endsAt.setHours(endsAt.getHours() + tier.hours);

      const id = `${formData.tier}-${Date.now()}`;
      await setDoc(doc(db, "giveaways", id), {
        title: formData.title,
        prize: formData.prize,
        prizeAmount: parseFloat(formData.prizeAmount) || 0,
        tier: formData.tier,
        totalFragments: 0,
        endsAt: Timestamp.fromDate(endsAt),
        winnerId: null,
        winnerUsername: null,
        isActive: true,
        createdAt: serverTimestamp(),
      });

      toast.success("Giveaway created!");
      setFormData({
        title: "",
        prize: "",
        prizeAmount: "",
        tier: "daily",
      });
      setShowForm(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create giveaway");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (giveaway: Giveaway) => {
    try {
      await updateDoc(doc(db, "giveaways", giveaway.id), {
        isActive: !giveaway.isActive,
      });
      toast.success(giveaway.isActive ? "Giveaway ended" : "Giveaway activated");
    } catch (error: any) {
      toast.error(error.message || "Failed to update giveaway");
    }
  };

  const selectWinner = async (giveaway: Giveaway) => {
    // In a real app, this would query the contributions and find the top contributor
    toast.info("Winner selection would be implemented with Cloud Functions");
  };

  const deleteGiveaway = async (id: string) => {
    try {
      await deleteDoc(doc(db, "giveaways", id));
      toast.success("Giveaway deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete giveaway");
    }
  };

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case "daily":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-0">Daily</Badge>;
      case "weekly":
        return <Badge className="bg-[var(--brand-cyan)]/10 text-[var(--brand-cyan)] border-0">Weekly</Badge>;
      case "monthly":
        return <Badge className="bg-[var(--brand-purple)]/10 text-[var(--brand-purple)] border-0">Monthly</Badge>;
      default:
        return null;
    }
  };

  const formatTimeRemaining = (endsAt: Date) => {
    const now = new Date();
    const diff = endsAt.getTime() - now.getTime();
    
    if (diff <= 0) return "Ended";
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    
    if (days > 0) return `${days}d ${hours}h remaining`;
    return `${hours}h remaining`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Gift className="h-6 w-6 text-[var(--brand-cyan)]" />
              Giveaways
            </h1>
            <p className="text-muted-foreground">
              Manage giveaway prizes and winners
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="brand-gradient text-primary-foreground"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Giveaway
        </Button>
      </div>

      {/* Create Form */}
      {showForm && (
        <Card className="border-[var(--brand-cyan)]/30 bg-card">
          <CardHeader>
            <CardTitle>Create New Giveaway</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                placeholder="Title (e.g., Weekly Grand Prize)"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
              <Input
                placeholder="Prize (e.g., $25 PayPal)"
                value={formData.prize}
                onChange={(e) => setFormData({ ...formData, prize: e.target.value })}
              />
              <Input
                type="number"
                placeholder="Prize Amount in USD"
                value={formData.prizeAmount}
                onChange={(e) => setFormData({ ...formData, prizeAmount: e.target.value })}
              />
              <Select
                value={formData.tier}
                onValueChange={(value: "daily" | "weekly" | "monthly") =>
                  setFormData({ ...formData, tier: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select tier" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily (24 hours)</SelectItem>
                  <SelectItem value="weekly">Weekly (7 days)</SelectItem>
                  <SelectItem value="monthly">Monthly (30 days)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
              <Button
                onClick={createGiveaway}
                disabled={creating}
                className="brand-gradient text-primary-foreground"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Create Giveaway"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Giveaways List */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle>All Giveaways</CardTitle>
          <CardDescription>{giveaways.length} giveaways</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg bg-secondary p-4 animate-pulse"
                >
                  <div className="h-5 w-40 bg-muted rounded" />
                  <div className="h-5 w-20 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : giveaways.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No giveaways yet
            </p>
          ) : (
            <div className="space-y-3">
              {giveaways.map((giveaway) => {
                const isEnded = new Date() > giveaway.endsAt;
                
                return (
                  <div
                    key={giveaway.id}
                    className={`rounded-lg border p-4 ${
                      giveaway.isActive && !isEnded
                        ? "border-border bg-secondary"
                        : "border-border bg-muted/50 opacity-60"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{giveaway.title}</span>
                          {getTierBadge(giveaway.tier)}
                          {giveaway.winnerId && (
                            <Badge className="bg-amber-500/10 text-amber-500 border-0">
                              <Crown className="mr-1 h-3 w-3" />
                              Winner: {giveaway.winnerUsername}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Prize: {giveaway.prize}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatTimeRemaining(giveaway.endsAt)}
                          </span>
                          <span>
                            {giveaway.totalFragments.toLocaleString()} fragments deposited
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isEnded && !giveaway.winnerId && (
                          <Button
                            size="sm"
                            onClick={() => selectWinner(giveaway)}
                            className="bg-amber-500 hover:bg-amber-600 text-white"
                          >
                            <Trophy className="mr-1 h-4 w-4" />
                            Select Winner
                          </Button>
                        )}
                        <Switch
                          checked={giveaway.isActive}
                          onCheckedChange={() => toggleActive(giveaway)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteGiveaway(giveaway.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
