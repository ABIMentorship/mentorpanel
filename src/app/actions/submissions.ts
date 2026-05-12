'use server';

import { createClient } from '@/utils/supabase/server';
import { revalidatePath } from 'next/cache';

export async function submitLog(data: {
  category: string;
  menteeIgn?: string;
  menteeUid?: string;
  guideLink?: string;
  requestScreenshotPath?: string;
  matchScreenshotPath?: string;
  requestScreenshotUrl?: string;
  matchScreenshotUrl?: string;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  // Fetch user role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_developer')
    .eq('id', user.id)
    .single();

  const isJunior = profile?.role === 'Junior Mentor' && !profile?.is_developer;
  if (isJunior && data.category === 'Mentoring Session') {
    return { error: 'Junior Mentors are not authorized to submit Mentoring Sessions.' };
  }

  const { error } = await supabase
    .from('submissions')
    .insert({
      profile_id: user.id,
      category: data.category,
      mentee_ign: data.menteeIgn || null,
      mentee_uid: data.menteeUid || null,
      guide_link: data.guideLink || null,
      request_screenshot_path: data.requestScreenshotPath || null,
      match_screenshot_path: data.matchScreenshotPath || null,
      request_screenshot_url: data.requestScreenshotUrl || null,
      match_screenshot_url: data.matchScreenshotUrl || null,
      status: 'Pending',
    });

  if (error) {
    console.error('Submission error:', error);
    return { error: 'Failed to submit log. Please try again.' };
  }

  revalidatePath('/');
  return { success: true };
}
