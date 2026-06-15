"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileWithMetrics } from "./ClientDashboard";
import { updateMentorPoints } from "@/app/actions/roster";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, XCircle, Minus } from "lucide-react";

interface PublicRosterProps {
  mentors: ProfileWithMetrics[];
  currentUser: ProfileWithMetrics;
}

export function PublicRoster({ mentors, currentUser }: PublicRosterProps) {
  const isAdmin = currentUser.is_developer || ["Instructor", "Senior Instructor", "Lead Instructor", "Lead", "Advisor"].includes(currentUser.role);
  const isSuperAdmin = currentUser.is_developer || ["Lead", "Advisor", "Lead Instructor"].includes(currentUser.role);
  const isExamAdmin = currentUser.is_developer || ["Lead Instructor", "Lead", "Advisor"].includes(currentUser.role);

  const [editingCell, setEditingCell] = useState<{ profileId: string, column: string, max: number | null } | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const seniorMentors = mentors.filter(m => m.role === "Senior Mentor");
  const normalMentors = mentors.filter(m => m.role === "Mentor");
  const juniorMentors = mentors.filter(m => m.role === "Junior Mentor");

  const roleHierarchy: { [key: string]: number } = {
    "Advisor": 1,
    "Lead": 2,
    "Lead Instructor": 3,
    "Senior Instructor": 4,
    "Instructor": 5
  };

  const instructors = mentors
    .filter(m => ["Instructor", "Senior Instructor", "Lead Instructor", "Lead", "Advisor"].includes(m.role))
    .sort((a, b) => {
      const orderA = roleHierarchy[a.role] || 99;
      const orderB = roleHierarchy[b.role] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.discord_id.localeCompare(b.discord_id);
    });

  const getStatusBadgeVariant = (role: string) => {
    switch (role) {
      case "Senior Mentor":
        return "bg-primary text-black hover:bg-primary/80";
      case "Mentor":
        return "bg-green-500/10 text-green-500 border border-green-500/20";
      case "Junior Mentor":
        return "bg-yellow-500/10 text-yellow-500 border border-yellow-500/20";
      case "Instructor":
        return "bg-cyan-500/10 text-cyan-500 border border-cyan-500/20";
      case "Senior Instructor":
        return "bg-teal-500/10 text-teal-500 border border-teal-500/20";
      case "Lead Instructor":
        return "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20";
      case "Lead":
        return "bg-purple-500/10 text-purple-500 border border-purple-500/20";
      case "Advisor":
        return "bg-red-500/10 text-red-500 border border-red-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handleCellClick = (profileId: string, column: string, currentValue: string | number | boolean, isApplicable: boolean, max: number | null) => {
    if (!isAdmin || !isApplicable) return;
    if (column === "abih_responses_points" && !isSuperAdmin) return;
    if (column === "exam_passed" && !isExamAdmin) return;

    setEditingCell({ profileId, column, max });
    setEditValue(currentValue?.toString() || "");
  };

  const handleSave = async (profileId: string, column: string, overrideValue?: string) => {
    setIsLoading(true);
    let finalValue: any = overrideValue !== undefined ? overrideValue : editValue;

    // Convert to number if it's a points column
    if (column.includes("points") || column === "quota" || column === "strikes") {
      finalValue = parseInt(finalValue, 10);
      if (isNaN(finalValue) || finalValue < 0) {
        toast.error("Please enter a valid positive number");
        setIsLoading(false);
        return;
      }
      if (editingCell && editingCell.max !== null && finalValue > editingCell.max) {
        toast.error(`Value cannot exceed ${editingCell.max}`);
        setIsLoading(false);
        return;
      }
    } else if (column === "exam_passed") {
      finalValue = String(finalValue).toLowerCase() === "true" || finalValue === "1" || String(finalValue).toLowerCase() === "yes" || String(finalValue).toLowerCase() === "passed";
    }

    const res = await updateMentorPoints(profileId, column as any, finalValue);
    
    if (res.error) {
      toast.error(res.error);
    } else {
      toast.success("Updated successfully!");
    }

    setEditingCell(null);
    setIsLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, profileId: string, column: string) => {
    if (e.key === 'Enter') {
      handleSave(profileId, column);
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  };

  const renderCell = (
    profileId: string, 
    column: string, 
    value: number | string | boolean, 
    max: number | null, 
    isApplicable: boolean,
    canEdit: boolean
  ) => {
    if (!isApplicable) {
      return <div className="text-muted-foreground/30 text-center">-</div>;
    }

    const isEditing = editingCell?.profileId === profileId && editingCell?.column === column;

    if (isEditing) {
      if (column === "exam_passed") {
        return (
          <div className="flex items-center justify-center">
            <Select 
              defaultOpen
              value={String(editValue)} 
              onValueChange={(val) => {
                setEditValue(val || "");
                handleSave(profileId, column, val || "");
              }}
            >
              <SelectTrigger className="w-24 h-8 text-xs bg-background/50 px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true" className="text-green-500 font-bold">Passed (✔)</SelectItem>
                <SelectItem value="false" className="text-destructive font-bold">Failed (✖)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        );
      }

      return (
        <div className="flex items-center justify-center">
          <Input 
            autoFocus
            type="text" 
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => handleSave(profileId, column)}
            onKeyDown={(e) => handleKeyDown(e, profileId, column)}
            className="w-16 h-8 text-center px-1"
            disabled={isLoading}
          />
        </div>
      );
    }

    // Special rendering for Exam
    if (column === "exam_passed") {
      return (
        <div 
          className={`flex items-center justify-center ${canEdit ? 'cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors' : ''}`}
          onClick={() => handleCellClick(profileId, column, value, isApplicable, max)}
        >
          {value ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <XCircle className="w-5 h-5 text-destructive" />
          )}
        </div>
      );
    }

    // Special rendering for Strikes
    if (column === "strikes") {
      const strikeStr = String(value || "0");
      const hasStrikes = strikeStr !== "0" && strikeStr !== "X" && strikeStr !== "";
      return (
        <div 
          className={`text-center ${canEdit ? 'cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors' : ''}`}
          onClick={() => handleCellClick(profileId, column, value, isApplicable, max)}
        >
          {hasStrikes ? <span className="text-destructive font-bold">{strikeStr}</span> : <span className="text-muted-foreground/50">None</span>}
        </div>
      );
    }

    // Dynamic color coding based on column and progress
    let colorClass = "text-foreground";
    if (max !== null && typeof value === 'number') {
      if (value === 0) {
        colorClass = "text-destructive"; // 0 is Red
      } else if (column === "participation_points" && value >= 3) {
        colorClass = "text-green-500 font-bold"; // Participation >= 3 is Green
      } else if (value >= max) {
        colorClass = "text-green-500 font-bold"; // Maxed out is Green
      } else {
        colorClass = "text-yellow-500"; // In progress is Yellow
      }
    }

    return (
      <div 
        className={`text-center ${canEdit ? 'cursor-pointer hover:bg-muted/50 rounded p-1 transition-colors' : ''}`}
        onClick={() => handleCellClick(profileId, column, value, isApplicable, max)}
        title={canEdit ? "Click to edit" : ""}
      >
        <span className={colorClass}>{String(value || 0)}</span>
        {max !== null && <span className="text-muted-foreground/50 text-xs">/{max}</span>}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-3xl font-bold tracking-tight uppercase">Public Roster</h2>
        <p className="text-muted-foreground">
          Official Evaluation Roster and current standing.
        </p>
      </div>

      {/* JUNIOR MENTORS TABLE */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase text-lg text-yellow-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
            Junior Mentors (In Training)
          </CardTitle>
          <CardDescription>
            {isAdmin ? "Click on any valid cell to inline-edit points." : "Training metrics and evaluation progress."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[180px] text-muted-foreground">Discord</TableHead>
                <TableHead className="text-muted-foreground">In-game Name</TableHead>
                <TableHead className="text-muted-foreground">TZ</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Participation</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Knowledge</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Comms</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Behavior</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Exam</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Strikes</TableHead>
                <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {juniorMentors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                    No Junior Mentors in training.
                  </TableCell>
                </TableRow>
              )}
              {juniorMentors.map((mentor) => (
                <TableRow key={mentor.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-foreground">{mentor.discord_id}</TableCell>
                  <TableCell className="text-muted-foreground">{mentor.in_game_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{mentor.timezone}</TableCell>
                  <TableCell>{renderCell(mentor.id, "participation_points", mentor.mentor_metrics?.participation_points, 5, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "knowledge_points", mentor.mentor_metrics?.knowledge_points, 5, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "communication_points", mentor.mentor_metrics?.communication_points, 5, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "behavior_points", mentor.mentor_metrics?.behavior_points, 5, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "exam_passed", mentor.mentor_metrics?.exam_passed, null, true, isExamAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "strikes", mentor.mentor_metrics?.strikes, 2, true, isAdmin)}</TableCell>
                  <TableCell className="text-right">
                    <Badge className="rounded-sm bg-yellow-500/10 text-yellow-500 border border-yellow-500/20" variant="outline">
                      In Training
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* NORMAL MENTORS TABLE */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase text-lg text-green-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500"></span>
            Mentors
          </CardTitle>
          <CardDescription>
            {isAdmin ? "Click on any valid cell to inline-edit points." : "Official metrics for Mentors."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[180px] text-muted-foreground">Discord</TableHead>
                <TableHead className="text-muted-foreground">In-game Name</TableHead>
                <TableHead className="text-muted-foreground">TZ</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Participation</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Mentoring</TableHead>
                <TableHead className="text-right text-primary font-bold text-xs uppercase tracking-wider">Total Points</TableHead>
                <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {normalMentors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No Mentors found.
                  </TableCell>
                </TableRow>
              )}
              {normalMentors.map((mentor) => (
                <TableRow key={mentor.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-foreground">{mentor.discord_id}</TableCell>
                  <TableCell className="text-muted-foreground">{mentor.in_game_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{mentor.timezone}</TableCell>
                  <TableCell>{renderCell(mentor.id, "participation_points", mentor.mentor_metrics?.participation_points, 5, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "mentoring_points", mentor.mentor_metrics?.mentoring_points, 25, true, isAdmin)}</TableCell>
                  <TableCell className="text-right font-mono text-primary font-bold text-lg">{mentor.total_points.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={`rounded-sm ${getStatusBadgeVariant(mentor.role)}`} variant="outline">{mentor.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* SENIOR MENTORS TABLE */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase text-lg text-primary flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary"></span>
            Senior Mentors
          </CardTitle>
          <CardDescription>
            {isAdmin ? "Click on any valid cell to inline-edit points." : "Official metrics for Senior Mentors."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[180px] text-muted-foreground">Discord</TableHead>
                <TableHead className="text-muted-foreground">In-game Name</TableHead>
                <TableHead className="text-muted-foreground">TZ</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Co-Host</TableHead>
                <TableHead className="text-center text-muted-foreground text-xs uppercase tracking-wider">Mentoring</TableHead>
                <TableHead className="text-right text-primary font-bold text-xs uppercase tracking-wider">Total Points</TableHead>
                <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {seniorMentors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No Senior Mentors found.
                  </TableCell>
                </TableRow>
              )}
              {seniorMentors.map((mentor) => (
                <TableRow key={mentor.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-foreground">{mentor.discord_id}</TableCell>
                  <TableCell className="text-muted-foreground">{mentor.in_game_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{mentor.timezone}</TableCell>
                  <TableCell>{renderCell(mentor.id, "co_host_points", mentor.mentor_metrics?.co_host_points, 10, true, isAdmin)}</TableCell>
                  <TableCell>{renderCell(mentor.id, "mentoring_points", mentor.mentor_metrics?.mentoring_points, 10, true, isAdmin)}</TableCell>
                  <TableCell className="text-right font-mono text-primary font-bold text-lg">{mentor.total_points.toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={`rounded-sm ${getStatusBadgeVariant(mentor.role)}`} variant="outline">{mentor.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* INSTRUCTORS & LEADERSHIP TABLE */}
      <Card className="border-border bg-card/50 backdrop-blur">
        <CardHeader>
          <CardTitle className="uppercase text-lg text-cyan-500 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse"></span>
            Instructors & Leadership
          </CardTitle>
          <CardDescription>
            Core administration team overseeing the academy and evaluations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[180px] text-muted-foreground">Discord</TableHead>
                <TableHead className="text-muted-foreground">In-game Name</TableHead>
                <TableHead className="text-muted-foreground">TZ</TableHead>
                <TableHead className="text-right text-muted-foreground text-xs uppercase tracking-wider">Role</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instructors.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                    No Instructors or Leaders found.
                  </TableCell>
                </TableRow>
              )}
              {instructors.map((instructor) => (
                <TableRow key={instructor.id} className="border-border/50 hover:bg-muted/50 transition-colors">
                  <TableCell className="font-medium text-foreground">{instructor.discord_id}</TableCell>
                  <TableCell className="text-muted-foreground">{instructor.in_game_name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">{instructor.timezone || "N/A"}</TableCell>
                  <TableCell className="text-right">
                    <Badge className={`rounded-sm ${getStatusBadgeVariant(instructor.role)}`} variant="outline">{instructor.role}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
