import { NextRequest, NextResponse } from 'next/server';
import { assignPhoneNumberToAgent, getPhoneNumberById } from '@/lib/phone-numbers';
import { getAuthSession } from '@/lib/auth';
import { updatePhoneNumberWebhook } from '@/lib/twilio/phone-numbers';
import { createServiceClient } from '@/lib/supabase/server';

type RouteContext = {
  params: Promise<{ slug: string }>
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const { organizationId } = await getAuthSession(slug);
    
    const body = await request.json();
    const { phone_number_id, agent_id } = body;
    
    if (!phone_number_id) {
      return NextResponse.json(
        { error: 'phone_number_id is required' },
        { status: 400 }
      );
    }
    
    // Verify phone number belongs to user's organization
    const phoneNumber = await getPhoneNumberById(phone_number_id);
    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number not found' },
        { status: 404 }
      );
    }
    
    if (phoneNumber.organization_id !== organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized: Phone number does not belong to your organization' },
        { status: 403 }
      );
    }
    
    // Verify agent belongs to user's organization if assigning
    if (agent_id) {
      const supabase = await createServiceClient();
      const { data: agent, error: agentError } = await supabase
        .from('agents')
        .select('organization_id')
        .eq('id', agent_id)
        .single();
      
      if (agentError || !agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        );
      }
      
      if (agent.organization_id !== organizationId) {
        return NextResponse.json(
          { error: 'Unauthorized: Agent does not belong to your organization' },
          { status: 403 }
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
    await assignPhoneNumberToAgent(phone_number_id, agent_id || null);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error assigning phone number:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to assign phone number' },
      { status: 500 }
    );
  }
}

