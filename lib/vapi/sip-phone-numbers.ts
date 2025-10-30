import { vapiClient } from './VapiClients';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Get SIP phone number configuration for an agent
 */
export async function getSipPhoneNumberForAgent(agentId: string): Promise<{
  vapi_phone_number_id: string;
  sip_uri: string;
} | null> {
  const supabase = await createServiceClient();
  
  const { data, error } = await supabase
    .from('agents')
    .select('vapi_phone_number_id, sip_uri')
    .eq('id', agentId)
    .single();
  
  if (error || !data?.vapi_phone_number_id || !data?.sip_uri) {
    return null;
  }
  
  return {
    vapi_phone_number_id: data.vapi_phone_number_id,
    sip_uri: data.sip_uri,
  };
}

/**
 * Create a VAPI SIP phone number for an agent
 * Returns the created phone number ID and SIP URI
 */
export async function createSipPhoneNumber(
  agentId: string,
  assistantId: string
): Promise<{
  vapi_phone_number_id: string;
  sip_uri: string;
}> {
  try {
    // Generate a unique SIP username based on agent ID (max 40 chars)
    // Replace dashes with underscores to create a valid SIP username
    const sipUsername = agentId.replace(/-/g, '_');
    const sipUri = `sip:${sipUsername}@sip.vapi.ai`;
    
    // Create the SIP phone number in VAPI
    const phoneNumber = await vapiClient.phoneNumbers.create({
      provider: 'vapi',
      sipUri: sipUri,
      assistantId: assistantId,
    });
    
    if (!phoneNumber.id) {
      throw new Error('Failed to create SIP phone number: no ID returned');
    }
    
    // Update the agent record with SIP configuration
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from('agents')
      .update({
        vapi_phone_number_id: phoneNumber.id,
        sip_uri: sipUri,
      })
      .eq('id', agentId);
    
    if (error) {
      throw new Error(`Failed to update agent with SIP config: ${error.message}`);
    }
    
    return {
      vapi_phone_number_id: phoneNumber.id,
      sip_uri: sipUri,
    };
  } catch (error) {
    console.error('Error creating SIP phone number:', error);
    throw new Error(
      `Failed to create SIP phone number: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Get or create SIP phone number for an agent
 * If the agent already has SIP config, return it; otherwise create new one
 */
export async function ensureSipPhoneNumber(
  agentId: string,
  assistantId: string
): Promise<{
  vapi_phone_number_id: string;
  sip_uri: string;
}> {
  // Check if agent already has SIP config
  const existing = await getSipPhoneNumberForAgent(agentId);
  
  if (existing) {
    return existing;
  }
  
  // Create new SIP config
  return createSipPhoneNumber(agentId, assistantId);
}

