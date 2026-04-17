"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Loader2,
  ArrowLeft,
  Maximize2,
  X,
  ThumbsUp,
  ThumbsDown,
  Smartphone,
  Monitor,
  Apple,
  CheckCircle2,
  Star,
  Users,
  TrendingUp
} from "lucide-react";
import Image from "next/image";

// Convert USD to MC points ($1 = 1000 MC)
const usdToMC = (usd: number) => Math.round(usd * 1000);

type DeviceFilter = "all" | "android" | "ios" | "desktop";

interface Offerwall {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  color: string;
  likes: number;
  dislikes: number;
  isActive: boolean;
  avgPoints: number;
  totalOffers: number;
  devices: string[]; // ["android", "ios", "desktop"]
  url: string;
}

const deviceConfig: Record<DeviceFilter, { label: string; icon: any }> = {
  all: { label: "All Devices", icon: null },
  android: { label: "Android", icon: Smartphone },
  ios: { label: "iPhone", icon: Apple },
  desktop: { label: "Desktop", icon: Monitor },
};

// Default offerwalls data if Firestore is empty
const defaultOfferwalls: Omit<Offerwall, "id">[] = [
  {
    name: "Offery",
    description: "Complete surveys and offers to earn MC points instantly. High-paying tasks available daily.",
    logoUrl: "https://earng.net/storage/providers/x5v40jKJIoMPSNXMmiyTkK0eWIGXHPXSsAT2QRYb.png",
    color: "#ffc107",
    likes: 245,
    dislikes: 12,
    isActive: true,
    avgPoints: 2500,
    totalOffers: 150,
    devices: ["android", "ios", "desktop"],
    url: "/api/offery"
  },
  {
    name: "AdGate Media",
    description: "Premium offers and surveys with fast credit. Top rewards for app installations.",
    logoUrl: "https://cdn.adgatemedia.com/images/logo_small.png",
    color: "#10B981",
    likes: 189,
    dislikes: 8,
    isActive: true,
    avgPoints: 1800,
    totalOffers: 120,
    devices: ["android", "ios", "desktop"],
    url: "#"
  },
  {
    name: "CPX Research",
    description: "Survey-focused offerwall with instant payouts. Multiple daily survey opportunities.",
    logoUrl: "https://cpx-research.com/assets/img/cpx-research-logo-full.png",
    color: "#8B5CF6",
    likes: 156,
    dislikes: 15,
    isActive: true,
    avgPoints: 1200,
    totalOffers: 80,
    devices: ["android", "ios", "desktop"],
    url: "#"
  },
  {
    name: "Lootably",
    description: "Game offers and app downloads. Best rewards for gaming enthusiasts.",
    logoUrl: "https://www.lootably.com/images/logo.png",
    color: "#EC4899",
    likes: 134,
    dislikes: 6,
    isActive: true,
    avgPoints: 3200,
    totalOffers: 95,
    devices: ["android", "ios"],
    url: "#"
  },
  {
    name: "TimeWall",
    description: "Time-based rewards for app usage. Earn while using your favorite apps.",
    logoUrl: "https://www.timewall.io/images/logo.png",
    color: "#06B6D4",
    likes: 98,
    dislikes: 4,
    isActive: true,
    avgPoints: 800,
    totalOffers: 45,
    devices: ["android", "ios"],
    url: "#"
  },
  {
    name: "AyeT Studios",
    description: "Diverse offer types including videos, surveys, and app installs.",
    logoUrl: "https://www.ayetstudios.com/img/logo.png",
    color: "#F59E0B",
    likes: 112,
    dislikes: 9,
    isActive: true,
    avgPoints: 1500,
    totalOffers: 110,
    devices: ["android", "ios", "desktop"],
    url: "#"
  }
];

