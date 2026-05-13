"use client";

import { useState } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { PublicRoster } from "@/components/views/PublicRoster";
import { MentorPanel } from "@/components/views/MentorPanel";
import { AdminPanel } from "@/components/views/AdminPanel";
import { MentorshipHistory } from "@/components/views/MentorshipHistory";
import { Leaderboard } from "@/components/views/Leaderboard";

export type ProfileWithMetrics = {
  id: string;
  discord_id: string;
  in_game_name: string;
  uid: string;
  timezone?: string;
  role: string;
  is_developer?: boolean;
  total_points: number;
  mentor_metrics: {
    participation_points: number;
    mentoring_points: number;
    co_host_points: number;
    abih_responses_points: number;
    knowledge_points: number;
    communication_points: number;
    behavior_points: number;
    exam_passed: boolean;
    strikes: string;
    quota: number;
  };
};

interface ClientDashboardProps {
  currentUser: ProfileWithMetrics;
  rosterData: ProfileWithMetrics[];
  pendingSubmissions?: any[];
  approvedMentorships?: any[];
}

export function ClientDashboard({ 
  currentUser, 
  rosterData, 
  pendingSubmissions = [], 
  approvedMentorships = [] 
}: ClientDashboardProps) {
  const [activeView, setActiveView] = useState("roster");

  return (
    <div className="min-h-screen bg-[url('/bg-texture.png')] bg-cover bg-fixed bg-center">
      {/* Tactical overlay */}
      <div className="fixed inset-0 bg-background/95 pointer-events-none z-[-1]" />
      <div className="fixed inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/5 via-background to-background pointer-events-none z-[-1]" />

      <Navbar activeView={activeView} setActiveView={setActiveView} currentUser={currentUser} />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl animate-in fade-in duration-500">
        {activeView === "roster" && <PublicRoster mentors={rosterData} currentUser={currentUser} />}
        {activeView === "mentor" && <MentorPanel currentUser={currentUser} />}
        {activeView === "admin" && (
          <AdminPanel 
            currentUser={currentUser} 
            pendingSubmissions={pendingSubmissions} 
            rosterData={rosterData}
          />
        )}
        {activeView === "history" && (
          <MentorshipHistory approvedMentorships={approvedMentorships} />
        )}
        {activeView === "leaderboard" && (
          <Leaderboard members={rosterData} />
        )}
      </main>

      <footer className="container mx-auto px-4 py-16 border-t border-border/20 mt-auto flex flex-col items-center gap-8">
        <img src="/Picture1.png" alt="Arena Breakout Infinite" className="h-16 w-auto invert brightness-0 invert" />
        <h1 className="text-3xl font-black tracking-tighter uppercase italic">{currentUser.discord_id}</h1>
        <div className="text-[11px] uppercase tracking-[0.25em] font-bold text-center space-y-3">
          <p className="text-muted-foreground">© 2026 MENTOR ACADEMY • TACTICAL EVALUATION SYSTEM</p>
          <div className="flex items-center justify-center gap-3 text-[11px]">
            <span className="italic text-muted-foreground font-bold">STRICTLY FOR INTERNAL USE ONLY</span>
            <span className="text-border/50">•</span>
            <span className="uppercase tracking-tighter italic">Welcome Back, {currentUser.discord_id}</span>
            <span className="tracking-[0.2em] font-black text-muted-foreground">
              MADE BY <a href="https://zleep.dev" target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 transition-all underline-offset-4 decoration-primary/30 hover:decoration-primary">ZLEEP</a>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
