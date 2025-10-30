import { createServiceClient } from "./supabase/server";
import { createVapiTwilioPhoneNumber, updateVapiPhoneNumberAssistant } from "./vapi/phone-numbers";
import type { PhoneNumberSchedule } from "./call-routing";

export interface PhoneNumberCredentials {
  account_sid?: string;
  auth_token?: string;
  phone_number_sid?: string;
  [key: string]: unknown;
}

export interface PhoneNumber {
  id: string;
  phone_number: string;
  provider: string;
  credentials: PhoneNumberCredentials;
  agent_id: string | null;
  organization_id: string | null;
  owned_by_admin: boolean;
  vapi_phone_number_id: string | null;
  time_based_routing_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface PhoneNumberWithDetails extends PhoneNumber {
  agent?: {
    id: string;
    vapi_assistant_id: string;
  } | null;
  organization?: {
    id: string;
    slug: string;
    external_id: string;
  } | null;
  schedules_count?: number;
}

export interface ImportPhoneNumberData {
  phone_number: string;
  provider: string;
  credentials: PhoneNumberCredentials;
  organization_id: string | null;
  owned_by_admin: boolean;
  agent_id?: string | null;
}

/**
 * Get all phone numbers in the system (admin only)
 */
export async function getPhoneNumbers(): Promise<PhoneNumberWithDetails[]> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('phone_numbers')
    .select(`
      *,
      agent:agents(id, vapi_assistant_id),
      organization:organisations(id, slug, external_id)
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get phone numbers: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Get enabled schedules count for all phone numbers
  const phoneNumberIds = data.map(p => p.id);
  const { data: schedules } = await supabase
    .from('phone_number_schedules')
    .select('phone_number_id, enabled')
    .in('phone_number_id', phoneNumberIds)
    .eq('enabled', true);
  
  // Create a map of phone_number_id -> count
  const schedulesCountMap = new Map<string, number>();
  schedules?.forEach(schedule => {
    const count = schedulesCountMap.get(schedule.phone_number_id) || 0;
    schedulesCountMap.set(schedule.phone_number_id, count + 1);
  });
  
  // Map the data to include schedules_count
  return data.map((phone) => ({
    ...phone,
    schedules_count: schedulesCountMap.get(phone.id) || 0,
  })) as PhoneNumberWithDetails[];
}

/**
 * Get phone numbers for a specific organization
 */
export async function getPhoneNumbersByOrganization(
  organizationId: string
): Promise<PhoneNumberWithDetails[]> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('phone_numbers')
    .select(`
      *,
      agent:agents(id, vapi_assistant_id),
      organization:organisations(id, slug, external_id)
    `)
    .eq('organization_id', organizationId)
    .order('created_at', { ascending: false });
  
  if (error) {
    throw new Error(`Failed to get phone numbers: ${error.message}`);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Get enabled schedules count for all phone numbers
  const phoneNumberIds = data.map(p => p.id);
  const { data: schedules } = await supabase
    .from('phone_number_schedules')
    .select('phone_number_id, enabled')
    .in('phone_number_id', phoneNumberIds)
    .eq('enabled', true);
  
  // Create a map of phone_number_id -> count
  const schedulesCountMap = new Map<string, number>();
  schedules?.forEach(schedule => {
    const count = schedulesCountMap.get(schedule.phone_number_id) || 0;
    schedulesCountMap.set(schedule.phone_number_id, count + 1);
  });
  
  // Map the data to include schedules_count
  return data.map((phone) => ({
    ...phone,
    schedules_count: schedulesCountMap.get(phone.id) || 0,
  })) as PhoneNumberWithDetails[];
}

/**
 * Get a single phone number by phone number string
 */
export async function getPhoneNumberByNumber(
  phoneNumber: string
): Promise<PhoneNumberWithDetails | null> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('phone_numbers')
    .select(`
      *,
      agent:agents(id, vapi_assistant_id),
      organization:organisations(id, slug, external_id)
    `)
    .eq('phone_number', phoneNumber)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get phone number: ${error.message}`);
  }
  
  return data as PhoneNumberWithDetails;
}

/**
 * Get a single phone number by ID
 */