export default function OffersPage() {
  const { user, userData } = useAuth();
  const [offerwalls, setOfferwalls] = useState<Offerwall[]>([]);
  const [loading, setLoading] = useState(true);
  const [deviceFilter, setDeviceFilter] = useState<DeviceFilter>("all");
  const [selectedWall, setSelectedWall] = useState<Offerwall | null>(null);
  const [activeIframe, setActiveIframe] = useState<{url: string, title: string} | null>(null);
  const [userVotes, setUserVotes] = useState<Record<string, "like" | "dislike">>({});
  
  // Horizontal scroll for device filter
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  // Load offerwalls from Firestore
  useEffect(() => {
    const q = query(collection(db, "offerwalls"), orderBy("avgPoints", "desc"));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        // Initialize with default data if empty
        const walls: Offerwall[] = [];
        for (const wall of defaultOfferwalls) {
          const docRef = doc(collection(db, "offerwalls"));
          await setDoc(docRef, wall);
          walls.push({ id: docRef.id, ...wall });
        }
        setOfferwalls(walls);
      } else {
        const walls = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        })) as Offerwall[];
        setOfferwalls(walls);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load user votes
  useEffect(() => {
    if (!user) return;
    const loadVotes = async () => {
      const votesDoc = await getDoc(doc(db, "user_votes", user.uid));
      if (votesDoc.exists()) {
        setUserVotes(votesDoc.data() as Record<string, "like" | "dislike">);
      }
    };
    loadVotes();
  }, [user]);

  // Handle vote
  const handleVote = async (wallId: string, type: "like" | "dislike") => {
    if (!user) return;
    
    const currentVote = userVotes[wallId];
    if (currentVote === type) return; // Already voted this way
    
    try {
      const wallRef = doc(db, "offerwalls", wallId);
      const userVoteRef = doc(db, "user_votes", user.uid);
      
      // Update offerwall counts
      if (currentVote) {
        // Remove previous vote
        await updateDoc(wallRef, {
          [currentVote === "like" ? "likes" : "dislikes"]: increment(-1),
          [type === "like" ? "likes" : "dislikes"]: increment(1)
        });
      } else {
        // New vote
        await updateDoc(wallRef, {
          [type === "like" ? "likes" : "dislikes"]: increment(1)
        });
      }
      
      // Update user votes
      await setDoc(userVoteRef, { ...userVotes, [wallId]: type }, { merge: true });
      setUserVotes(prev => ({ ...prev, [wallId]: type }));
    } catch (error) {
      console.error("Vote error:", error);
    }
  };

  // Filter offerwalls by device
  const filteredWalls = offerwalls.filter((wall) => {
    if (deviceFilter === "all") return wall.isActive;
    return wall.isActive && wall.devices?.includes(deviceFilter);
  });

  // Calculate approval rate
  const getApprovalRate = (likes: number, dislikes: number) => {
    const total = likes + dislikes;
    if (total === 0) return 100;
    return Math.round((likes / total) * 100);
  };

  // If iframe is active, show fullscreen offerwall
  if (activeIframe) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex flex-col">
        <div className="flex items-center justify-between p-4 glass-card border-b border-border">
          <div className="flex items-center gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveIframe(null)} 
              className="text-foreground rounded-xl hover:bg-secondary"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <span className="font-bold text-foreground text-sm">{activeIframe.title}</span>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => window.open(activeIframe.url, '_blank')} 
              className="text-muted-foreground rounded-xl hover:bg-secondary"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setActiveIframe(null)} 
              className="text-muted-foreground rounded-xl hover:bg-secondary"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
        <iframe 
          src={activeIframe.url} 
          className="w-full flex-1 border-0" 
          title={activeIframe.title} 
          allow="autoplay; fullscreen" 
        />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-transparent min-h-screen pb-24">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-black text-foreground tracking-tight">Offerwalls</h1>
        <p className="text-muted-foreground text-sm font-medium">Choose an offerwall to start earning MC points</p>
      </div>

      {/* Exchange Rate Info */}
      <Card className="glass-card overflow-hidden">
        <CardContent className="p-4 flex items-center justify-center gap-4">
          <div className="flex items-center gap-2">
            <Image src="/coin.png" alt="MC" width={20} height={20} className="w-5 h-5" />
            <span className="font-bold text-foreground">1000 MC</span>
          </div>
          <span className="text-muted-foreground">=</span>
          <span className="font-bold text-primary">$1.00 USD</span>
        </CardContent>
      </Card>

      {/* Device Filter - Horizontal Scrollable */}
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {(Object.entries(deviceConfig) as [DeviceFilter, { label: string; icon: any }][]).map(([key, config]) => {
          const Icon = config.icon;
          const count = key === "all" 
            ? offerwalls.filter(w => w.isActive).length
            : offerwalls.filter(w => w.isActive && w.devices?.includes(key)).length;
          
          return (
            <button
              key={key}
              onClick={() => setDeviceFilter(key)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all whitespace-nowrap shrink-0 ${
                deviceFilter === key
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
              }`}
            >
              {Icon && <Icon className="w-5 h-5" />}
              <span className="font-bold text-sm">{config.label}</span>
              <Badge className="bg-secondary text-muted-foreground border-border text-[10px] px-2">
                {count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">
          {filteredWalls.length} offerwalls available
        </span>
      </div>

      {/* Offerwalls Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-muted-foreground font-medium">Loading offerwalls...</span>
        </div>
      ) : filteredWalls.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 glass-card rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Monitor className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No offerwalls available for this device</p>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filteredWalls.map((wall) => {
            const approvalRate = getApprovalRate(wall.likes, wall.dislikes);
            const userVote = userVotes[wall.id];
            
            return (
              <Card 
                key={wall.id} 
                className="glass-card hover:border-primary/30 transition-all group cursor-pointer hover-lift overflow-hidden"
                onClick={() => setSelectedWall(wall)}
              >
                <CardContent className="p-0">
                  {/* Header with logo */}
                  <div 
                    className="relative h-24 flex items-center justify-center"
                    style={{ backgroundColor: `${wall.color}15` }}
                  >
                    <img 
                      src={wall.logoUrl} 
                      alt={wall.name}
                      className="h-12 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = "/coin.png";
                      }}
                    />
                    
                    {/* Approval Badge */}
                    <Badge 
                      className={`absolute top-3 right-3 rounded-xl text-[10px] font-bold ${
                        approvalRate >= 80 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" 
                          : approvalRate >= 60
                          ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      }`}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {approvalRate}%
                    </Badge>

                    {/* Device badges */}
                    <div className="absolute bottom-3 left-3 flex gap-1">
                      {wall.devices?.includes("android") && (
                        <Badge className="bg-card/80 text-foreground border-0 text-[9px] px-1.5 py-0.5 rounded-lg">
                          <Smartphone className="w-3 h-3" />
                        </Badge>
                      )}
                      {wall.devices?.includes("ios") && (
                        <Badge className="bg-card/80 text-foreground border-0 text-[9px] px-1.5 py-0.5 rounded-lg">
                          <Apple className="w-3 h-3" />
                        </Badge>
                      )}
                      {wall.devices?.includes("desktop") && (
                        <Badge className="bg-card/80 text-foreground border-0 text-[9px] px-1.5 py-0.5 rounded-lg">
                          <Monitor className="w-3 h-3" />
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  {/* Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-foreground text-lg font-bold group-hover:text-primary transition-colors">
                        {wall.name}
                      </h3>
                      <p className="text-muted-foreground text-xs line-clamp-2 mt-1">
                        {wall.description}
                      </p>
                    </div>
                    
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-2 py-2 border-t border-border">
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-primary" />
                          <span className="text-foreground font-black text-sm">{wall.avgPoints.toLocaleString()}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">Avg MC</span>
                      </div>
                      <div className="text-center border-x border-border">
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          <span className="text-foreground font-black text-sm">{wall.totalOffers}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">Offers</span>
                      </div>
                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="w-3 h-3 text-emerald-500" />
                          <span className="text-foreground font-black text-sm">{wall.likes + wall.dislikes}</span>
                        </div>
                        <span className="text-[9px] text-muted-foreground">Votes</span>
                      </div>
                    </div>

                    {/* Vote buttons */}
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(wall.id, "like");
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                            userVote === "like"
                              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                              : "bg-secondary/50 border-border text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-500"
                          }`}
                        >
                          <ThumbsUp className="w-4 h-4" />
                          <span className="text-xs font-bold">{wall.likes}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVote(wall.id, "dislike");
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                            userVote === "dislike"
                              ? "bg-red-500/10 border-red-500/30 text-red-500"
                              : "bg-secondary/50 border-border text-muted-foreground hover:border-red-500/30 hover:text-red-500"
                          }`}
                        >
                          <ThumbsDown className="w-4 h-4" />
                          <span className="text-xs font-bold">{wall.dislikes}</span>
                        </button>
                      </div>
                      
                      <Button 
                        size="sm"
                        className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedWall(wall);
                        }}
                      >
                        Open
                        <ExternalLink className="w-3 h-3 ml-1.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Offerwall Detail Modal */}
      <Dialog open={!!selectedWall} onOpenChange={() => setSelectedWall(null)}>
        <DialogContent className="glass-card border-border max-w-md p-0 overflow-hidden">
          {selectedWall && (
            <>
              {/* Header */}
              <div 
                className="relative h-32 flex items-center justify-center"
                style={{ backgroundColor: `${selectedWall.color}15` }}
              >
                <img 
                  src={selectedWall.logoUrl} 
                  alt={selectedWall.name}
                  className="h-16 object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/coin.png";
                  }}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 rounded-xl bg-card/80 hover:bg-card"
                  onClick={() => setSelectedWall(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              
              <div className="p-6 space-y-4">
                <DialogTitle className="text-xl font-black text-foreground">
                  {selectedWall.name}
                </DialogTitle>
                
                <p className="text-muted-foreground text-sm">
                  {selectedWall.description}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-card p-3 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Image src="/coin.png" alt="MC" width={16} height={16} />
                      <span className="text-foreground font-black">{selectedWall.avgPoints.toLocaleString()}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Avg Reward</span>
                  </div>
                  <div className="glass-card p-3 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <Star className="w-4 h-4 text-amber-500" />
                      <span className="text-foreground font-black">{selectedWall.totalOffers}</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Offers</span>
                  </div>
                  <div className="glass-card p-3 rounded-xl text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                      <span className="text-foreground font-black">{getApprovalRate(selectedWall.likes, selectedWall.dislikes)}%</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">Approval</span>
                  </div>
                </div>

                {/* Supported Devices */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Supported Devices</span>
                  <div className="flex gap-2">
                    {selectedWall.devices?.includes("android") && (
                      <Badge className="bg-secondary text-foreground border-border rounded-xl px-3 py-1.5">
                        <Smartphone className="w-4 h-4 mr-1.5" />
                        Android
                      </Badge>
                    )}
                    {selectedWall.devices?.includes("ios") && (
                      <Badge className="bg-secondary text-foreground border-border rounded-xl px-3 py-1.5">
                        <Apple className="w-4 h-4 mr-1.5" />
                        iPhone
                      </Badge>
                    )}
                    {selectedWall.devices?.includes("desktop") && (
                      <Badge className="bg-secondary text-foreground border-border rounded-xl px-3 py-1.5">
                        <Monitor className="w-4 h-4 mr-1.5" />
                        Desktop
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Vote buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleVote(selectedWall.id, "like")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                      userVotes[selectedWall.id] === "like"
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                        : "bg-secondary/50 border-border text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-500"
                    }`}
                  >
                    <ThumbsUp className="w-5 h-5" />
                    <span className="font-bold">{selectedWall.likes}</span>
                  </button>
                  <button
                    onClick={() => handleVote(selectedWall.id, "dislike")}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border transition-all ${
                      userVotes[selectedWall.id] === "dislike"
                        ? "bg-red-500/10 border-red-500/30 text-red-500"
                        : "bg-secondary/50 border-border text-muted-foreground hover:border-red-500/30 hover:text-red-500"
                    }`}
                  >
                    <ThumbsDown className="w-5 h-5" />
                    <span className="font-bold">{selectedWall.dislikes}</span>
                  </button>
                </div>

                {/* Start button */}
                <Button 
                  className="w-full h-14 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-base"
                  onClick={() => {
                    if (selectedWall.url && selectedWall.url !== "#") {
                      setActiveIframe({ url: selectedWall.url, title: selectedWall.name });
                    }
                    setSelectedWall(null);
                  }}
                >
                  Start Earning
                  <ExternalLink className="w-5 h-5 ml-2" />
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
