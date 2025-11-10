import { NextRequest, NextResponse } from 'next/server';
import { assignAgentToOrganization } from '@/lib/vapi/agents';

export async function POST(request: NextRequest) {
    try {
        const { vapi_assistant_id, organization_id } = await request.json();

        if (!vapi_assistant_id) {
            return NextResponse.json(
                { error: 'vapi_assistant_id is required' },
                { status: 400 }
            );
        }

        const result = await assignAgentToOrganization(vapi_assistant_id, organization_id || null);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in agent assignment:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

