'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function updateMentorPoints(
  profileId: string, 
  column: 'participation_points' | 'mentoring_points' | 'co_host_points' | 'abih_responses_points' | 'knowledge_points' | 'communication_points' | 'behavior_points' | 'exam_passed' | 'strikes' | 'quota', 
  value: number | boolean | string
) {
  const supabase = await createClient();
  
  // Verify auth and admin role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: currentUser } = await supabase
    .from('profiles')
    .select('role, is_developer')
    .eq('id', user.id)
    .single();

  const isAdmin = currentUser?.is_developer || ['Instructor', 'Senior Instructor', 'Lead Instructor', 'Lead', 'Advisor'].includes(currentUser?.role || '');
  if (!isAdmin) {
    return { error: 'Unauthorized. Only Instructors and Leads can edit points.' };
  }

  // Update metrics
  const { error } = await supabase
    .from('mentor_metrics')
    .update({ [column]: value })
    .eq('profile_id', profileId);

  if (error) {
    console.error('Failed to update points', error);
    return { error: 'Failed to update points.' };
  }

  // Auto-promotion logic: Junior Mentor -> Mentor if exam passed
  if (column === 'exam_passed' && value === true) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', profileId).single();
    if (profile && profile.role === 'Junior Mentor') {
      await supabase.from('profiles').update({ role: 'Mentor' }).eq('id', profileId);
    }
  }

  revalidatePath('/');
  return { success: true };
}
