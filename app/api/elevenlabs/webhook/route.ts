import { NextRequest, NextResponse } from "next/server";
import { GetConversationResponseModel } from "@elevenlabs/elevenlabs-js/api";
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { createServiceClient } from "@/lib/supabase/server";
import { createMeterEvent } from "@/lib/stripe";
import { syncOrganizationSubscriptions } from "@/lib/billing";
import { calculateElevenLabsCost } from "@/lib/elevenlabs/calls";

const client = new ElevenLabsClient({
    apiKey: process.env.ELEVEN_API_KEY,
})

export async function POST(request: NextRequest) {
    const data = await request.json();
    
    // console.log('ElevenLabs webhook received:', JSON.stringify(data, null, 2));
    
    // Check if this is a post_call_transcription event
    if (data.type === 'post_call_transcription') {
        await handlePostCallTranscription(data);
    }

    return NextResponse.json({ message: 'Webhook received' });
}

async function handlePostCallTranscription(webhookData: any) {
    try {
        // Extract conversation_id from webhook data
        const conversationId = webhookData.data?.conversation_id;
        
        if (!conversationId) {
            console.warn('No conversation_id found in webhook data');
            return;
        }

        console.log(`Fetching conversation details for: ${conversationId}`);
        
        // Fetch full conversation details from ElevenLabs API
        const conversationData = await client.conversationalAi.conversations.get(conversationId) as GetConversationResponseModel;
        
        console.log(`Conversation data fetched for agent: ${conversationData.agentId}`);
        
        const supabase = await createServiceClient();
        
        // Look up agent by external_agent_id (which is the ElevenLabs agent_id)
        const { data: agent, error: agentError } = await supabase
            .from('agents')
            .select('id, organization_id, external_agent_id')
            .eq('external_agent_id', conversationData.agentId)
            .eq('provider', 'elevenlabs')
            .single();

        if (agentError || !agent) {
            console.warn(`Agent not found for ElevenLabs agent ID: ${conversationData.agentId}`);
            return;
        }

        console.log(`Agent found: ${agent.id}, Organization: ${agent.organization_id}`);
        
        // Extract Twilio CallSid from webhook metadata
        const callSid = conversationData.metadata?.phoneCall?.callSid;
        
        // Try to find existing call record by CallSid
        let existingCallRecord = null;
        if (callSid) {
            const { data: existingCall, error: fetchError } = await supabase
                .from('calls')
                .select('id, organization_id, agent_id, event_sequence')
                .eq('call_sid', callSid)
                .single();

            if (!fetchError && existingCall) {
                existingCallRecord = existingCall;
                console.log(`Found existing call record for CallSid ${callSid}`);
            }
        }
        
        // Fetch agent details to get the name
        let agentName = 'ElevenLabs Agent'
        try {
            const agentDetails = await client.conversationalAi.agents.get(conversationData.agentId)
            agentName = agentDetails.name || 'ElevenLabs Agent'
        } catch (error) {
            console.warn(`Failed to fetch agent name for ${conversationData.agentId}:`, error)
        }
        
        // Prepare event sequence - append to existing or create new
        const eventSequence = existingCallRecord 
            ? [...existingCallRecord.event_sequence]
            : [];
        
        eventSequence.push({
            type: 'elevenlabs_call_completed',
            timestamp: new Date().toISOString(),
            details: conversationData as unknown as Record<string, unknown>,
        });
        
        // Calculate duration from metadata
        const durationSeconds = conversationData.metadata?.callDurationSecs || 0;
        const roundedDurationSeconds = durationSeconds > 0 ? Math.ceil(durationSeconds) : 0;
        
        // Calculate cost from credits
        const costUSD = calculateElevenLabsCost(conversationData);
        const credits = conversationData.metadata?.cost || 0;
        
        // Prepare costs array in same format as Vapi
        const costs = [{
            type: 'elevenlabs',
            cost: costUSD,
            credits: credits
        }];
        
        // Calculate total cost
        const totalCost = costUSD;
        
        // Prepare data with rounded duration, costs, and agent name
        const callData = {
            ...(conversationData as unknown as Record<string, unknown>),
            roundedDurationSeconds: roundedDurationSeconds,
            costs: costs,
            totalCost: totalCost,
            agentName: agentName, // Store agent name for display
        };
        
        let callRecord;
        
        if (existingCallRecord) {
            // Update existing call record
            const { data: updatedCall, error: updateError } = await supabase
                .from('calls')
                .update({
                    data: callData,
                    event_sequence: eventSequence,
                    routing_status: 'completed',
                })
                .eq('id', existingCallRecord.id)
                .select()
                .single();

            if (updateError) {
                console.error('Error updating call record:', updateError);
                return;
            }

            callRecord = updatedCall;
            console.log(`Call record updated for CallSid ${callSid}`);
        } else {
            // Create new call record (fallback for direct ElevenLabs calls not routed through our system)
            const { data: newCall, error: insertError } = await supabase
                .from('calls')
                .insert({
                    organization_id: agent.organization_id,
                    agent_id: agent.id,
                    provider: 'elevenlabs',
                    call_sid: callSid || conversationId, // Use callSid if available, otherwise conversationId
                    routing_status: 'completed',
                    event_sequence: eventSequence,
                    data: callData
                })
                .select()
                .single();

            if (insertError) {
                console.error('Error inserting call record:', insertError);
                return;
            }

            callRecord = newCall;
            console.log(`Call record created: ${callRecord.id}`);
        }
        
        // Send Stripe meter event for usage billing
        await sendMeterEventForCall(conversationData, agent.organization_id, roundedDurationSeconds);
        
    } catch (error) {
        console.error('Error handling post_call_transcription:', error);
    }
}

async function sendMeterEventForCall(
    conversationData: GetConversationResponseModel, 
    organizationId: string,
    durationSeconds: number
) {
    try {
        const supabase = await createServiceClient();

        // Sync subscriptions to ensure status is current
        await syncOrganizationSubscriptions(organizationId);
        
        const { data: org, error: orgError } = await supabase
            .from('organisations')
            .select('stripe_customer_id')
            .eq('id', organizationId)
            .single();

        if (orgError || !org || !org.stripe_customer_id) {
            console.log('No Stripe customer for organization, skipping meter event');
            return;
        }
        
        if (durationSeconds <= 0) {
            console.warn('Invalid call duration, skipping meter event');
            return;
        }
        
        // Round UP to nearest second
        const seconds = Math.ceil(durationSeconds);
        
        console.log(`Sending meter event: ${seconds} seconds`);
        
        // Get conversation ID for idempotency
        const conversationId = conversationData.conversationId;
        if (!conversationId) {
            console.warn('No conversation ID found, skipping meter event');
            return;
        }
        
        // Send meter event
        await createMeterEvent({
            customerId: org.stripe_customer_id,
            seconds: seconds,
            callId: conversationId,
        });
        
        console.log(`Meter event sent: ${seconds} seconds for organization ${organizationId}`);
    } catch (error) {
        console.error('Error sending meter event:', error);
        // Don't throw - we don't want to fail the webhook if meter event fails
    }
}
