'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

const ROLE_HIERARCHY: Record<string, number> = {
  'Advisor': 1,
  'Lead': 2,
  'Lead Instructor': 3,
  'Senior Instructor': 4,
  'Instructor': 5,
  'Senior Mentor': 6,
  'Mentor': 7,
  'Junior Mentor': 8
};

async function logAdminAction(action: string, targetName: string | null, details: any) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: profile } = await supabase
      .from('profiles')
      .select('in_game_name, role')
      .eq('id', user.id)
      .single();

    const adminName = profile?.in_game_name || user.email || 'Bilinmeyen Admin';
    const adminRole = profile?.role || 'Bilinmeyen Rol';

    const adminClient = createAdminClient();
    await adminClient.from('admin_logs').insert({
      admin_id: user.id,
      admin_name: adminName,
      admin_role: adminRole,
      action: action,
      target_name: targetName,
      details: details
    });
  } catch (error) {
    console.error("Admin eylemi günlüğe kaydedilemedi:", error);
  }
}

export async function approveSubmission(submissionId: string, profileId: string, category: string, manualPoints?: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  const { data: profileData } = await supabase.from('profiles').select('in_game_name, total_points, session_count').eq('id', profileId).single();
  
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
    
    // Only award points if we are within the monthly cap (25)
    if (newSessionCount <= 25) {
      pointsToAward = 125;
    } else {
      pointsToAward = 0; // Cap reached
    }

    // Update the metrics table for the roster view (syncing mentoring_points with session_count)
    await supabase.from('mentor_metrics').upsert({ 
      profile_id: profileId, 
      mentoring_points: Math.min(newSessionCount, 25)
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

  // Cleanup Storage moved to resetMonthlyData for history support

  // Log the admin action
  await logAdminAction('Onaylama (Approve Submission)', profileData?.in_game_name || null, {
    submissionId,
    targetProfileId: profileId,
    category,
    manualPoints,
    awardedPoints: pointsToAward
  });

  revalidatePath('/');
  return { success: true, awardedPoints: pointsToAward };
}

export async function resetMonthlyData() {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  // 1. Reset all profiles (Points and Session Count)
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ 
      total_points: 0, 
      session_count: 0 
    })
    .not('id', 'is', null);

  if (profileError) return { error: "Failed to reset profiles: " + profileError.message };

  // 2. Cleanup Storage (Delete all screenshots to free up space)
  const { data: files } = await supabase.storage.from('screenshots').list('', { limit: 1000 });
  if (files && files.length > 0) {
    // List folders (user IDs)
    for (const item of files) {
      if (!item.id) { // It's a folder
        const { data: subFiles } = await supabase.storage.from('screenshots').list(item.name);
        if (subFiles && subFiles.length > 0) {
          const filesToRemove = subFiles.map(sf => `${item.name}/${sf.name}`);
          await supabase.storage.from('screenshots').remove(filesToRemove);
        }
      } else { // It's a file in root
        await supabase.storage.from('screenshots').remove([item.name]);
      }
    }
  }

  // 3. Update submissions to mark images as deleted (Clear BOTH urls and paths)
  await supabase
    .from('submissions')
    .update({ 
      request_screenshot_url: null, 
      match_screenshot_url: null,
      request_screenshot_path: null,
      match_screenshot_path: null
    })
    .not('id', 'is', null);

  // Log the action
  await logAdminAction('Aylık Sıfırlama (Reset Monthly Data)', 'Tüm Mentorlar (All Mentors)', {});

  revalidatePath('/');
  return { success: true };
}

export async function rejectSubmission(submissionId: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  // Get submission submitter info for logging
  const { data: submissionData } = await supabase
    .from('submissions')
    .select('profile_id, category, profiles(in_game_name)')
    .eq('id', submissionId)
    .single();
  const targetName = (submissionData?.profiles as any)?.in_game_name || null;

  // Mark as Rejected
  const { data: submission, error: updateError } = await supabase
    .from('submissions')
    .update({ status: 'Rejected' })
    .eq('id', submissionId)
    .select()
    .single();

  if (updateError) return { error: "Failed to reject submission." };

  // Cleanup Storage moved to resetMonthlyData for history support

  // Log the action
  await logAdminAction('Reddetme (Reject Submission)', targetName, {
    submissionId,
    category: submissionData?.category,
    profileId: submissionData?.profile_id
  });

  revalidatePath('/');
  return { success: true };
}

