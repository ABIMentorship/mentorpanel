"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";

import { ProfileWithMetrics } from "./ClientDashboard";
import { createClient } from "@/utils/supabase/client";
import { submitLog } from "@/app/actions/submissions";

import { useRouter } from "next/navigation";

interface MentorPanelProps {
  currentUser: ProfileWithMetrics;
}

export function MentorPanel({ currentUser }: MentorPanelProps) {
  const router = useRouter();
  const [category, setCategory] = useState<string>("");
  const [menteeIgn, setMenteeIgn] = useState<string>("");
  const [menteeUid, setMenteeUid] = useState<string>("");
  const [guideLink, setGuideLink] = useState<string>("");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [matchFile, setMatchFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const supabase = createClient();
  
  const isAdmin = ["Instructor", "Senior Instructor", "Lead"].includes(currentUser.role);

  // Dynamic Progress Logic
  const currentPoints = currentUser.total_points || 0;
  const tiers = [
    { points: 500, bonds: 500 },
    { points: 1000, bonds: 1000 },
    { points: 1500, bonds: 2400 },
    { points: 2000, bonds: 3600 },
    { points: 3000, bonds: 6000 },
    { points: 4000, bonds: 12000 },
  ];

  const nextTier = tiers.find(t => currentPoints < t.points) || tiers[tiers.length - 1];
  const isMaxed = currentPoints >= 4000;
  const pointsNeeded = isMaxed ? 0 : nextTier.points - currentPoints;
  const progressPercentage = isMaxed ? 100 : (currentPoints / nextTier.points) * 100;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'request' | 'match') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        toast.error("File size must be less than 5MB", { className: "bg-destructive text-destructive-foreground border-destructive" });
        return;
      }
      if (type === 'request') setRequestFile(file);
      else setMatchFile(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (category === "Mentoring Session" && (!menteeIgn || !menteeUid)) {
      toast.error("Please fill all required fields.", {
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
      return;
    }
    
    if (category === "Guide Creation" && !guideLink) {
      toast.error("Please provide the guide link.", {
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
      return;
    }

    if ((category === "Mentoring Session" || category === "Evaluation") && (!requestFile || !matchFile)) {
      toast.error("Please upload both Request and Match screenshots.", {
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
      return;
    }

    if (!category) {
      toast.error("Please select a category.", {
        className: "bg-destructive text-destructive-foreground border-destructive",
      });
      return;
    }

    setIsSubmitting(true);
    let requestScreenshotPath = "";
    let matchScreenshotPath = "";

    try {
      if (requestFile) {
        const ext = requestFile.name.split('.').pop();
        const fileName = `${currentUser.id}/request-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(fileName, requestFile);
        if (uploadError) throw uploadError;
        requestScreenshotPath = fileName;
      }

      if (matchFile) {
        const ext = matchFile.name.split('.').pop();
        const fileName = `${currentUser.id}/match-${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('screenshots').upload(fileName, matchFile);
        if (uploadError) throw uploadError;
        matchScreenshotPath = fileName;
      }

      const res = await submitLog({
        category,
        menteeIgn,
        menteeUid,
        guideLink,
        requestScreenshotPath,
        matchScreenshotPath,
      });

      if (res.error) {
        toast.error(res.error, { className: "bg-destructive text-destructive-foreground border-destructive" });
      } else {
        toast.success("Submission successful! Pending admin approval.", {
          className: "bg-primary text-black border-primary",
        });
        setMenteeIgn("");
        setMenteeUid("");
        setCategory("");
        setGuideLink("");
        setRequestFile(null);
        setMatchFile(null);
        // Add router.refresh to ensure data is synced
        router.refresh();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to upload screenshots.", { className: "bg-destructive text-destructive-foreground border-destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight uppercase">Mentor Dashboard</h2>
        <p className="text-muted-foreground">
          Submit activity proof and track your progression.
        </p>
      </div>

      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex justify-between items-center mb-2">
            <CardTitle className="uppercase text-lg">{isMaxed ? "Max Tier Reached" : "Next Reward Tier"}</CardTitle>
            <span className="text-sm font-mono text-primary">{currentPoints} / {nextTier.points} PTS</span>
          </div>
          <Progress value={progressPercentage} className="h-2 bg-secondary" />
          <CardDescription className="mt-2">
            {isMaxed ? (
              <span className="text-primary font-medium">You have unlocked the maximum reward!</span>
            ) : (
              <>Earn {pointsNeeded} more points to unlock <strong className="text-primary">{nextTier.bonds} Bonds</strong>.</>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase text-lg">Submit Mentorship</CardTitle>
          <CardDescription>Upload proof of your mentoring activity for review.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="category">Activity Category</Label>
              <Select value={category} onValueChange={(val) => setCategory(val || "")}>
                <SelectTrigger className="bg-background/50 border-border focus:ring-primary">
                  <SelectValue placeholder="Select activity type..." />
                </SelectTrigger>
                <SelectContent className="bg-popover border-border">
                  {currentUser.role !== 'Junior Mentor' && (
                    <SelectItem value="Mentoring Session">Mentoring Session</SelectItem>
                  )}
                  <SelectItem value="Guide Creation">Guide Creation</SelectItem>
                  {isAdmin && (
                    <SelectItem value="Evaluation">Evaluation</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {category === "Mentoring Session" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="menteeIgn">Mentee In-game Name</Label>
                  <Input 
                    id="menteeIgn" 
                    placeholder="e.g. Rookie_77" 
                    value={menteeIgn}
                    onChange={(e) => setMenteeIgn(e.target.value)}
                    className="bg-background/50 border-border focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="menteeUid">Mentee UID</Label>
                  <Input 
                    id="menteeUid" 
                    placeholder="e.g. 100456789" 
                    value={menteeUid}
                    onChange={(e) => setMenteeUid(e.target.value)}
                    className="bg-background/50 border-border focus-visible:ring-primary"
                  />
                </div>
              </div>
            )}

            {category === "Guide Creation" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <Label htmlFor="guideLink">Guide Link URL</Label>
                <Input 
                  id="guideLink" 
                  placeholder="https://..." 
                  value={guideLink}
                  onChange={(e) => setGuideLink(e.target.value)}
                  className="bg-background/50 border-border focus-visible:ring-primary"
                />
              </div>
            )}

            {(category === "Mentoring Session" || category === "Evaluation") && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label>Request Screenshot</Label>
                  <label className="border-2 border-dashed border-border rounded-md p-2 flex flex-col items-center justify-center text-center bg-background/20 hover:bg-background/40 hover:border-primary/50 transition-colors cursor-pointer group min-h-[120px] overflow-hidden relative">
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'request')} disabled={isSubmitting} />
                    {requestFile ? (
                      <div className="absolute inset-0 w-full h-full p-1">
                        <img src={URL.createObjectURL(requestFile)} alt="Request Preview" className="w-full h-full object-cover rounded-sm opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/50 transition-opacity">
                          <span className="bg-background/80 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Change File</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </label>
                </div>
                <div className="space-y-2">
                  <Label>Match Screenshot</Label>
                  <label className="border-2 border-dashed border-border rounded-md p-2 flex flex-col items-center justify-center text-center bg-background/20 hover:bg-background/40 hover:border-primary/50 transition-colors cursor-pointer group min-h-[120px] overflow-hidden relative">
                    <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFileChange(e, 'match')} disabled={isSubmitting} />
                    {matchFile ? (
                      <div className="absolute inset-0 w-full h-full p-1">
                        <img src={URL.createObjectURL(matchFile)} alt="Match Preview" className="w-full h-full object-cover rounded-sm opacity-80 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-background/50 transition-opacity">
                          <span className="bg-background/80 px-2 py-1 rounded text-xs font-bold uppercase tracking-wide">Change File</span>
                        </div>
                      </div>
                    ) : (
                      <>
                        <UploadCloud className="h-8 w-8 text-muted-foreground group-hover:text-primary mb-2 transition-colors" />
                        <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">Click to upload or drag and drop</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">PNG, JPG up to 5MB</p>
                      </>
                    )}
                  </label>
                </div>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="w-full uppercase font-bold tracking-wider">
              {isSubmitting ? "Uploading..." : "Submit For Review"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
