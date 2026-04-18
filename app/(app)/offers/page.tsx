"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useMemo, useCallback } from "react";
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  increment, 
  onSnapshot 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  ExternalLink, 
  Search, 
  LayoutGrid, 
  List, 
  Coins,
  ThumbsUp,
  ThumbsDown,
  Loader2,
  TrendingUp
} from "lucide-react";
// Convert USD to MC Points (Rate: $1 = 1000 MC)
const usdToMCPoints = (usd: number): number => Math.round(usd * 1000);

interface Offer {
  id: string;
  name: string;
  description: string;
  provider: string;
  payout: number;
  mcPoints: number;
  image?: string;
  url: string;
}

interface OfferVotes {
  likes: number;
  dislikes: number;
  userVote: "like" | "dislike" | null;
}

export default function OffersPage() {
  const { user } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<string>("points-high");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [votes, setVotes] = useState<Record<string, OfferVotes>>({});
  const [votingOfferId, setVotingOfferId] = useState<string | null>(null);

  // Fetch offers from /api/offery
  useEffect(() => {
    async function fetchOffers() {
      setLoading(true);
      try {
        const response = await fetch('/api/offery');
        const result = await response.json();
        
        if (result && result.status === "success" && Array.isArray(result.data)) {
          const fetchedOffers: Offer[] = result.data.map((item: any) => {
            const payoutUSD = parseFloat(item.payout?.reward || item.payout || 0);
            return {
              id: String(item.offer?.id || item.id || Math.random()),
              name: item.offer?.name || item.name || "Offer",
              description: item.offer?.description || item.description || "",
              provider: "Offery",
              payout: payoutUSD,
              mcPoints: usdToMCPoints(payoutUSD),
              image: item.offer?.image || item.image || "",
              url: item.url || item.offer?.url || "#",
            };
          });
          setOffers(fetchedOffers);
        }
      } catch (error) {
        console.error("Error fetching offers:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchOffers();
  }, []);

  // Subscribe to votes from Firebase Firestore (offerwalls collection)
  useEffect(() => {
    if (offers.length === 0) return;

    const unsubscribes: (() => void)[] = [];

    offers.forEach((offer) => {
      const docRef = doc(db, "offerwalls", offer.id);
      
      const unsubscribe = onSnapshot(docRef, async (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          let userVote: "like" | "dislike" | null = null;
          
          if (user) {
            const userVoteRef = doc(db, "offerwalls", offer.id, "votes", user.uid);
            const userVoteSnap = await getDoc(userVoteRef);
            if (userVoteSnap.exists()) {
              userVote = userVoteSnap.data().type;
            }
          }
          
          setVotes((prev) => ({
            ...prev,
            [offer.id]: {
              likes: data.likes || 0,
              dislikes: data.dislikes || 0,
              userVote,
            },
          }));
        } else {
          setVotes((prev) => ({
            ...prev,
            [offer.id]: {
              likes: 0,
              dislikes: 0,
              userVote: null,
            },
          }));
        }
      });
      
      unsubscribes.push(unsubscribe);
    });

    return () => {
      unsubscribes.forEach((unsub) => unsub());
    };
  }, [offers, user]);

  // Handle vote (like/dislike)
  const handleVote = useCallback(async (offerId: string, voteType: "like" | "dislike") => {
    if (!user) return;
    
    setVotingOfferId(offerId);
    
    try {
      const offerRef = doc(db, "offerwalls", offerId);
      const userVoteRef = doc(db, "offerwalls", offerId, "votes", user.uid);
      
      const offerSnap = await getDoc(offerRef);
      const userVoteSnap = await getDoc(userVoteRef);
      
      const currentVote = votes[offerId];
      
      if (!offerSnap.exists()) {
        // Create offer document if it doesn't exist
        await setDoc(offerRef, {
          likes: voteType === "like" ? 1 : 0,
          dislikes: voteType === "dislike" ? 1 : 0,
        });
        await setDoc(userVoteRef, { type: voteType, timestamp: new Date() });
      } else if (!userVoteSnap.exists()) {
        // User hasn't voted yet
        await updateDoc(offerRef, {
          [voteType === "like" ? "likes" : "dislikes"]: increment(1),
        });
        await setDoc(userVoteRef, { type: voteType, timestamp: new Date() });
      } else {
        const existingVote = userVoteSnap.data().type;
        
        if (existingVote === voteType) {
          // Remove vote
          await updateDoc(offerRef, {
            [voteType === "like" ? "likes" : "dislikes"]: increment(-1),
          });
          await setDoc(userVoteRef, { type: null, timestamp: new Date() });
        } else {
          // Change vote
          await updateDoc(offerRef, {
            [existingVote === "like" ? "likes" : "dislikes"]: increment(-1),
            [voteType === "like" ? "likes" : "dislikes"]: increment(1),
          });
          await setDoc(userVoteRef, { type: voteType, timestamp: new Date() });
        }
      }
    } catch (error) {
      console.error("Error voting:", error);
    } finally {
      setVotingOfferId(null);
    }
  }, [user, votes]);

  // Optimized filtering and sorting with useMemo
  const filteredOffers = useMemo(() => {
    return offers
      .filter((offer) => {
        const matchesSearch =
          offer.name.toLowerCase().includes(search.toLowerCase()) ||
          offer.description.toLowerCase().includes(search.toLowerCase());
        return matchesSearch;
      })
      .sort((a, b) => {
        if (sortBy === "points-high") return b.mcPoints - a.mcPoints;
        if (sortBy === "points-low") return a.mcPoints - b.mcPoints;
        if (sortBy === "popular") {
          const aLikes = votes[a.id]?.likes || 0;
          const bLikes = votes[b.id]?.likes || 0;
          return bLikes - aLikes;
        }
        return a.name.localeCompare(b.name);
      });
  }, [offers, search, sortBy, votes]);

  return (
    <div className="min-h-screen space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Available Offers
          </h1>
          <p className="text-white/50 mt-1">
            Complete offers and earn MC instantly
          </p>
        </div>

        {/* Filters - Glassmorphism */}
        <div className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
              <Input
                placeholder="Search offers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-white/5 border-white/10 text-white placeholder:text-white/40 focus:border-primary/50 focus:ring-primary/20"
              />
            </div>

            {/* Sort */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48 h-12 rounded-xl bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a]/95 backdrop-blur-xl border-white/10 text-white">
                <SelectItem value="points-high">Highest MC</SelectItem>
                <SelectItem value="points-low">Lowest MC</SelectItem>
                <SelectItem value="popular">Most Popular</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>

            {/* View Mode Toggle */}
            <div className="flex rounded-xl border border-white/10 overflow-hidden bg-white/5">
              <Button
                variant="ghost"
                onClick={() => setViewMode("grid")}
                className={`px-4 h-12 rounded-none ${
                  viewMode === "grid" 
                    ? "bg-primary/20 text-primary" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setViewMode("list")}
                className={`px-4 h-12 rounded-none ${
                  viewMode === "list" 
                    ? "bg-primary/20 text-primary" 
                    : "text-white/50 hover:text-white hover:bg-white/5"
                }`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-4 text-sm text-white/60">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-400" />
            {filteredOffers.length} offers available
          </span>
        </div>

        {/* Offers Grid/List */}
        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div 
                key={i} 
                className="h-56 backdrop-blur-md bg-white/5 border border-white/10 animate-pulse rounded-2xl" 
              />
            ))}
          </div>
        ) : filteredOffers.length === 0 ? (
          <div className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl p-12 text-center">
            <p className="text-white/50 text-lg">No offers found</p>
            <p className="text-white/30 text-sm mt-2">Try adjusting your search</p>
          </div>
        ) : (
          <div className={
            viewMode === "grid" 
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" 
              : "space-y-4"
          }>
            {filteredOffers.map((offer) => {
              const offerVotes = votes[offer.id] || { likes: 0, dislikes: 0, userVote: null };
              const isVoting = votingOfferId === offer.id;
              
              return (
                <Card 
                  key={offer.id} 
                  className="backdrop-blur-xl bg-background/40 border border-white/10 rounded-2xl hover:border-primary/40 hover:bg-background/50 transition-all duration-300 group overflow-hidden"
                >
                  <CardContent className={`p-5 flex ${viewMode === "list" ? "flex-row items-center gap-6" : "flex-col"} h-full`}>
                    {/* Offer Image & Info */}
                    <div className={`flex items-center gap-4 ${viewMode === "list" ? "flex-1" : "mb-4"}`}>
                      <div className="relative">
                        <img 
                          src={offer.image || "/placeholder.svg"} 
                          alt={offer.name}
                          className="w-14 h-14 rounded-xl object-cover border border-white/10 bg-white/5" 
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = "/placeholder.svg";
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-semibold text-base line-clamp-1 group-hover:text-primary transition-colors">
                          {offer.name}
                        </h3>
                        <p className="text-xs text-white/40">{offer.provider}</p>
                      </div>
                    </div>

                    {/* Description */}
                    {viewMode === "grid" && (
                      <p className="text-white/50 text-sm line-clamp-2 mb-4 flex-grow">
                        {offer.description || "Complete this offer to earn MC"}
                      </p>
                    )}

                    {/* Points & Actions */}
                    <div className={`flex items-center ${viewMode === "list" ? "gap-6" : "justify-between mt-auto"}`}>
                      {/* Points Display */}
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/20 border border-amber-500/30 flex items-center justify-center">
                          <Coins className="h-5 w-5 text-amber-400" />
                        </div>
                        <div>
                          <span className="text-white font-bold text-lg">{offer.mcPoints.toLocaleString()}</span>
                          <span className="text-xs text-white/40 ml-1">MC</span>
                        </div>
                      </div>

                      {/* Like/Dislike Buttons */}
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!user || isVoting}
                          onClick={() => handleVote(offer.id, "like")}
                          className={`h-9 px-3 rounded-lg transition-all ${
                            offerVotes.userVote === "like"
                              ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                              : "bg-white/5 text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10 border border-transparent"
                          }`}
                        >
                          {isVoting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ThumbsUp className="h-4 w-4 mr-1" />
                              <span className="text-xs">{offerVotes.likes}</span>
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!user || isVoting}
                          onClick={() => handleVote(offer.id, "dislike")}
                          className={`h-9 px-3 rounded-lg transition-all ${
                            offerVotes.userVote === "dislike"
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : "bg-white/5 text-white/50 hover:text-red-400 hover:bg-red-500/10 border border-transparent"
                          }`}
                        >
                          {isVoting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <ThumbsDown className="h-4 w-4 mr-1" />
                              <span className="text-xs">{offerVotes.dislikes}</span>
                            </>
                          )}
                        </Button>
                      </div>

                      {/* Start Offer Button */}
                      <Button 
                        className="rounded-xl bg-gradient-to-r from-primary to-accent hover:opacity-90 text-white font-semibold px-5 shadow-lg shadow-primary/20"
                        onClick={() => window.open(offer.url, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Start
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}
