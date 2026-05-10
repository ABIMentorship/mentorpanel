"use client";

import { Button } from "@/components/ui/button";

import { ProfileWithMetrics } from "../views/ClientDashboard";
import { ProfileSettingsDialog } from "../views/ProfileSettingsDialog";

interface NavbarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  currentUser: ProfileWithMetrics;
}

export function Navbar({ activeView, setActiveView, currentUser }: NavbarProps) {
  const isAdmin = ["Instructor", "Senior Instructor", "Lead"].includes(currentUser.role);
  
  const navItems = [
    { id: "roster", label: "Public Roster" },
    { id: "leaderboard", label: "Leaderboard" },
    { id: "mentor", label: "Mentor Panel" },
    ...(isAdmin ? [{ id: "admin", label: "Admin Panel" }] : []),
    ...(currentUser.role === "Lead" ? [{ id: "history", label: "History" }] : []),
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-16 items-center px-4">
        <div className="mr-8 hidden md:flex items-center gap-3">
          <img src="/Mentor_Academy.png" alt="Mentor Academy" className="h-10 w-10 object-cover rounded border border-primary/30" />
          <span className="font-heading font-bold text-xl tracking-tight text-white uppercase">
            Mentor<span className="text-primary">Academy</span>
          </span>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="flex items-center space-x-2 lg:space-x-4">
            {navItems.map((item) => (
              <Button
                key={item.id}
                variant={activeView === item.id ? "default" : "ghost"}
                className={`text-sm font-bold uppercase tracking-wider transition-all ${
                  activeView === item.id 
                    ? "bg-primary text-black hover:bg-primary/90" 
                    : "text-muted-foreground hover:text-primary hover:bg-primary/10"
                }`}
                onClick={() => setActiveView(item.id)}
              >
                {item.label}
              </Button>
            ))}
            <div className="pl-4 border-l border-border/50 flex items-center">
              <ProfileSettingsDialog currentUser={currentUser} />
            </div>
          </nav>
        </div>
      </div>
    </nav>
  );
}
