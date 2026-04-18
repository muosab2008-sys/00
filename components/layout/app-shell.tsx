"use client";

import { useState, ReactNode } from "react";
import { Header } from "./header";
import { Sidebar } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { LiveFeed } from "@/components/live-feed";
import { GlobalFooter } from "./global-footer";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col lg:flex-row bg-transparent text-white overflow-hidden">
      
      {/* Sidebar - Hidden on mobile, visible on desktop */}
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={() => setSidebarOpen(false)}
        isCollapsed={sidebarCollapsed}
      />

      {/* Main content area */}
      <div className="flex flex-col flex-1 min-h-0 min-w-0 overflow-hidden">
        
        {/* Header - Sticky at top */}
        <Header 
          onMenuClick={() => setSidebarOpen(true)} 
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          isCollapsed={sidebarCollapsed}
        />

        {/* Global Live Feed - Appears on every page */}
        <LiveFeed />

        {/* Main content - transparent background */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden pb-20 lg:pb-0 bg-transparent">
          <div className="w-full min-h-full flex flex-col">
            <div className="w-full flex-1 p-0">
              {children}
            </div>
            {/* Global Footer - Appears on every page */}
            <GlobalFooter />
          </div>
        </main>
      </div>

      {/* Bottom navigation - Mobile only */}
      <BottomNav />
    </div>
  );
}
