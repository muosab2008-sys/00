"use client";

import { useEffect, useState, useRef } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Image from "next/image";

export function LiveFeed() {
  const [feedItems, setFeedItems] = useState<any[]>([]);
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "live_feed"), orderBy("createdAt", "desc"), limit(15));
    return onSnapshot(q, (snapshot) => {
      setFeedItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
  }, []);

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    scrollContainerRef.current.style.cursor = 'grabbing';
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.style.cursor = 'grab';
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.touches[0].pageX - scrollContainerRef.current.offsetLeft);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    const x = e.touches[0].pageX - scrollContainerRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walk;
  };

  const handleTouchEnd = () => setIsDragging(false);

  if (feedItems.length === 0) return null;

  return (
    <div className="w-full flex justify-center py-3 px-4 bg-transparent select-none relative z-40">
      <div className="relative flex items-center h-14 w-full glass-card overflow-hidden rounded-2xl">
        
        {/* LIVE Badge - Fixed on left */}
        <div className="shrink-0 bg-card/90 backdrop-blur-xl px-4 h-full flex items-center border-r border-border">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-[11px] font-black uppercase tracking-wider text-foreground">Live</span>
          </div>
        </div>

        {/* Scrollable Container - Smooth manual drag */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-x-auto overflow-y-hidden scroll-smooth"
          style={{ 
            scrollbarWidth: 'none', 
            msOverflowStyle: 'none',
            cursor: 'grab',
            WebkitOverflowScrolling: 'touch'
          }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="inline-flex items-center h-full gap-0 min-w-max">
            {feedItems.map((item, index) => {
              const itemId = `${item.id}-${index}`;
              return (
                <div
                  key={itemId}
                  className="relative inline-flex items-center gap-3 px-5 border-r border-border/50 h-full hover:bg-secondary/30 transition-colors"
                  onMouseEnter={() => !isDragging && setActiveTooltip(itemId)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={(e) => {
                    if (!isDragging) {
                      e.stopPropagation();
                      setActiveTooltip(activeTooltip === itemId ? null : itemId);
                    }
                  }}
                >
                  <Avatar className="h-8 w-8 border border-border rounded-xl shrink-0">
                    <AvatarImage src={item.photoURL} />
                    <AvatarFallback className="bg-secondary text-[10px] rounded-xl font-bold">{item.username?.[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex items-center gap-2.5">
                    <span className="font-bold text-foreground text-sm whitespace-nowrap">{item.username}</span>
                    <div className="flex items-center gap-1.5 bg-primary/10 px-2.5 py-1 rounded-xl border border-primary/20">
                      <Image src="/coin.png" alt="MC" width={14} height={14} className="w-4 h-4" />
                      <span className="font-black text-primary text-sm">{(item.points || 0).toLocaleString()}</span>
                      <span className="text-[10px] text-primary/70 font-bold">MC</span>
                    </div>
                  </div>

                  {/* Tooltip popup */}
                  {activeTooltip === itemId && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-60 glass-card p-4 shadow-2xl z-[999] pointer-events-none">
                      <div className="space-y-2.5 text-left">
                        <div className="flex flex-col border-b border-border pb-2">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">User</span>
                          <span className="text-sm font-black text-foreground">{item.username}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Offer</span>
                          <span className="text-xs font-bold text-primary">{item.offerName || "Task Completed"}</span>
                        </div>
                        <div className="flex justify-between items-end pt-1">
                          <div>
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">Provider</span>
                            <span className="text-xs font-bold text-accent">{item.source || "Offery"}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] text-muted-foreground uppercase font-bold block">Reward</span>
                            <span className="text-sm font-black text-primary">{item.points} MC</span>
                          </div>
                        </div>
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] w-3 h-3 bg-card border-b border-r border-border rotate-45"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