export async function getPhoneNumberById(
  phoneNumberId: string
): Promise<PhoneNumberWithDetails | null> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('phone_numbers')
    .select(`
      *,
      agent:agents(id, vapi_assistant_id),
      organization:organisations(id, slug, external_id)
    `)
    .eq('id', phoneNumberId)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') {
      return null; // Not found
    }
    throw new Error(`Failed to get phone number: ${error.message}`);
  }
  
  return data as PhoneNumberWithDetails;
}

/**
 * Import a phone number into the database
 * For Twilio numbers, this will also create the phone number in VAPI
 */
export async function importPhoneNumber(
  data: ImportPhoneNumberData
): Promise<PhoneNumber> {
  const supabase = await createServiceClient();
  
  // Check if phone number already exists
  const { data: existing } = await supabase
    .from('phone_numbers')
    .select('id')
    .eq('phone_number', data.phone_number)
    .single();
  
  if (existing) {
    throw new Error('Phone number already exists in the system');
  }
  
  // For Twilio numbers, create in VAPI first
  let vapiPhoneNumberId: string | null = null;
  
  if (data.provider === 'twilio') {
    const accountSid = data.credentials.account_sid;
    const authToken = data.credentials.auth_token;
    
    if (!accountSid || !authToken) {
      throw new Error('Twilio account_sid and auth_token are required');
    }
    
    try {
      vapiPhoneNumberId = await createVapiTwilioPhoneNumber(
        data.phone_number,
        accountSid,
        authToken
      );
    } catch (error) {
      console.error('Failed to create phone number in VAPI:', error);
      throw new Error(
        `Failed to register phone number with VAPI: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
  
  // Insert into database with VAPI phone number ID
  const { data: phoneNumber, error } = await supabase
    .from('phone_numbers')
    .insert({
      phone_number: data.phone_number,
      provider: data.provider,
      credentials: data.credentials,
      organization_id: data.organization_id,
      owned_by_admin: data.owned_by_admin,
      agent_id: data.agent_id || null,
      vapi_phone_number_id: vapiPhoneNumberId,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to import phone number: ${error.message}`);
  }
  
  return phoneNumber;
}

/**
 * Assign a phone number to an agent
 * This also updates VAPI to link the phone number to the agent's assistant
 */
export async function assignPhoneNumberToAgent(
  phoneNumberId: string,
  agentId: string | null
): Promise<void> {
  const supabase = await createServiceClient();
  
  // Get the phone number details to check if it has a VAPI ID
  const { data: phoneNumber, error: phoneError } = await supabase
    .from('phone_numbers')
    .select('vapi_phone_number_id, provider')
    .eq('id', phoneNumberId)
    .single();
  
  if (phoneError) {
    throw new Error(`Failed to get phone number: ${phoneError.message}`);
  }
  
  // If assigning to an agent (not unassigning) and phone number has VAPI ID
  if (agentId && phoneNumber.vapi_phone_number_id) {
    // Get the agent's VAPI assistant ID
    const { data: agent, error: agentError } = await supabase
      .from('agents')
      .select('vapi_assistant_id')
      .eq('id', agentId)
      .single();
    
    if (agentError) {
      throw new Error(`Failed to get agent: ${agentError.message}`);
    }
    
    // Update VAPI to link the phone number to the assistant
    try {
      await updateVapiPhoneNumberAssistant(
        phoneNumber.vapi_phone_number_id,
        agent.vapi_assistant_id
      );
    } catch (error) {
      console.error('Failed to update VAPI phone number assignment:', error);
      throw new Error(
        `Failed to link phone number to agent in VAPI: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  } else if (!agentId && phoneNumber.vapi_phone_number_id) {
    // Unassigning - remove assistant from VAPI phone number
    try {
      await updateVapiPhoneNumberAssistant(
        phoneNumber.vapi_phone_number_id,
        null
      );
    } catch (error) {
      console.error('Failed to unlink VAPI phone number:', error);
      // Don't throw here - we still want to unassign in our database
    }
  }
  
  // Update the database
  const { error } = await supabase
    .from('phone_numbers')
    .update({ agent_id: agentId })
    .eq('id', phoneNumberId);
  
  if (error) {
    throw new Error(`Failed to assign phone number to agent: ${error.message}`);
  }
}

/**
 * Assign an admin-owned phone number to an organization
 */
export async function assignPhoneNumberToOrganization(
  phoneNumberId: string,
  organizationId: string | null
): Promise<void> {
  const supabase = await createServiceClient();
  
  // Only allow assigning admin-owned numbers
  const { data: phoneNumber, error: fetchError } = await supabase
    .from('phone_numbers')
    .select('owned_by_admin')
    .eq('id', phoneNumberId)
    .single();
  
  if (fetchError) {
    throw new Error(`Failed to fetch phone number: ${fetchError.message}`);
  }
  
  if (!phoneNumber.owned_by_admin) {
    throw new Error('Only admin-owned phone numbers can be reassigned to organizations');
  }
  
  const { error } = await supabase
    .from('phone_numbers')
    .update({ organization_id: organizationId })
    .eq('id', phoneNumberId);
  
  if (error) {
    throw new Error(`Failed to assign phone number to organization: ${error.message}`);
  }
}

/**
 * Delete a phone number
 */
export async function deletePhoneNumber(phoneNumberId: string): Promise<void> {
  const supabase = await createServiceClient();
  
  const { error } = await supabase
    .from('phone_numbers')
    .delete()
    .eq('id', phoneNumberId);
  
  if (error) {
    throw new Error(`Failed to delete phone number: ${error.message}`);
  }
}

/**
 * Get all schedules for a phone number
 */
export async function getPhoneNumberSchedules(
  phoneNumberId: string
): Promise<PhoneNumberSchedule[]> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('phone_number_schedules')
    .select('*')
    .eq('phone_number_id', phoneNumberId)
    .order('start_time', { ascending: true });
  
  if (error) {
    throw new Error(`Failed to get schedules: ${error.message}`);
  }
  
  return (data || []) as PhoneNumberSchedule[];
}

/**
 * Create a new schedule for a phone number
 */
export async function createPhoneNumberSchedule(
  phoneNumberId: string,
  data: {
    days: number[];
    start_time: string;
    end_time: string;
    transfer_to_number: string;
    dial_timeout?: number;
    agent_fallback_enabled?: boolean;
    enabled?: boolean;
  }
): Promise<PhoneNumberSchedule> {
  const supabase = await createServiceClient();
  
  const { data: schedule, error } = await supabase
    .from('phone_number_schedules')
    .insert({
      phone_number_id: phoneNumberId,
      days: data.days,
      start_time: data.start_time,
      end_time: data.end_time,
      transfer_to_number: data.transfer_to_number,
      dial_timeout: data.dial_timeout ?? 30,
      agent_fallback_enabled: data.agent_fallback_enabled ?? true,
      enabled: data.enabled ?? true,
    })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to create schedule: ${error.message}`);
  }
  
  return schedule as PhoneNumberSchedule;
}

/**
 * Update a schedule
 */
export async function updatePhoneNumberSchedule(
  scheduleId: string,
  data: Partial<{
    days: number[];
    start_time: string;
    end_time: string;
    transfer_to_number: string;
    dial_timeout: number;
    agent_fallback_enabled: boolean;
    enabled: boolean;
  }>
): Promise<PhoneNumberSchedule> {
  const supabase = await createServiceClient();
  
  const { data: schedule, error } = await supabase
    .from('phone_number_schedules')
    .update(data)
    .eq('id', scheduleId)
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to update schedule: ${error.message}`);
  }
  
  return schedule as PhoneNumberSchedule;
}

/**
 * Delete a schedule
 */
export async function deletePhoneNumberSchedule(
  scheduleId: string
): Promise<void> {
  const supabase = await createServiceClient();
  
  const { error } = await supabase
    .from('phone_number_schedules')
    .delete()
    .eq('id', scheduleId);
  
  if (error) {
    throw new Error(`Failed to delete schedule: ${error.message}`);
  }
}

/**
 * Update time-based routing enabled flag for a phone number
 */
export async function updateTimeBasedRoutingEnabled(
  phoneNumberId: string,
  enabled: boolean
): Promise<void> {
  const supabase = await createServiceClient();
  
  const { error } = await supabase
    .from('phone_numbers')
    .update({ time_based_routing_enabled: enabled })
    .eq('id', phoneNumberId);
  
  if (error) {
    throw new Error(`Failed to update time-based routing: ${error.message}`);
  }
}