export async function adjustPoints(profileId: string, adjustment: number) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  // Fetch target profile info for hiyerarşik checks
  const { data: profile } = await supabase.from('profiles').select('in_game_name, total_points, role, is_developer').eq('id', profileId).single();
  if (!profile) return { error: "User not found" };

  // Enforce hiyerarşik safety (foolproofing)
  if (!currentAdmin?.is_developer) {
    if (profile.is_developer) {
      return { error: "Unauthorized. Cannot modify developer metrics." };
    }
    const actorRole = currentAdmin?.role || '';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 99;
    const targetLevel = ROLE_HIERARCHY[profile.role || ''] || 99;

    if (targetLevel <= actorLevel) {
      return { error: "Unauthorized. Cannot modify metrics for an equal or higher role." };
    }
  }

  const currentTotal = profile.total_points || 0;
  const newTotal = Math.max(0, currentTotal + adjustment);
  const { error } = await supabase.from('profiles').update({ total_points: newTotal }).eq('id', profileId);

  if (error) {
    console.error("Failed to adjust points:", error);
    return { error: "Failed to update points." };
  }

  // Log the action
  await logAdminAction('Puan Düzenleme (Adjust Points)', profile.in_game_name, {
    targetProfileId: profileId,
    adjustment: adjustment,
    previousPoints: currentTotal,
    newPoints: newTotal
  });

  revalidatePath('/');
  return { success: true };
}

export async function changeRole(profileId: string, newRole: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  // Fetch target profile info for hiyerarşik checks
  const { data: targetProfile } = await supabase.from('profiles').select('in_game_name, role, is_developer').eq('id', profileId).single();
  if (!targetProfile) return { error: "User not found" };

  // Enforce hiyerarşik safety (foolproofing)
  if (!currentAdmin?.is_developer) {
    if (targetProfile.is_developer) {
      return { error: "Unauthorized. Cannot modify developer roles." };
    }
    const actorRole = currentAdmin?.role || '';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 99;
    const targetLevel = ROLE_HIERARCHY[targetProfile.role || ''] || 99;
    const newRoleLevel = ROLE_HIERARCHY[newRole] || 99;

    if (targetLevel <= actorLevel) {
      return { error: "Unauthorized. Cannot modify a user with an equal or higher role." };
    }
    if (newRoleLevel <= actorLevel) {
      return { error: "Unauthorized. You cannot assign a role equal to or higher than your own." };
    }
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

  // Log the action
  await logAdminAction('Rol Değiştirme (Change Role)', targetProfile.in_game_name, {
    targetProfileId: profileId,
    previousRole: targetProfile.role,
    newRole: newRole
  });

  revalidatePath('/');
  return { success: true };
}

export async function updateStrikes(profileId: string, strikes: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead role required." };
  }

  // Fetch target profile info for hiyerarşik checks
  const { data: targetProfile } = await supabase.from('profiles').select('in_game_name, role, is_developer').eq('id', profileId).single();
  if (!targetProfile) return { error: "User not found" };

  // Enforce hiyerarşik safety (foolproofing)
  if (!currentAdmin?.is_developer) {
    if (targetProfile.is_developer) {
      return { error: "Unauthorized. Cannot modify developer metrics." };
    }
    const actorRole = currentAdmin?.role || '';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 99;
    const targetLevel = ROLE_HIERARCHY[targetProfile.role || ''] || 99;

    if (targetLevel <= actorLevel) {
      return { error: "Unauthorized. Cannot modify metrics for an equal or higher role." };
    }
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

  // Log the action
  await logAdminAction('Uyarı Güncelleme (Update Strikes)', targetProfile.in_game_name, {
    targetProfileId: profileId,
    strikes: finalStrikes
  });

  revalidatePath('/');
  return { success: true };
}

export async function deleteUser(profileId: string) {
  const supabase = await createClient();
  
  // Verify Admin rights
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: currentAdmin } = await supabase.from('profiles').select('role, is_developer').eq('id', user.id).single();
  const isSuperAdmin = currentAdmin?.is_developer || ['Lead', 'Advisor', 'Lead Instructor'].includes(currentAdmin?.role || '');
  if (!isSuperAdmin) {
    return { error: "Unauthorized. Lead/Advisor access required." };
  }

  // Fetch target profile info for hiyerarşik checks
  const { data: targetProfile } = await supabase.from('profiles').select('in_game_name, discord_id, role, is_developer').eq('id', profileId).single();
  if (!targetProfile) return { error: "User not found" };

  // Enforce hiyerarşik safety (foolproofing)
  if (!currentAdmin?.is_developer) {
    if (targetProfile.is_developer) {
      return { error: "Unauthorized. Cannot delete a developer." };
    }
    const actorRole = currentAdmin?.role || '';
    const actorLevel = ROLE_HIERARCHY[actorRole] || 99;
    const targetLevel = ROLE_HIERARCHY[targetProfile.role || ''] || 99;

    if (targetLevel <= actorLevel) {
      return { error: "Unauthorized. Cannot delete a user with an equal or higher role." };
    }
  }

  try {
    // Log BEFORE deleting (so we have target details preserved in logs)
    await logAdminAction('Kullanıcı Silme (Delete User)', `${targetProfile.in_game_name} (Discord: ${targetProfile.discord_id})`, {
      targetProfileId: profileId,
      role: targetProfile.role
    });

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
