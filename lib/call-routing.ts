import { createServiceClient } from './supabase/server';

export interface PhoneNumberSchedule {
  id: string;
  phone_number_id: string;
  days: number[];
  start_time: string; // HH:MM format
  end_time: string; // HH:MM format
  transfer_to_number: string;
  dial_timeout: number;
  agent_fallback_enabled: boolean;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Find a matching schedule for a phone number at the given time
 * Returns the first matching schedule or null if none found
 */
export async function findMatchingSchedule(
  phoneNumberId: string,
  currentTime: Date = new Date()
): Promise<PhoneNumberSchedule | null> {
  const supabase = await createServiceClient();

  // Get current day of week (0 = Sunday, 6 = Saturday)
  const currentDay = currentTime.getDay();

  // Get current time in HH:MM format
  const hours = String(currentTime.getHours()).padStart(2, '0');
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${hours}:${minutes}`;

  // Query active schedules for this phone number
  const { data: schedules, error } = await supabase
    .from('phone_number_schedules')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .eq('enabled', true);

  if (error) {
    console.error('Error fetching schedules:', error);
    return null;
  }

  if (!schedules || schedules.length === 0) {
    return null;
  }

  // Find first matching schedule
  for (const schedule of schedules) {
    // Check if current day is in schedule's days array
    if (!schedule.days.includes(currentDay)) {
      continue;
    }

    // Check if current time falls within schedule's time range
    const startTime = schedule.start_time;
    const endTime = schedule.end_time;

    // Convert times to comparable format (HH:MM string comparison works)
    if (currentTimeStr >= startTime && currentTimeStr < endTime) {
      return schedule as PhoneNumberSchedule;
    }
  }

  return null;
}

/**
 * Check if a schedule would overlap with existing schedules
 * Returns true if overlap found, false otherwise
 */
export async function validateScheduleOverlap(
  phoneNumberId: string,
  days: number[],
  startTime: string,
  endTime: string,
  excludeScheduleId?: string
): Promise<{ overlaps: boolean; conflictingSchedule?: PhoneNumberSchedule }> {
  const supabase = await createServiceClient();

  // Query all schedules for this phone number (excluding the one being updated if provided)
  let query = supabase
    .from('phone_number_schedules')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .eq('enabled', true);

  if (excludeScheduleId) {
    query = query.neq('id', excludeScheduleId);
  }

  const { data: schedules, error } = await query;

  if (error) {
    console.error('Error fetching schedules for overlap check:', error);
    return { overlaps: false };
  }

  if (!schedules || schedules.length === 0) {
    return { overlaps: false };
  }

  // Check each existing schedule for overlap
  for (const schedule of schedules) {
    // Check if days arrays overlap (intersection not empty)
    const daysOverlap = schedule.days.some((day: number) => days.includes(day));

    if (!daysOverlap) {
      continue; // No day overlap, can't have time overlap
    }

    // Check if time ranges overlap
    // Overlap condition: start < other.end AND end > other.start
    const timeOverlaps =
      startTime < schedule.end_time && endTime > schedule.start_time;

    if (timeOverlaps) {
      return {
        overlaps: true,
        conflictingSchedule: schedule as PhoneNumberSchedule,
      };
    }
  }

  return { overlaps: false };
}

/**
 * Generate TwiML for transferring a call to a number
 */
export function generateTransferTwiML(
  transferToNumber: string,
  timeoutSeconds: number,
  fallbackUrl: string,
  agentFallbackEnabled: boolean
): string {
  // Escape XML special characters in the transfer number
  const escapedNumber = transferToNumber
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial action="${fallbackUrl}" timeout="${timeoutSeconds}" answerOnBridge="true">
    <Number>${escapedNumber}</Number>
  </Dial>
</Response>`;
}

/**
 * Generate TwiML for forwarding to agent endpoint
 */
export function generateAgentForwardTwiML(agentId: string): string {
  const agentUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/agent/${agentId}/call-incoming`;
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Redirect method="POST">${agentUrl}</Redirect>
</Response>`;
}

