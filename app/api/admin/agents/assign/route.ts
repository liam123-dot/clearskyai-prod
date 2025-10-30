import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { updateAgentWebhookWithVapiAssistantId } from '@/lib/vapi/agents';

export async function POST(request: NextRequest) {
    try {
        const { vapi_assistant_id, organization_id } = await request.json();

        if (!vapi_assistant_id) {
            return NextResponse.json(
                { error: 'vapi_assistant_id is required' },
                { status: 400 }
            );
        }

        const supabase = await createServiceClient();

        // If organization_id is null, delete the agent assignment
        if (!organization_id) {
            const { error } = await supabase
                .from('agents')
                .delete()
                .eq('vapi_assistant_id', vapi_assistant_id);

            if (error) {
                console.error('Error unassigning agent:', error);
                return NextResponse.json(
                    { error: 'Failed to unassign agent' },
                    { status: 500 }
                );
            }

            return NextResponse.json({ success: true, assigned: false });
        }

        // Check if agent already exists
        const { data: existing } = await supabase
            .from('agents')
            .select('id, organization_id')
            .eq('vapi_assistant_id', vapi_assistant_id)
            .single();

        if (existing) {
            // Update existing agent
            const { error } = await supabase
                .from('agents')
                .update({ organization_id })
                .eq('vapi_assistant_id', vapi_assistant_id);

            if (error) {
                console.error('Error updating agent:', error);
                return NextResponse.json(
                    { error: 'Failed to update agent' },
                    { status: 500 }
                );
            }
        } else {
            // Create new agent
            const { error } = await supabase
                .from('agents')
                .insert({ vapi_assistant_id, organization_id });

            if (error) {
                console.error('Error creating agent:', error);
                return NextResponse.json(
                    { error: 'Failed to create agent' },
                    { status: 500 }
                );
            }
        }

        await updateAgentWebhookWithVapiAssistantId(vapi_assistant_id);

        return NextResponse.json({ success: true, assigned: true });
    } catch (error) {
        console.error('Error in agent assignment:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}

