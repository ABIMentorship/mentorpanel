import { createClient } from "@/utils/supabase/server";
import { ClientDashboard } from "@/components/views/ClientDashboard";
import { redirect } from "next/navigation";

export const runtime = 'edge';

export default async function Home() {
  const supabase = await createClient();

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  // Fetch current user's profile with metrics
  const { data: currentProfile } = await supabase
    .from("profiles")
    .select(`
      id, discord_id, in_game_name, uid, role, is_developer, total_points, timezone,
      mentor_metrics (
        participation_points,
        mentoring_points,
        co_host_points,
        abih_responses_points,
        knowledge_points,
        communication_points,
        behavior_points,
        exam_passed,
        strikes,
        quota
      )
    `)
    .eq("id", user.id)
    .single();

  if (!currentProfile) {
    redirect("/onboarding");
  }

  // Fetch all mentors for the roster (excluding Instructors and Leads from the public view)
  const { data: rosterData } = await supabase
    .from("profiles")
    .select(`
      id, discord_id, in_game_name, uid, role, is_developer, total_points, timezone,
      mentor_metrics (
        participation_points,
        mentoring_points,
        co_host_points,
        abih_responses_points,
        knowledge_points,
        communication_points,
        behavior_points,
        exam_passed,
        strikes,
        quota
      )
    `)
    .order("total_points", { ascending: false });

  // Map the nested mentor_metrics properly, just in case it returns an array due to Supabase typing quirks
  const mappedRosterData = (rosterData || []).map((profile) => ({
    ...profile,
    mentor_metrics: Array.isArray(profile.mentor_metrics) ? profile.mentor_metrics[0] : profile.mentor_metrics
  }));

  const mappedCurrentProfile = {
    ...currentProfile,
    mentor_metrics: Array.isArray(currentProfile.mentor_metrics) ? currentProfile.mentor_metrics[0] : currentProfile.mentor_metrics
  };

  let pendingSubmissions: any[] = [];
  let approvedMentorships: any[] = [];
  
  const isSuperAdmin = mappedCurrentProfile.is_developer || ["Lead", "Advisor"].includes(mappedCurrentProfile.role);
  
  if (isSuperAdmin) {
    const { data: pending } = await supabase
      .from("submissions")
      .select(`
        id, profile_id, category, mentee_ign, mentee_uid, guide_link, status, created_at, request_screenshot_path, match_screenshot_path,
        profiles ( in_game_name )
      `)
      .eq("status", "Pending")
      .order("created_at", { ascending: true });
    
    pendingSubmissions = pending || [];

    const { data: approved } = await supabase
      .from("submissions")
      .select(`
        id, mentee_ign, mentee_uid, category, created_at, 
        request_screenshot_url, match_screenshot_url,
        request_screenshot_path, match_screenshot_path,
        profiles ( in_game_name )
      `)
      .eq("status", "Approved")
      .not("mentee_ign", "is", null)
      .neq("category", "Evaluation")
      .order("created_at", { ascending: false });
    
    approvedMentorships = approved || [];
  }

  return (
    <ClientDashboard 
      currentUser={mappedCurrentProfile as any} 
      rosterData={mappedRosterData as any}
      pendingSubmissions={pendingSubmissions}
      approvedMentorships={approvedMentorships}
    />
  );
}
