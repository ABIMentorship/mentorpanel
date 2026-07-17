'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin';
import { revalidatePath } from 'next/cache';

export async function updateMentorPoints(
  profileId: string, 
  column: 'participation_points' | 'mentoring_points' | 'co_host_points' | 'abih_responses_points' | 'knowledge_points' | 'communication_points' | 'behavior_points' | 'exam_passed' | 'strikes' | 'quota' | 'notes', 
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

  // Prevent regular instructors from modifying the exam
  if (column === 'exam_passed') {
    const isExamAdmin = currentUser?.is_developer || ['Lead Instructor', 'Lead', 'Advisor'].includes(currentUser?.role || '');
    if (!isExamAdmin) {
      return { error: 'Unauthorized. Only Lead Instructors and above can mark the exam.' };
    }
  }

  // Prevent overly long notes to avoid database abuse
  if (column === 'notes' && typeof value === 'string' && value.length > 500) {
    return { error: 'Notes cannot exceed 500 characters.' };
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
  if (column === 'exam_passed' && (value === true || value === 'true' || value === 1)) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', profileId).single();
    if (profile && profile.role === 'Junior Mentor') {
      const adminClient = createAdminClient();
      
      const { data: updatedProfile, error: roleError } = await adminClient
        .from('profiles')
        .update({ role: 'Mentor' })
        .eq('id', profileId)
        .select()
        .single();
        
      if (roleError || !updatedProfile) {
        console.error('Failed to auto-promote Junior Mentor to Mentor:', roleError || 'RLS restricted or Service Key missing');
        return { error: 'Exam updated, but auto-promotion failed! Please add SUPABASE_SERVICE_ROLE_KEY to .env.local or manually promote.' };
      }
    }
  }

  revalidatePath('/');
  return { success: true };
}
