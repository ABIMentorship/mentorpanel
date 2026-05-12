"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, RefreshCcw, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { approveSubmission, rejectSubmission, adjustPoints, changeRole, resetMonthlyData, updateStrikes } from "@/app/actions/admin";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileWithMetrics } from "./ClientDashboard";

interface AdminPanelProps {
  currentUser: ProfileWithMetrics;
  pendingSubmissions?: any[];
  rosterData?: ProfileWithMetrics[];
}

export function AdminPanel({ 
  currentUser, 
  pendingSubmissions = [], 
  rosterData = []
}: AdminPanelProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  const [guidePoints, setGuidePoints] = useState<Record<string, number>>({});
  const [pointAdjustments, setPointAdjustments] = useState<Record<string, number>>({});
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const handleAction = async (id: string, profileId: string, category: string, action: "approve" | "reject") => {
    setIsProcessing(id);
    try {
      if (action === "approve") {
        const manualPoints = category === "Guide Creation" ? (guidePoints[id] || 0) : undefined;
        
        if (category === "Guide Creation" && !manualPoints) {
          toast.error("Please enter the points to award for this guide.");
          setIsProcessing(null);
          return;
        }

        const res = await approveSubmission(id, profileId, category, manualPoints);
        if (res.error) throw new Error(res.error);
        
        toast.success(`Submission approved! Awarded ${res.awardedPoints} points.`, {
          className: "bg-green-600/20 text-green-500 border-green-600",
        });
      } else {
        const res = await rejectSubmission(id);
        if (res.error) throw new Error(res.error);
        
        toast.error("Submission rejected and images cleaned up.", {
          className: "bg-destructive/20 text-destructive border-destructive",
        });
      }
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Action failed.");
    } finally {
      setIsProcessing(null);
    }
  };

  const handlePointAdjustment = async (profileId: string) => {
    const adj = pointAdjustments[profileId];
    if (!adj) return;
    
    setIsProcessing(`adj-${profileId}`);
    try {
      const res = await adjustPoints(profileId, adj);
      if (res.error) throw new Error(res.error);
      toast.success("Points adjusted successfully.");
      setPointAdjustments(prev => ({ ...prev, [profileId]: 0 }));
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to adjust points");
    } finally {
      setIsProcessing(null);
    }
  };

  const handleRoleChange = async (profileId: string, newRole: string) => {
    if (!newRole) return;
    setIsProcessing(`role-${profileId}`);
    try {
      const res = await changeRole(profileId, newRole);
      if (res.error) throw new Error(res.error);
      toast.success("Role updated successfully.");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    } finally {
      setIsProcessing(null);
    }
  };



  const handleReset = async () => {
    if (!confirm("CRITICAL ACTION: This will reset ALL mentor points and session counts for the new month. This cannot be undone. Are you sure?")) {
      return;
    }
    
    setIsProcessing("monthly-reset");
    try {
      const res = await resetMonthlyData();
      if (res.error) throw new Error(res.error);
      toast.success("All monthly data has been reset successfully.", {
        className: "bg-primary/20 text-primary border-primary",
      });
      router.refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to reset data");
    } finally {
      setIsProcessing(null);
    }
  };

  const isSuperAdmin = currentUser.is_developer || ["Lead", "Advisor"].includes(currentUser.role);
  if (!isSuperAdmin) {
    return (
      <div className="flex justify-center items-center h-64 text-muted-foreground">
        You do not have permission to view the Admin Panel. Lead access required.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight uppercase">Command Center</h2>
        <p className="text-muted-foreground">
          Review submissions and manage incoming logs.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {pendingSubmissions.length === 0 ? (
          <div className="col-span-full py-12 text-center border border-dashed border-border rounded-lg bg-card/20">
            <h3 className="text-lg font-medium text-muted-foreground mb-1">Queue Empty</h3>
            <p className="text-sm text-muted-foreground/60">No pending submissions to review.</p>
          </div>
        ) : (
          pendingSubmissions.map((sub) => {
            const dateStr = new Date(sub.created_at).toLocaleDateString();
            const mentorName = sub.profiles?.in_game_name || "Unknown";
            const requestUrl = sub.request_screenshot_path ? `${supabaseUrl}/storage/v1/object/public/screenshots/${sub.request_screenshot_path}` : null;
            const matchUrl = sub.match_screenshot_path ? `${supabaseUrl}/storage/v1/object/public/screenshots/${sub.match_screenshot_path}` : null;

            return (
              <Card key={sub.id} className="border-border bg-card/50 backdrop-blur flex flex-col transition-all hover:border-primary/50 relative">
                {isProcessing === sub.id && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                )}
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="bg-secondary text-primary border-primary/20">
                      {sub.category}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">{dateStr}</span>
                  </div>
                  {sub.category === "Guide Creation" ? (
                    <CardTitle className="text-lg mt-2 text-primary hover:underline">
                      <a href={sub.guide_link} target="_blank" rel="noopener noreferrer">View Guide Link</a>
                    </CardTitle>
                  ) : (
                    <CardTitle className="text-lg mt-2">{sub.mentee_ign || "Evaluation Session"}</CardTitle>
                  )}
                  <CardDescription>Submitted by: <span className="text-foreground font-medium">{mentorName}</span></CardDescription>
                  {sub.mentee_uid && <p className="text-xs text-muted-foreground mt-1 font-mono">UID: {sub.mentee_uid}</p>}
                </CardHeader>
                <CardContent className="flex-grow">
                  {sub.category !== "Guide Creation" && (
                    <div className="flex space-x-2 h-24">
                      {requestUrl && (
                        <a href={requestUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded border border-border/50 overflow-hidden group hover:border-primary/50 relative">
                          <img src={requestUrl} alt="Request" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/60 transition-opacity">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">View Full</span>
                          </div>
                          <div className="absolute top-1 left-1 bg-background/80 px-1.5 py-0.5 rounded shadow text-[10px] font-bold uppercase text-muted-foreground">Request</div>
                        </a>
                      )}
                      {matchUrl && (
                        <a href={matchUrl} target="_blank" rel="noopener noreferrer" className="flex-1 rounded border border-border/50 overflow-hidden group hover:border-primary/50 relative">
                          <img src={matchUrl} alt="Match" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/60 transition-opacity">
                            <span className="text-[10px] uppercase font-bold tracking-wider text-primary">View Full</span>
                          </div>
                          <div className="absolute top-1 left-1 bg-background/80 px-1.5 py-0.5 rounded shadow text-[10px] font-bold uppercase text-muted-foreground">Match</div>
                        </a>
                      )}
                    </div>
                  )}
                  {sub.category === "Guide Creation" && (
                    <div className="pt-2">
                      <Label className="text-xs text-muted-foreground">Points to Award</Label>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="e.g. 500"
                        className="mt-1 bg-background/50"
                        value={guidePoints[sub.id] || ""}
                        onChange={(e) => setGuidePoints({ ...guidePoints, [sub.id]: parseInt(e.target.value) || 0 })}
                      />
                    </div>
                  )}
                </CardContent>
                <CardFooter className="pt-2 flex gap-2">
                  <Button 
                    onClick={() => handleAction(sub.id, sub.profile_id, sub.category, "reject")}
                    variant="outline" 
                    disabled={isProcessing === sub.id}
                    className="flex-1 border-destructive text-destructive hover:bg-destructive hover:text-white transition-colors"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                  <Button 
                    onClick={() => handleAction(sub.id, sub.profile_id, sub.category, "approve")}
                    disabled={isProcessing === sub.id || (sub.category === "Guide Creation" && !guidePoints[sub.id])}
                    className="flex-1 bg-green-600 hover:bg-green-500 text-white transition-colors"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>

      <div className="pt-8 border-t border-border mt-8">
        <h3 className="text-2xl font-bold tracking-tight uppercase mb-4">Roster Point & Role Management</h3>
        <p className="text-muted-foreground mb-6">Directly add or subtract points from mentors and update their roles.</p>
        
        <div className="space-y-4">
          {rosterData.map((mentor) => (
            <div key={mentor.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-border bg-card/30 gap-4 relative">
              {isProcessing === `role-${mentor.id}` && (
                  <div className="absolute inset-0 bg-background/50 backdrop-blur-sm z-10 flex items-center justify-center rounded-lg">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                  </div>
              )}
              <div>
                <p className="font-bold text-lg">{mentor.in_game_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{mentor.uid} • <span className="text-primary font-bold">{mentor.total_points} Points</span></p>
              </div>
              
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Role:</Label>
                  <Select value={mentor.role} onValueChange={(val) => handleRoleChange(mentor.id, val || "")}>
                    <SelectTrigger className="w-[160px] h-9 text-xs bg-background/50 border-border focus:ring-primary">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent className="bg-popover border-border">
                      <SelectItem value="Junior Mentor">Junior Mentor</SelectItem>
                      <SelectItem value="Mentor">Mentor</SelectItem>
                      <SelectItem value="Senior Mentor">Senior Mentor</SelectItem>
                      <SelectItem value="Instructor">Instructor</SelectItem>
                      <SelectItem value="Senior Instructor">Senior Instructor</SelectItem>
                      <SelectItem value="Lead Instructor">Lead Instructor</SelectItem>
                      <SelectItem value="Lead">Lead</SelectItem>
                      <SelectItem value="Advisor">Advisor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center gap-2">
                  <Input 
                    type="number" 
                    placeholder="+/- points" 
                    className="w-24 bg-background/50"
                    value={pointAdjustments[mentor.id] === 0 ? "" : (pointAdjustments[mentor.id] || "")}
                    onChange={(e) => setPointAdjustments({ ...pointAdjustments, [mentor.id]: parseInt(e.target.value) || 0 })}
                  />
                  <Button 
                    onClick={() => handlePointAdjustment(mentor.id)}
                    disabled={isProcessing === `adj-${mentor.id}` || !pointAdjustments[mentor.id]}
                    variant="secondary"
                  >
                    Apply
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {rosterData.length === 0 && (
             <div className="text-center py-8 text-muted-foreground">No mentors found in roster.</div>
          )}
        </div>
      </div>

      <div className="pt-8 border-t border-border mt-8">
        <h3 className="text-2xl font-bold tracking-tight uppercase mb-4 text-destructive flex items-center gap-2">
          <AlertTriangle className="h-6 w-6" />
          Dangerous Zone
        </h3>
        <Card className="border-destructive/50 bg-destructive/5 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-lg">Monthly Data Reset</CardTitle>
            <CardDescription>
              Clears all mentor points, session counts, and evaluation metrics for a fresh start of the month. 
              Submissions logs are preserved in history.
            </CardDescription>
          </CardHeader>
          <CardFooter>
            <Button 
              onClick={handleReset}
              disabled={isProcessing === "monthly-reset"}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              <RefreshCcw className={`mr-2 h-4 w-4 ${isProcessing === "monthly-reset" ? "animate-spin" : ""}`} />
              Reset Monthly Data Now
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
