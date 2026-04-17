"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState, useRef, useCallback } from "react";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/auth-context";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { 
  ExternalLink, 
  Search, 
  LayoutGrid, 
  List, 
  Coins,
  Filter,
  Loader2,
  CheckCircle,
  XCircle,
  Star,
  ArrowLeft,
  Maximize2,
  X,
  ThumbsUp,
  ThumbsDown
} from "lucide-react";
import Image from "next/image";

// Convert USD to MC points ($1 = 1000 MC)
const usdToMC = (usd: number) => Math.round(usd * 1000);
// Convert MC points to USD
const mcToUSD = (mc: number) => (mc / 1000).toFixed(2);

type Provider = "all" | "offery" | "adgate" | "cpx" | "lootably";

interface Offer {
  id: string;
  name: string;
  description: string;
  provider: string;
  mcPoints: number; // Points in MC currency
  usdValue: number; // Original USD value
  image?: string;
  url: string;
  type?: string;
  difficulty?: "easy" | "medium" | "hard";
  isActive: boolean;
}

interface OfferwallConfig {
  id: string;
  name: string;
  description: string;
  logoUrl: string;
  color: string;
  likes: number;
  dislikes: number;
  isActive: boolean;
}

const providerConfig: Record<string, { label: string; color: string; icon: string }> = {
  all: { label: "All Providers", color: "#3B82F6", icon: "" },
  offery: { label: "Offery", color: "#ffc107", icon: "https://earng.net/storage/providers/x5v40jKJIoMPSNXMmiyTkK0eWIGXHPXSsAT2QRYb.png" },
  adgate: { label: "AdGate", color: "#10B981", icon: "https://cdn.adgatemedia.com/images/logo_small.png" },
  cpx: { label: "CPX Research", color: "#8B5CF6", icon: "https://cpx-research.com/assets/img/cpx-research-logo-full.png" },
  lootably: { label: "Lootably", color: "#EC4899", icon: "https://www.lootably.com/images/logo.png" },
};

