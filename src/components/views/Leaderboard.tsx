"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Crown, Star } from "lucide-react";
import { ProfileWithMetrics } from "./ClientDashboard";

interface LeaderboardProps {
  members: ProfileWithMetrics[];
}

export function Leaderboard({ members }: LeaderboardProps) {
  // Sort members by total points descending
  const sortedMembers = [...members].sort((a, b) => b.total_points - a.total_points);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500/20 animate-pulse" />;
      case 1:
        return <Medal className="h-6 w-6 text-slate-300 fill-slate-300/20" />;
      case 2:
        return <Medal className="h-6 w-6 text-amber-600 fill-amber-600/20" />;
      default:
        return <span className="font-mono font-bold text-muted-foreground">#{index + 1}</span>;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case "Advisor":
      case "Lead":
        return <Badge className="bg-red-500/20 text-red-500 border-red-500/30 uppercase text-[10px]">{role}</Badge>;
      case "Senior Instructor":
        return <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px]">Sr. Instructor</Badge>;
      case "Lead Instructor":
      case "Instructor":
        return <Badge className="bg-primary/20 text-primary border-primary/30 uppercase text-[10px]">{role === "Lead Instructor" ? "Lead Instructor" : "Instructor"}</Badge>;
      case "Senior Mentor":
        return <Badge className="bg-blue-500/20 text-blue-500 border-blue-500/30 uppercase text-[10px]">Senior Mentor</Badge>;
      case "Mentor":
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30 uppercase text-[10px]">Mentor</Badge>;
      case "Junior Mentor":
        return <Badge className="bg-yellow-500/20 text-yellow-500 border-yellow-500/30 uppercase text-[10px]">Junior Mentor</Badge>;
      default:
        return <Badge variant="outline" className="uppercase text-[10px]">{role}</Badge>;
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col space-y-2">
        <div className="flex items-center gap-3">
          <Trophy className="h-8 w-8 text-primary" />
          <h2 className="text-3xl font-black tracking-tighter uppercase italic">Hall of Fame</h2>
        </div>
        <p className="text-muted-foreground uppercase tracking-widest text-xs font-bold opacity-70">
          Operational performance rankings for the current cycle
        </p>
      </div>

      {/* Top 3 Spotlight */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
        {sortedMembers.slice(0, 3).map((member, idx) => (
          <Card key={member.id} className={`relative overflow-hidden border-2 ${
            idx === 0 ? "border-primary/50 bg-primary/5 scale-105 z-10" : "border-border/40 bg-card/40"
          } backdrop-blur-sm transition-all hover:border-primary/40`}>
            {idx === 0 && (
              <div className="absolute top-0 right-0 p-2 opacity-20">
                <Crown className="h-24 w-24 text-primary rotate-12" />
              </div>
            )}
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <div className="bg-background/80 p-2 rounded-full border border-border/50">
                {getRankIcon(idx)}
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-muted-foreground uppercase tracking-tighter">Score</p>
                <p className="text-2xl font-black text-primary font-mono">{member.total_points.toLocaleString()}</p>
              </div>
            </CardHeader>
            <CardContent>
              <h3 className="text-2xl font-bold truncate mb-1">{member.discord_id} <span className="text-base font-normal text-muted-foreground">({member.in_game_name})</span></h3>
              <div className="flex items-center gap-2">
                {getRoleBadge(member.role)}
                <span className="text-[10px] font-mono text-muted-foreground uppercase">{member.timezone || "UTC+0"}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Detailed List */}
      <Card className="border-border/40 bg-card/30 backdrop-blur-md">
        <CardHeader className="border-b border-border/20 py-4">
          <CardTitle className="text-sm font-bold uppercase tracking-[0.2em] flex items-center gap-2">
            <Star className="h-4 w-4 text-primary" />
            Ranked Personnel
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-background/40 text-[10px] uppercase font-black tracking-widest text-muted-foreground border-b border-border/20">
                  <th className="px-6 py-4 w-20">Rank</th>
                  <th className="px-6 py-4">Personnel</th>
                  <th className="px-6 py-4">Designation</th>
                  <th className="px-6 py-4">Timezone</th>
                  <th className="px-6 py-4 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/10">
                {sortedMembers.map((member, idx) => (
                  <tr key={member.id} className="hover:bg-primary/5 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <span className={`text-sm font-mono font-bold ${idx < 3 ? "text-primary" : "text-muted-foreground"}`}>
                          {(idx + 1).toString().padStart(2, '0')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-base group-hover:text-primary transition-colors">{member.discord_id} <span className="text-sm font-normal text-muted-foreground">({member.in_game_name})</span></span>
                    </td>
                    <td className="px-6 py-4">
                      {getRoleBadge(member.role)}
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-mono text-muted-foreground">{member.timezone || "UTC+0"}</span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className="font-mono font-bold text-primary">{member.total_points.toLocaleString()}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
