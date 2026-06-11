'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function approveSubmission(submissionId: string, profileId: string, category: string, manualPoints?: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  const adminClient = createAdminClient();
  const { data: profileData } = await adminClient.from('profiles').select('total_points, session_count').eq('id', profileId).single();
  
  let effectiveTotalPoints = profileData?.total_points || 0;
  let effectiveSessionCount = profileData?.session_count || 0;

  // 1. Mark as Approved
  const { data: submission, error: updateError } = await adminClient
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
    await adminClient.from('mentor_metrics').upsert({ 
      profile_id: profileId, 
      mentoring_points: Math.min(newSessionCount, 16)
    }, { onConflict: 'profile_id' });
    
    // Update the profile with the new total and session count
    await adminClient.from('profiles').update({ 
      total_points: effectiveTotalPoints + pointsToAward,
      session_count: newSessionCount
    }).eq('id', profileId);

  } else if (category === "Guide Creation" && manualPoints !== undefined) {
    pointsToAward = manualPoints;
    
    await adminClient.from('profiles').update({ 
      total_points: effectiveTotalPoints + pointsToAward
    }).eq('id', profileId);
  }

  if (pointsToAward > 0) {
    await adminClient.from('submissions').update({ awarded_points: pointsToAward }).eq('id', submissionId);
  }

  // Cleanup Storage moved to resetMonthlyData for history support

  revalidatePath('/');
  return { success: true, awardedPoints: pointsToAward };
}

export async function resetMonthlyData() {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  const adminClient = createAdminClient();

  // 1. Reset all profiles (Points and Session Count)
  const { error: profileError } = await adminClient
    .from('profiles')
    .update({ 
      total_points: 0, 
      session_count: 0 
    })
    .not('id', 'is', null);

  if (profileError) return { error: "Failed to reset profiles: " + profileError.message };

  // 2. Cleanup Storage (Delete all screenshots to free up space)
  const { data: files } = await adminClient.storage.from('screenshots').list('', { limit: 1000 });
  if (files && files.length > 0) {
    // List folders (user IDs)
    for (const item of files) {
      if (!item.id) { // It's a folder
        const { data: subFiles } = await adminClient.storage.from('screenshots').list(item.name);
        if (subFiles && subFiles.length > 0) {
          const filesToRemove = subFiles.map(sf => `${item.name}/${sf.name}`);
          await adminClient.storage.from('screenshots').remove(filesToRemove);
        }
      } else { // It's a file in root
        await adminClient.storage.from('screenshots').remove([item.name]);
      }
    }
  }

  // 3. Update submissions to mark images as deleted (Clear BOTH urls and paths)
  await adminClient
    .from('submissions')
    .update({ 
      request_screenshot_url: null, 
      match_screenshot_url: null,
      request_screenshot_path: null,
      match_screenshot_path: null
    })
    .not('id', 'is', null);

  revalidatePath('/');
  return { success: true };
}

export async function rejectSubmission(submissionId: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  const adminClient = createAdminClient();

  // Mark as Rejected
  const { data: submission, error: updateError } = await adminClient
    .from('submissions')
    .update({ status: 'Rejected' })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) return { error: "Failed to reject submission." };

  // Cleanup Storage moved to resetMonthlyData for history support

  revalidatePath('/');
  return { success: true };
}

export async function adjustPoints(profileId: string, adjustment: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
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

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  const adminClient = createAdminClient();
  const { data: updatedProfile, error } = await adminClient
    .from('profiles')
    .update({ role: newRole })
    .eq('id', profileId)
    .select()
    .single();

  if (error || !updatedProfile) {
    console.error("Failed to change role:", error || "RLS restricted or Service Key missing");
    return { error: `Failed to update role. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local to bypass RLS.` };
  }

  revalidatePath('/');
  return { success: true };
}

export async function updateStrikes(profileId: string, strikes: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
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

export async function deleteUser(profileId: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead/Advisor access required." };
  }

  try {
    // 1. Delete metrics
    await supabase.from('mentor_metrics').delete().eq('profile_id', profileId);
    
    // 2. Delete submissions
    await supabase.from('submissions').delete().eq('profile_id', profileId);
    
    // 3. Delete profile
    const { error } = await supabase.from('profiles').delete().eq('id', profileId);
    
    if (error) throw error;

    revalidatePath('/');
    return { success: true };
  } catch (err: any) {
    console.error("Failed to delete user:", err);
    return { error: `Failed to delete user: ${err.message}` };
  }
}