const difficultyConfig = {
  easy: { label: "Easy", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  medium: { label: "Medium", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  hard: { label: "Hard", color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

export default function OffersPage() {
  const { userData } = useAuth();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [offerwalls, setOfferwalls] = useState<OfferwallConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProvider, setSelectedProvider] = useState<Provider>("all");
  const [sortBy, setSortBy] = useState<string>("points-high");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [displayMode, setDisplayMode] = useState<"mc" | "usd">("mc");
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [activeIframe, setActiveIframe] = useState<{url: string, title: string} | null>(null);
  
  // Horizontal scroll for provider filter
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollRef.current?.offsetLeft || 0));
    setScrollLeft(scrollRef.current?.scrollLeft || 0);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);
  
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  // Load offerwalls from Firestore for likes/dislikes
  useEffect(() => {
    const q = query(collection(db, "offerwalls"), orderBy("avgPoints", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const walls = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name,
            description: data.description,
            logoUrl: data.logoUrl,
            color: data.color,
            likes: data.likes || 0,
            dislikes: data.dislikes || 0,
            isActive: data.isActive ?? true,
          };
        }) as OfferwallConfig[];
        setOfferwalls(walls);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch offers from API
  useEffect(() => {
    async function fetchAllOffers() {
      setLoading(true);
      try {
        const response = await fetch('/api/offery');
        const result = await response.json();
        
        let fetchedOffers: Offer[] = [];

        if (result && result.status === "success" && result.data) {
          fetchedOffers = result.data.map((item: any) => {
            const usdPayout = parseFloat(item.payout?.reward || item.payout || 0);
            return {
              id: item.offer?.id || item.id || Math.random().toString(36),
              name: item.offer?.name || item.name || "Unknown Offer",
              description: item.offer?.description || item.description || "",
              provider: "Offery",
              mcPoints: usdToMC(usdPayout),
              usdValue: usdPayout,
              image: item.offer?.image || item.image,
              difficulty: getDifficulty(usdPayout),
              type: item.offer?.name?.toLowerCase().includes("survey") ? "survey" : "app",
              url: item.url || "#",
              isActive: true
            };
          });
        }

        setOffers(fetchedOffers);
      } catch (error) {
        console.error("Error fetching offers:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchAllOffers();
  }, []);

  // Determine difficulty based on USD value
  function getDifficulty(usd: number): "easy" | "medium" | "hard" {
    if (usd < 1) return "easy";
    if (usd < 5) return "medium";
    return "hard";
  }

  // Handle like/dislike
  const handleVote = async (offerwallId: string, type: "like" | "dislike") => {
    try {
      const ref = doc(db, "offerwalls", offerwallId);
      await updateDoc(ref, {
        [type === "like" ? "likes" : "dislikes"]: increment(1)
      });
    } catch (error) {
      console.error("Vote error:", error);
    }
  };

  // Filter and sort offers
  const filteredOffers = offers
    .filter((offer) => {
      const matchesSearch =
        offer.name.toLowerCase().includes(search.toLowerCase()) ||
        offer.description.toLowerCase().includes(search.toLowerCase());
      const matchesProvider = selectedProvider === "all" || 
        offer.provider.toLowerCase() === selectedProvider;
      return matchesSearch && matchesProvider && offer.isActive;
    })
    .sort((a, b) => {
      if (sortBy === "points-high") return b.mcPoints - a.mcPoints;
      if (sortBy === "points-low") return a.mcPoints - b.mcPoints;
      return a.name.localeCompare(b.name);
    });

  // Get offerwall config for an offer
  const getOfferwallConfig = (providerName: string): OfferwallConfig | undefined => {
    return offerwalls.find(w => w.name.toLowerCase() === providerName.toLowerCase());
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight">Earn MC</h1>
          <p className="text-muted-foreground text-sm font-medium">Complete offers and earn MC points instantly</p>
        </div>
        
        {/* Currency Toggle */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Display:</span>
          <div className="flex rounded-xl border border-border overflow-hidden">
            <button
              onClick={() => setDisplayMode("mc")}
              className={`px-4 py-2 text-xs font-bold transition-all ${
                displayMode === "mc" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              MC
            </button>
            <button
              onClick={() => setDisplayMode("usd")}
              className={`px-4 py-2 text-xs font-bold transition-all ${
                displayMode === "usd" 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-muted-foreground hover:text-foreground"
              }`}
            >
              USD
            </button>
          </div>
        </div>
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

      {/* Provider Filter - Horizontal Scrollable */}
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-scrollbar cursor-grab active:cursor-grabbing py-2"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
      >
        {Object.entries(providerConfig).map(([key, config]) => (
          <button
            key={key}
            onClick={() => setSelectedProvider(key as Provider)}
            className={`flex items-center gap-2 px-5 py-3 rounded-xl border transition-all whitespace-nowrap shrink-0 ${
              selectedProvider === key
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border bg-secondary/50 text-muted-foreground hover:border-primary/30 hover:text-foreground"
            }`}
          >
            {config.icon && (
              <img src={config.icon} alt="" className="w-5 h-5 object-contain rounded" />
            )}
            <span className="font-bold text-sm">{config.label}</span>
            {key !== "all" && (
              <Badge className="bg-secondary text-muted-foreground border-border text-[10px] px-2">
                {offers.filter(o => o.provider.toLowerCase() === key).length}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Search and Filters */}
      <Card className="glass-card">
        <CardContent className="p-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search offers..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 rounded-xl bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-48 h-12 rounded-xl bg-secondary/50 border-border text-foreground">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border text-foreground">
                <SelectItem value="points-high">Highest Reward</SelectItem>
                <SelectItem value="points-low">Lowest Reward</SelectItem>
                <SelectItem value="name">Name A-Z</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-xl border border-border overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => setViewMode("grid")}
                className={`px-4 h-12 rounded-none ${viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setViewMode("list")}
                className={`px-4 h-12 rounded-none ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground"}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Bar */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">
          {filteredOffers.length} offers available
        </span>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter className="h-4 w-4" />
          <span className="font-medium">
            {selectedProvider === "all" ? "All Providers" : providerConfig[selectedProvider]?.label}
          </span>
        </div>
      </div>

      {/* Offers Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-muted-foreground font-medium">Loading offers...</span>
        </div>
      ) : filteredOffers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4 glass-card rounded-2xl">
          <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center">
            <Search className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground font-medium">No offers found</p>
          <p className="text-sm text-muted-foreground">Try adjusting your filters or search</p>
        </div>
      ) : (
        <div className={viewMode === "grid" 
          ? "grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
          : "space-y-3"
        }>
          {filteredOffers.map((offer) => {
            const wallConfig = getOfferwallConfig(offer.provider);
            
            return (
              <Card 
                key={offer.id} 
                className="glass-card hover:border-primary/30 transition-all group cursor-pointer hover-lift overflow-hidden"
                onClick={() => setSelectedOffer(offer)}
              >
                <CardContent className="p-0">
                  {/* Offer Image */}
                  <div className="relative h-32 bg-secondary/50 overflow-hidden">
                    {offer.image ? (
                      <img 
                        src={offer.image} 
                        alt={offer.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Coins className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Difficulty Badge */}
                    {offer.difficulty && (
                      <Badge className={`absolute top-3 right-3 rounded-lg text-[10px] font-bold ${difficultyConfig[offer.difficulty].color}`}>
                        {difficultyConfig[offer.difficulty].label}
                      </Badge>
                    )}
                    
                    {/* Provider Badge */}
                    <Badge className="absolute top-3 left-3 rounded-lg bg-card/80 backdrop-blur-sm text-foreground border-0 text-[10px] font-bold">
                      {offer.provider}
                    </Badge>
                  </div>
                  
                  {/* Offer Details */}
                  <div className="p-4 space-y-3">
                    <div>
                      <CardTitle className="text-foreground text-sm font-bold line-clamp-1 group-hover:text-primary transition-colors">
                        {offer.name}
                      </CardTitle>
                      <CardDescription className="text-muted-foreground text-xs line-clamp-2 mt-1">
                        {offer.description}
                      </CardDescription>
                    </div>
                    
                    <div className="flex items-center justify-between pt-2 border-t border-border">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Image src="/coin.png" alt="MC" width={16} height={16} className="w-4 h-4" />
                        </div>
                        <div>
                          <span className="text-foreground font-black text-lg">
                            {displayMode === "mc" 
                              ? offer.mcPoints.toLocaleString()
                              : `$${offer.usdValue.toFixed(2)}`
                            }
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-1">
                            {displayMode === "mc" ? "MC" : "USD"}
                          </span>
                        </div>
                      </div>
                      
                      <Button 
                        size="sm"
                        className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-4"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveIframe({ url: offer.url, title: offer.name });
                        }}
                      >
                        Start
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Offer Detail Modal */}
      <Dialog open={!!selectedOffer} onOpenChange={() => setSelectedOffer(null)}>
        <DialogContent className="bg-card border border-border text-foreground rounded-2xl sm:max-w-[500px] p-0 overflow-hidden shadow-2xl">
          <DialogTitle className="sr-only">{selectedOffer?.name}</DialogTitle>
          
          {selectedOffer && (
            <>
              {/* Modal Header Image */}
              <div className="relative h-48 bg-secondary/50 overflow-hidden">
                {selectedOffer.image ? (
                  <img 
                    src={selectedOffer.image} 
                    alt={selectedOffer.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Coins className="h-16 w-16 text-muted-foreground" />
                  </div>
                )}
                
                <button 
                  onClick={() => setSelectedOffer(null)}
                  className="absolute top-4 right-4 w-10 h-10 rounded-xl bg-card/80 backdrop-blur-sm flex items-center justify-center hover:bg-card transition-colors"
                >
                  <X className="h-5 w-5 text-foreground" />
                </button>
                
                {/* Provider Badge */}
                <Badge className="absolute bottom-4 left-4 rounded-lg bg-card/80 backdrop-blur-sm text-foreground border-0 font-bold">
                  {selectedOffer.provider}
                </Badge>
              </div>
              
              {/* Modal Content */}
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-xl font-black text-foreground">{selectedOffer.name}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{selectedOffer.description}</p>
                </div>
                
                {/* Reward Display */}
                <div className="glass-card p-4 rounded-xl">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">Reward</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Image src="/coin.png" alt="MC" width={24} height={24} className="w-6 h-6" />
                        <span className="text-2xl font-black text-foreground">
                          {selectedOffer.mcPoints.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground">MC</span>
                      </div>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-lg font-bold text-primary">
                        ${selectedOffer.usdValue.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Difficulty */}
                {selectedOffer.difficulty && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground font-medium">Difficulty</span>
                    <Badge className={`rounded-lg text-xs font-bold ${difficultyConfig[selectedOffer.difficulty].color}`}>
                      {difficultyConfig[selectedOffer.difficulty].label}
                    </Badge>
                  </div>
                )}
                
                {/* Vote Section - Connected to Database */}
                {(() => {
                  const wallConfig = getOfferwallConfig(selectedOffer.provider);
                  if (!wallConfig) return null;
                  
                  const totalVotes = wallConfig.likes + wallConfig.dislikes;
                  const likePercent = totalVotes > 0 ? (wallConfig.likes / totalVotes) * 100 : 50;
                  
                  return (
                    <div className="space-y-3">
                      <span className="text-sm text-muted-foreground font-medium">User Rating</span>
                      
                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-secondary rounded-full overflow-hidden flex border border-border">
                        <div 
                          className="h-full bg-emerald-500 transition-all duration-500" 
                          style={{ width: `${likePercent}%` }}
                        />
                        <div 
                          className="h-full bg-red-500" 
                          style={{ width: `${100 - likePercent}%` }}
                        />
                      </div>
                      
                      {/* Vote Buttons */}
                      <div className="flex items-center justify-between">
                        <button 
                          onClick={() => handleVote(wallConfig.id, "like")}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 hover:bg-emerald-500/20 transition-colors"
                        >
                          <ThumbsUp className="h-4 w-4" />
                          <span className="font-bold text-sm">{wallConfig.likes}</span>
                        </button>
                        <button 
                          onClick={() => handleVote(wallConfig.id, "dislike")}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500/20 transition-colors"
                        >
                          <ThumbsDown className="h-4 w-4" />
                          <span className="font-bold text-sm">{wallConfig.dislikes}</span>
                        </button>
                      </div>
                    </div>
                  );
                })()}
                
                {/* Complete Offer Button */}
                <Button 
                  className="w-full h-14 brand-gradient hover:opacity-90 text-white font-bold rounded-xl transition-all text-sm shadow-lg glow-primary"
                  onClick={() => {
                    setSelectedOffer(null);
                    setActiveIframe({ url: selectedOffer.url, title: selectedOffer.name });
                  }}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Complete Offer
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
