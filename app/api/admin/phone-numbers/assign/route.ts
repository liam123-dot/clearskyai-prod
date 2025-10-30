import { NextRequest, NextResponse } from 'next/server';
import { assignPhoneNumberToAgent, assignPhoneNumberToOrganization, getPhoneNumberById } from '@/lib/phone-numbers';
import { requireAdmin } from '@/app/(admin)/lib/admin-auth';
import { ensureSipPhoneNumber } from '@/lib/vapi/sip-phone-numbers';
import { createServiceClient } from '@/lib/supabase/server';
import { updatePhoneNumberWebhook } from '@/lib/twilio/phone-numbers';

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    
    const body = await request.json();
    const { phone_number_id, agent_id, organization_id } = body;
    
    if (!phone_number_id) {
      return NextResponse.json(
        { error: 'phone_number_id is required' },
        { status: 400 }
      );
    }
    
    // Handle agent assignment if provided
    if (agent_id !== undefined) {
      if (agent_id) {
        // Get the agent's VAPI assistant ID
        const supabase = await createServiceClient();
        const { data: agent, error: agentError } = await supabase
          .from('agents')
          .select('id, vapi_assistant_id, sip_uri, vapi_phone_number_id')
          .eq('id', agent_id)
          .single();
        
        if (agentError || !agent) {
          return NextResponse.json(
            { error: 'Agent not found' },
            { status: 404 }
          );
        }
        
        // Ensure the agent has SIP configuration
        await ensureSipPhoneNumber(agent_id, agent.vapi_assistant_id);
        
        // Get phone number details
        const phoneNumber = await getPhoneNumberById(phone_number_id);
        if (!phoneNumber) {
          return NextResponse.json(
            { error: 'Phone number not found' },
            { status: 404 }
          );
        }
        
        // Update webhook URL to point to phone-number-based endpoint (handles time-based routing)
        if (phoneNumber.provider === 'twilio' && phoneNumber.credentials.account_sid && phoneNumber.credentials.auth_token && phoneNumber.credentials.phone_number_sid) {
          const webhookUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/phone-number/${phone_number_id}/incoming`;
          await updatePhoneNumberWebhook(
            phoneNumber.credentials.account_sid as string,
            phoneNumber.credentials.auth_token as string,
            phoneNumber.credentials.phone_number_sid as string,
            webhookUrl
          );
        }
      }
      
      // Assign the phone number to the agent in the database
      await assignPhoneNumberToAgent(phone_number_id, agent_id);
    }
    
    // Handle organization assignment if provided
    if (organization_id !== undefined) {
      await assignPhoneNumberToOrganization(phone_number_id, organization_id);
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error assigning phone number:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign phone number' },
      { status: 500 }
    );
  }
}

