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

  // Manual drag scroll handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setStartX(e.pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleMouseUp = () => setIsDragging(false);
  const handleMouseLeave = () => setIsDragging(false);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = e.pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  // Touch handlers for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setIsDragging(true);
    setStartX(e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0));
    setScrollLeft(scrollContainerRef.current?.scrollLeft || 0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const x = e.touches[0].pageX - (scrollContainerRef.current?.offsetLeft || 0);
    const walk = (x - startX) * 2;
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleTouchEnd = () => setIsDragging(false);

  if (feedItems.length === 0) return null;

  return (
    <div className="w-full flex justify-center py-4 bg-transparent select-none relative z-40">
      <div className="relative flex items-center h-12 w-full max-w-[1400px] glass-card overflow-visible">
        
        {/* LIVE Badge - Fixed */}
        <div className="absolute left-0 z-[60] bg-card/90 backdrop-blur-xl px-5 h-full flex items-center border-r border-border rounded-l-2xl">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] brand-gradient-text">Live</span>
          </div>
        </div>

        {/* Scrollable Container - Can be dragged left/right */}
        <div 
          ref={scrollContainerRef}
          className="flex-1 h-full overflow-x-auto no-scrollbar rounded-2xl ml-24 relative z-10 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex whitespace-nowrap items-center h-full animate-scroll group hover:[animation-play-state:paused]">
            {[...feedItems, ...feedItems].map((item, index) => {
              const itemId = `${item.id}-${index}`;
              return (
                <div
                  key={itemId}
                  className="relative inline-flex items-center gap-3 px-6 border-r border-border last:border-none cursor-pointer group/item h-full"
                  onMouseEnter={() => setActiveTooltip(itemId)}
                  onMouseLeave={() => setActiveTooltip(null)}
                  onClick={() => setActiveTooltip(activeTooltip === itemId ? null : itemId)}
                >
                  <Avatar className="h-7 w-7 border border-border rounded-lg">
                    <AvatarImage src={item.photoURL} />
                    <AvatarFallback className="bg-secondary text-[10px] rounded-lg">{item.username?.[0]}</AvatarFallback>
                  </Avatar>
                  
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-foreground">{item.username}</span>
                    <div className="flex items-center gap-1.5 bg-primary/10 px-2 py-0.5 rounded-lg border border-primary/20">
                      <Image src="/coin.png" alt="MC" width={14} height={14} className="w-3.5 h-3.5" />
                      <span className="font-black text-primary">{(item.points || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Tooltip - Info popup when clicked/hovered */}
                  <div className={`
                    absolute bottom-[120%] left-1/2 -translate-x-1/2 w-56 
                    glass-card p-4 shadow-2xl
                    transition-all duration-300 z-[999] pointer-events-none
                    ${activeTooltip === itemId ? "opacity-100 visible translate-y-0 scale-100" : "opacity-0 invisible translate-y-4 scale-95"}
                  `}>
                    <div className="space-y-2 text-left">
                      <div className="flex flex-col border-b border-border pb-1.5">
                        <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">User Name:</span>
                        <span className="text-xs font-black text-foreground">{item.username}</span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-widest">Offer Name:</span>
                        <span className="text-[10px] font-bold text-primary truncate">{item.offerName || "Task Completed"}</span>
                      </div>
                      <div className="flex justify-between items-end pt-1">
                        <div>
                          <span className="text-[8px] text-muted-foreground uppercase font-bold block">Offerwall:</span>
                          <span className="text-[10px] font-bold text-accent">{item.source}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[8px] text-muted-foreground uppercase font-bold block">Reward:</span>
                          <span className="text-xs font-black text-primary">{item.points} MC</span>
                        </div>
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-[98%] left-1/2 -translate-x-1/2 w-3 h-3 bg-card border-b border-r border-border rotate-45"></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Fade effect on right */}
        <div className="absolute right-0 top-0 bottom-0 w-20 z-20 bg-gradient-to-l from-background to-transparent pointer-events-none rounded-r-2xl" />
      </div>
    </div>
  );
}
