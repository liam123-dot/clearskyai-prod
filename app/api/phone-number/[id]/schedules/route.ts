import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { validateScheduleOverlap } from '@/lib/call-routing';
import { getPhoneNumberById } from '@/lib/phone-numbers';
import type { PhoneNumberSchedule } from '@/lib/call-routing';

/**
 * Normalize time string to HH:MM format (strip seconds if present)
 */
function normalizeTime(time: string): string {
  if (!time) return time;
  // If time includes seconds (HH:MM:SS), strip them
  if (time.includes(':') && time.split(':').length === 3) {
    return time.substring(0, 5); // Take first 5 characters (HH:MM)
  }
  return time;
}

/**
 * Validate time format (accepts HH:MM or HH:MM:SS)
 */
function validateTimeFormat(time: string): boolean {
  // Accept both HH:MM and HH:MM:SS formats
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$/;
  return timeRegex.test(time);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    const supabase = await createServiceClient();

    const { data: schedules, error } = await supabase
      .from('phone_number_schedules')
      .select('*')
      .eq('phone_number_id', phoneNumberId)
      .order('start_time', { ascending: true });

    if (error) {
      console.error('Error fetching schedules:', error);
      return NextResponse.json(
        { error: 'Failed to fetch schedules' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedules: schedules || [] });
  } catch (error) {
    console.error('Error in GET schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    const body = await request.json();
    const { days, start_time, end_time, transfer_to_number, dial_timeout, agent_fallback_enabled, enabled } = body;

    // Validate required fields
    if (!days || !Array.isArray(days) || days.length === 0) {
      return NextResponse.json(
        { error: 'days array is required and must not be empty' },
        { status: 400 }
      );
    }

    if (!start_time || !end_time) {
      return NextResponse.json(
        { error: 'start_time and end_time are required' },
        { status: 400 }
      );
    }

    if (!transfer_to_number) {
      return NextResponse.json(
        { error: 'transfer_to_number is required' },
        { status: 400 }
      );
    }

    // Validate days array contains valid values (0-6)
    const invalidDays = days.filter((d: number) => d < 0 || d > 6 || !Number.isInteger(d));
    if (invalidDays.length > 0) {
      return NextResponse.json(
        { error: 'days must be integers between 0 and 6' },
        { status: 400 }
      );
    }

    // Validate time format (HH:MM)
    if (!validateTimeFormat(start_time) || !validateTimeFormat(end_time)) {
      return NextResponse.json(
        { error: 'start_time and end_time must be in HH:MM format' },
        { status: 400 }
      );
    }

    // Normalize times to HH:MM format
    const normalizedStartTime = normalizeTime(start_time);
    const normalizedEndTime = normalizeTime(end_time);

    // Validate end_time > start_time
    if (normalizedEndTime <= normalizedStartTime) {
      return NextResponse.json(
        { error: 'end_time must be after start_time' },
        { status: 400 }
      );
    }

    // Validate dial_timeout
    const timeout = dial_timeout ?? 30;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 300) {
      return NextResponse.json(
        { error: 'dial_timeout must be an integer between 1 and 300' },
        { status: 400 }
      );
    }

    // Verify phone number exists
    const phoneNumber = await getPhoneNumberById(phoneNumberId);
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }

    // Check for overlapping schedules
    const overlapCheck = await validateScheduleOverlap(
      phoneNumberId,
      days,
      normalizedStartTime,
      normalizedEndTime
    );

    if (overlapCheck.overlaps) {
      return NextResponse.json(
        { error: 'Schedule overlaps with existing schedule', conflictingSchedule: overlapCheck.conflictingSchedule },
        { status: 400 }
      );
    }

    // Create schedule
    const supabase = await createServiceClient();
    const { data: schedule, error } = await supabase
      .from('phone_number_schedules')
      .insert({
        phone_number_id: phoneNumberId,
        days,
        start_time: normalizedStartTime,
        end_time: normalizedEndTime,
        transfer_to_number,
        dial_timeout: timeout,
        agent_fallback_enabled: agent_fallback_enabled ?? true,
        enabled: enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating schedule:', error);
      return NextResponse.json(
        { error: 'Failed to create schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('Error in POST schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    const body = await request.json();
    const { schedule_id, days, start_time, end_time, transfer_to_number, dial_timeout, agent_fallback_enabled, enabled } = body;

    console.log(body);
    console.log(schedule_id);
    console.log(days);
    console.log(start_time);
    console.log(end_time);
    console.log(transfer_to_number);
    console.log(dial_timeout);
    console.log(agent_fallback_enabled);
    console.log(enabled);

    if (!schedule_id) {
      return NextResponse.json(
        { error: 'schedule_id is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify schedule exists and belongs to this phone number
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('phone_number_schedules')
      .select('*')
      .eq('id', schedule_id)
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (fetchError || !existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Prepare update data
    const updateData: Partial<PhoneNumberSchedule> = {};

    if (days !== undefined) {
      if (!Array.isArray(days) || days.length === 0) {
        return NextResponse.json(
          { error: 'days must be a non-empty array' },
          { status: 400 }
        );
      }
      const invalidDays = days.filter((d: number) => d < 0 || d > 6 || !Number.isInteger(d));
      if (invalidDays.length > 0) {
        return NextResponse.json(
          { error: 'days must be integers between 0 and 6' },
          { status: 400 }
        );
      }
      updateData.days = days;
    }

    if (start_time !== undefined) {
      if (!validateTimeFormat(start_time)) {
        return NextResponse.json(
          { error: 'start_time must be in HH:MM format' },
          { status: 400 }
        );
      }
      updateData.start_time = normalizeTime(start_time);
    }
    if (end_time !== undefined) {
      if (!validateTimeFormat(end_time)) {
        return NextResponse.json(
          { error: 'end_time must be in HH:MM format' },
          { status: 400 }
        );
      }
      updateData.end_time = normalizeTime(end_time);
    }
    if (transfer_to_number !== undefined) updateData.transfer_to_number = transfer_to_number;
    if (dial_timeout !== undefined) {
      if (!Number.isInteger(dial_timeout) || dial_timeout < 1 || dial_timeout > 300) {
        return NextResponse.json(
          { error: 'dial_timeout must be an integer between 1 and 300' },
          { status: 400 }
        );
      }
      updateData.dial_timeout = dial_timeout;
    }
    if (agent_fallback_enabled !== undefined) updateData.agent_fallback_enabled = agent_fallback_enabled;
    if (enabled !== undefined) updateData.enabled = enabled;

    // Validate time format if times are being updated
    const finalStartTime = updateData.start_time !== undefined 
      ? updateData.start_time 
      : normalizeTime(existingSchedule.start_time);
    const finalEndTime = updateData.end_time !== undefined 
      ? updateData.end_time 
      : normalizeTime(existingSchedule.end_time);
    
    if (updateData.start_time || updateData.end_time) {
      if (finalEndTime <= finalStartTime) {
        return NextResponse.json(
          { error: 'end_time must be after start_time' },
          { status: 400 }
        );
      }
    }

    // Check for overlapping schedules (excluding this one)
    const finalDays = updateData.days ?? existingSchedule.days;
    if (updateData.days || updateData.start_time || updateData.end_time) {
      const overlapCheck = await validateScheduleOverlap(
        phoneNumberId,
        finalDays,
        finalStartTime,
        finalEndTime,
        schedule_id
      );

      if (overlapCheck.overlaps) {
        return NextResponse.json(
          { error: 'Schedule overlaps with existing schedule', conflictingSchedule: overlapCheck.conflictingSchedule },
          { status: 400 }
        );
      }
    }

    // Update schedule
    const { data: schedule, error } = await supabase
      .from('phone_number_schedules')
      .update(updateData)
      .eq('id', schedule_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating schedule:', error);
      return NextResponse.json(
        { error: 'Failed to update schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ schedule });
  } catch (error) {
    console.error('Error in PUT schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: phoneNumberId } = await params;
    const url = new URL(request.url);
    const scheduleId = url.searchParams.get('schedule_id');

    if (!scheduleId) {
      return NextResponse.json(
        { error: 'schedule_id query parameter is required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();

    // Verify schedule exists and belongs to this phone number
    const { data: existingSchedule, error: fetchError } = await supabase
      .from('phone_number_schedules')
      .select('id')
      .eq('id', scheduleId)
      .eq('phone_number_id', phoneNumberId)
      .single();

    if (fetchError || !existingSchedule) {
      return NextResponse.json(
        { error: 'Schedule not found' },
        { status: 404 }
      );
    }

    // Delete schedule
    const { error } = await supabase
      .from('phone_number_schedules')
      .delete()
      .eq('id', scheduleId);

    if (error) {
      console.error('Error deleting schedule:', error);
      return NextResponse.json(
        { error: 'Failed to delete schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE schedules:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

