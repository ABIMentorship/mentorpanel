'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function approveSubmission(submissionId: string, profileId: string, category: string, manualPoints?: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  const { data: profileData } = await supabase.from('profiles').select('total_points, session_count').eq('id', profileId).single();
  
  let effectiveTotalPoints = profileData?.total_points || 0;
  let effectiveSessionCount = profileData?.session_count || 0;

  // 1. Mark as Approved
  const { data: submission, error: updateError } = await supabase
    .from('submissions')
    .update({ status: 'Approved' })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) return { error: "Failed to update submission status." };

  // 2. Calculate points based on the incremented session count
  let pointsToAward = 0;

  if (category === "Mentoring Session" || category === "Evaluation") {
    const newSessionCount = effectiveSessionCount + 1;
    
    // Only award points if we are within the monthly cap (16)
    if (newSessionCount <= 16) {
      pointsToAward = 125;
    } else {
      pointsToAward = 0; // Cap reached
    }

    // Update the metrics table for the roster view (syncing mentoring_points with session_count)
    await supabase.from('mentor_metrics').upsert({ 
      profile_id: profileId, 
      mentoring_points: Math.min(newSessionCount, 16)
    }, { onConflict: 'profile_id' });
    
    // Update the profile with the new total and session count
    await supabase.from('profiles').update({ 
      total_points: effectiveTotalPoints + pointsToAward,
      session_count: newSessionCount
    }).eq('id', profileId);

  } else if (category === "Guide Creation" && manualPoints !== undefined) {
    pointsToAward = manualPoints;
    
    await supabase.from('profiles').update({ 
      total_points: effectiveTotalPoints + pointsToAward
    }).eq('id', profileId);
  }

  if (pointsToAward > 0) {
    await supabase.from('submissions').update({ awarded_points: pointsToAward }).eq('id', submissionId);
  }

  // 3. Cleanup Storage
  if (submission?.request_screenshot_path) {
    await supabase.storage.from('screenshots').remove([submission.request_screenshot_path]);
  }
  if (submission?.match_screenshot_path) {
    await supabase.storage.from('screenshots').remove([submission.match_screenshot_path]);
  }

  revalidatePath('/');
  return { success: true, awardedPoints: pointsToAward };
}

export async function resetMonthlyData() {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  // 1. Reset all profiles (Points and Session Count)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      total_points: 0, 
      session_count: 0 
    })
    .not('id', 'is', null); // Update all rows correctly

  if (profileError) return { error: "Failed to reset profiles: " + profileError.message };

  revalidatePath('/');
  return { success: true };
}

export async function rejectSubmission(submissionId: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  // Mark as Rejected
  const { data: submission, error: updateError } = await supabase
    .from('submissions')
    .update({ status: 'Rejected' })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) return { error: "Failed to reject submission." };

  // Cleanup Storage even if rejected
  if (submission?.request_screenshot_path) {
    await supabase.storage.from('screenshots').remove([submission.request_screenshot_path]);
  }
  if (submission?.match_screenshot_path) {
    await supabase.storage.from('screenshots').remove([submission.match_screenshot_path]);
  }

  revalidatePath('/');
  return { success: true };
}

export async function adjustPoints(profileId: string, adjustment: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  // Get current points
  const { data: profile } = await supabase.from('profiles').select('total_points').eq('id', profileId).single();
  const currentTotal = profile?.total_points || 0;
  
  const newTotal = Math.max(0, currentTotal + adjustment);
  const { error } = await supabase.from('profiles').update({ total_points: newTotal }).eq('id', profileId);

  if (error) {
    console.error("Failed to adjust points:", error);
    return { error: "Failed to update points." };
  }

  revalidatePath('/');
  return { success: true };
}

export async function changeRole(profileId: string, newRole: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', profileId);

  if (error) {
    console.error("Failed to change role:", error);
    return { error: "Failed to update role." };
  }

  revalidatePath('/');
  return { success: true };
}

export async function updateStrikes(profileId: string, strikes: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (!currentAdmin || currentAdmin.role !== 'Lead') {
    return { error: "Unauthorized. Lead role required." };
  }

  // Cap strikes at 2
  const strikeNum = parseInt(strikes) || 0;
  const finalStrikes = Math.min(Math.max(0, strikeNum), 2).toString();

  const { error } = await supabase
    .from('mentor_metrics')
    .update({ strikes: finalStrikes })
    .eq('profile_id', profileId);

  if (error) {
    console.error("Failed to update strikes:", error);
    return { error: "Failed to update strikes." };
  }

  revalidatePath('/');
  return { success: true };
}
