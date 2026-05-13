"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Search, Calendar, FileText, Image as ImageIcon, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MentorshipHistoryProps {
  approvedMentorships: any[];
}

export function MentorshipHistory({ approvedMentorships }: MentorshipHistoryProps) {
  const [filter, setFilter] = useState("all");
  const [isExporting, setIsExporting] = useState(false);
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  const getImageUrl = (url: string | null, path: string | null) => {
    if (url) return url;
    if (path) return `${supabaseUrl}/storage/v1/object/public/screenshots/${path}`;
    return null;
  };

  const filterData = (data: any[]) => {
    const now = new Date();
    if (filter === "this-month") {
      return data.filter(item => {
        const d = new Date(item.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      });
    }
    if (filter === "last-month") {
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      return data.filter(item => {
        const d = new Date(item.created_at);
        return d.getMonth() === lastMonth.getMonth() && d.getFullYear() === lastMonth.getFullYear();
      });
    }
    if (filter === "last-3-months") {
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return data.filter(item => new Date(item.created_at) >= threeMonthsAgo);
    }
    return data;
  };

  const filteredData = filterData(approvedMentorships);

  const exportZip = async () => {
    setIsExporting(true);
    try {
      // Dynamic imports for Edge compatibility
      const JSZip = (await import("jszip")).default;
      const ExcelJS = await import("exceljs");
      
      const zip = new JSZip();
      const screenshotFolder = zip.folder("screenshots");
      
      // Create Excel Workbook
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mentorship History");
      
      worksheet.columns = [
        { header: "Nick", key: "nick", width: 20 },
        { header: "UID", key: "uid", width: 15 },
        { header: "Mentor", key: "mentor", width: 20 },
        { header: "Category", key: "category", width: 20 },
        { header: "Date", key: "date", width: 15 },
        { header: "Request Screenshot", key: "request_url", width: 30 },
        { header: "Match Screenshot", key: "match_url", width: 30 }
      ];

      for (const sub of filteredData) {
        const dateStr = new Date(sub.created_at).toLocaleDateString();
        const safeNick = (sub.mentee_ign || "unknown").replace(/[^a-z0-9]/gi, '_');
        
        const requestUrl = getImageUrl(sub.request_screenshot_url, sub.request_screenshot_path);
        const matchUrl = getImageUrl(sub.match_screenshot_url, sub.match_screenshot_path);

        // Download images if they exist
        const images = [
          { url: requestUrl, type: 'request' },
          { url: matchUrl, type: 'match' }
        ];

        for (const img of images) {
          if (img.url) {
            try {
              const fileName = `${sub.id}_${safeNick}_${img.type}.png`;
              const response = await fetch(img.url);
              if (response.ok) {
                const blob = await response.blob();
                screenshotFolder?.file(fileName, blob);
              }
            } catch (e) {
              console.error("Failed to download image:", img.url);
            }
          }
        }

        // Add Row to Excel
        const row = worksheet.addRow({
          nick: sub.mentee_ign,
          uid: sub.mentee_uid,
          mentor: sub.profiles?.discord_id || sub.profiles?.in_game_name || "Unknown",
          category: sub.category,
          date: dateStr,
        });

        // Hyperlinks for local files (relative path in ZIP)
        if (requestUrl) {
          const requestFileName = `${sub.id}_${safeNick}_request.png`;
          row.getCell('request_url').value = {
            text: "Open Request Proof",
            hyperlink: `./screenshots/${requestFileName}`,
            tooltip: "Open local screenshot"
          } as any;
          row.getCell('request_url').font = { color: { argb: '0000FF' }, underline: true };
        }

        if (matchUrl) {
          const matchFileName = `${sub.id}_${safeNick}_match.png`;
          row.getCell('match_url').value = {
            text: "Open Match History",
            hyperlink: `./screenshots/${matchFileName}`,
            tooltip: "Open local screenshot"
          } as any;
          row.getCell('match_url').font = { color: { argb: '0000FF' }, underline: true };
        }
      }

      const excelBuffer = await workbook.xlsx.writeBuffer();
      zip.file("mentorship_history.xlsx", excelBuffer);

      const zipContent = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(zipContent);
      const link = document.createElement("a");
      link.href = url;
      link.download = `mentorship_export_${filter}_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Export error:", error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col space-y-2">
          <h2 className="text-3xl font-bold tracking-tight uppercase">Mentorship History</h2>
          <p className="text-muted-foreground">
            Archives of all mentoring and evaluation sessions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-card/30 border border-border rounded-lg px-3 py-1.5 backdrop-blur">
            <Calendar className="h-4 w-4 text-primary" />
            <Select value={filter} onValueChange={(val) => setFilter(val || "all")}>
              <SelectTrigger className="w-[160px] border-none bg-transparent h-auto p-0 focus:ring-0 text-xs font-bold uppercase">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="this-month">This Month</SelectItem>
                <SelectItem value="last-month">Last Month</SelectItem>
                <SelectItem value="last-3-months">Last 3 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={exportZip} disabled={isExporting} className="bg-primary text-black hover:bg-primary/90 font-bold uppercase text-xs tracking-wider">
            {isExporting ? <span className="animate-pulse">Exporting...</span> : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Export ZIP
              </>
            )}
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card/30 backdrop-blur overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground uppercase text-xs font-bold">Mentee Nick</TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs font-bold">Mentee UID</TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs font-bold">Mentor</TableHead>
              <TableHead className="text-muted-foreground uppercase text-xs font-bold">Category</TableHead>
              <TableHead className="text-center text-muted-foreground uppercase text-xs font-bold">Proof</TableHead>
              <TableHead className="text-right text-muted-foreground uppercase text-xs font-bold">Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground italic">
                  No records found for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((sub) => {
                const requestUrl = getImageUrl(sub.request_screenshot_url, sub.request_screenshot_path);
                const matchUrl = getImageUrl(sub.match_screenshot_url, sub.match_screenshot_path);
                
                return (
                  <TableRow key={sub.id} className="border-border/50 hover:bg-muted/30 transition-colors group">
                    <TableCell className="font-bold text-foreground group-hover:text-primary transition-colors">
                      {sub.mentee_ign}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground/80 tracking-tighter">
                      {sub.mentee_uid}
                    </TableCell>
                    <TableCell className="text-primary/90 font-medium tracking-tight">
                      {sub.profiles?.discord_id || sub.profiles?.in_game_name || "Unknown"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 uppercase border-primary/20 text-primary bg-primary/5 font-bold">
                        {sub.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {(requestUrl || matchUrl) ? (
                        <Dialog>
                          <DialogTrigger className="h-8 w-8 inline-flex items-center justify-center rounded-md text-primary hover:bg-primary/10 transition-colors">
                            <ImageIcon className="h-4 w-4" />
                          </DialogTrigger>
                          <DialogContent className="max-w-4xl bg-card/95 backdrop-blur border-primary/20">
                            <DialogHeader>
                              <DialogTitle className="uppercase tracking-tighter flex items-center justify-between">
                                <span>Activity Proof • {sub.mentee_ign}</span>
                                <Badge variant="outline" className="text-[10px]">{sub.category}</Badge>
                              </DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div className="space-y-2">
                                <p className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> Request Proof
                                </p>
                                {requestUrl ? (
                                  <a href={requestUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors bg-black/40">
                                    <img src={requestUrl} alt="Request" className="w-full h-auto object-contain max-h-[500px]" />
                                  </a>
                                ) : (
                                  <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground text-xs italic">
                                    Görsel silinmiş (Resetlendi)
                                  </div>
                                )}
                              </div>
                              <div className="space-y-2">
                                <p className="text-[10px] uppercase font-black text-muted-foreground flex items-center gap-1">
                                  <ExternalLink className="h-3 w-3" /> Match History Proof
                                </p>
                                {matchUrl ? (
                                  <a href={matchUrl} target="_blank" rel="noopener noreferrer" className="block rounded-lg border border-border overflow-hidden hover:border-primary/50 transition-colors bg-black/40">
                                    <img src={matchUrl} alt="Match" className="w-full h-auto object-contain max-h-[500px]" />
                                  </a>
                                ) : (
                                  <div className="h-40 flex items-center justify-center border border-dashed border-border rounded-lg bg-muted/20 text-muted-foreground text-xs italic">
                                    Görsel silinmiş (Resetlendi)
                                  </div>
                                )}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground/30 border-muted-foreground/20 italic uppercase">Expired</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground font-mono">
                      {new Date(sub.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex justify-between items-center text-[10px] text-muted-foreground uppercase font-bold tracking-widest bg-card/20 p-4 rounded-lg border border-dashed border-border">
        <span>Total Records: {filteredData.length}</span>
        <span>Secure Archive • Access Level: LEAD</span>
      </div>
    </div>
  );
}
