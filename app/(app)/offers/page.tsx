"use client";

export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { collection, query, orderBy, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { ExternalLink, Search, Filter, LayoutGrid, List, DollarSign } from "lucide-react";

// تحويل النقاط (العملة) إلى دولار
const pointsToUSD = (points: any) => (parseFloat(points) / 1000).toFixed(2);

interface Offer {
  id: string;
  name: string;
  description: string;
  provider: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  type: "survey" | "app" | "video" | "signup" | "other";
  url: string;
  image?: string;
  isActive: boolean;
}

const difficultyConfig = {
  easy: { label: "سهل", color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
  medium: { label: "متوسط", color: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  hard: { label: "صعب", color: "bg-red-500/10 text-red-500 border-red-500/20" },
};

const typeConfig = {
  survey: { label: "استطلاع", color: "bg-[#3B82F6]/10 text-[#3B82F6] border-[#3B82F6]/20" },
  app: { label: "تثبيت تطبيق", color: "bg-[#8B5CF6]/10 text-[#8B5CF6] border-[#8B5CF6]/20" },
  video: { label: "فيديو", color: "bg-pink-500/10 text-pink-500 border-pink-500/20" },
  signup: { label: "تسجيل", color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20" },
  other: { label: "أخرى", color: "bg-gray-500/10 text-gray-500 border-gray-500/20" },
};

export default function OffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterDifficulty, setFilterDifficulty] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("points-high");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  useEffect(() => {
    async function fetchAllOffers() {
      setLoading(true);
      try {
        // 1. جلب عروض Offery من الـ API (عبر Route داخلي لتجنب مشاكل الـ CORS)
        const response = await fetch('/api/get-offery'); // سننشئ هذا الملف لاحقاً أو نضع الرابط مباشرة
        const result = await response.json();
        
        let fetchedOffers: Offer[] = [];

        if (result && result.status === "success") {
          fetchedOffers = result.data.map((item: any) => ({
            id: item.offer.id,
            name: item.offer.name,
            description: item.offer.description,
            provider: "Offery",
            points: parseFloat(item.payout.reward),
            image: item.offer.image,
            difficulty: "medium", // افتراضي من Offery
            type: item.offer.name.toLowerCase().includes("survey") ? "survey" : "app",
            url: item.url,
            isActive: true
          }));
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

  // الفلترة والترتيب
  const filteredOffers = offers
    .filter((offer) => {
      const matchesSearch =
        offer.name.toLowerCase().includes(search.toLowerCase()) ||
        offer.description.toLowerCase().includes(search.toLowerCase());
      const matchesType = filterType === "all" || offer.type === filterType;
      return matchesSearch && matchesType;
    })
    .sort((a, b) => {
      if (sortBy === "points-high") return b.points - a.points;
      if (sortBy === "points-low") return a.points - b.points;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-[#050505] min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">عروض Offery المباشرة</h1>
        <p className="text-white/50">أكمل العروض واحصد النقاط الآن</p>
      </div>

      {/* Filters */}
      <Card className="border-white/5 bg-[#0a0a0a] rounded-2xl shadow-2xl">
        <CardContent className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/30" />
              <Input
                placeholder="ابحث عن عرض..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-12 h-12 rounded-2xl bg-white/[0.02] border-white/5 text-white placeholder:text-white/30"
              />
            </div>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full lg:w-44 h-12 rounded-2xl bg-white/[0.02] border-white/5 text-white">
                <SelectValue placeholder="ترتيب حسب" />
              </SelectTrigger>
              <SelectContent className="bg-[#0a0a0a] border-white/10 text-white">
                <SelectItem value="points-high">الأعلى نقاطاً</SelectItem>
                <SelectItem value="points-low">الأقل نقاطاً</SelectItem>
                <SelectItem value="name">الاسم A-Z</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex rounded-2xl border border-white/5 overflow-hidden">
              <Button
                variant="ghost"
                onClick={() => setViewMode("grid")}
                className={`px-4 h-12 ${viewMode === "grid" ? "bg-white/5 text-white" : "text-white/50"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={() => setViewMode("list")}
                className={`px-4 h-12 ${viewMode === "list" ? "bg-white/5 text-white" : "text-white/50"}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-white/5 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "space-y-3"}>
          {filteredOffers.map((offer) => (
            <Card key={offer.id} className="border-white/5 bg-[#0a0a0a] rounded-2xl hover:border-[#3B82F6]/30 transition-all group">
              <CardContent className="p-5 flex flex-col h-full">
                <div className="flex items-center gap-4 mb-4">
                  <img src={offer.image} className="w-12 h-12 rounded-xl object-cover" alt="" />
                  <div className="flex-1">
                    <CardTitle className="text-white text-base line-clamp-1">{offer.name}</CardTitle>
                    <p className="text-xs text-white/40">{offer.provider}</p>
                  </div>
                </div>
                <CardDescription className="text-white/50 text-sm line-clamp-2 mb-4 flex-grow">
                  {offer.description}
                </CardDescription>
                <div className="flex items-center justify-between mt-auto">
                   <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-green-500" />
                      </div>
                      <span className="text-white font-bold text-lg">{offer.points}</span>
                   </div>
                   <Button 
                     className="rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold"
                     onClick={() => window.open(offer.url, "_blank")}
                   >
                     ابدأ العرض
                   </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
