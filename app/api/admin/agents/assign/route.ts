import { NextRequest, NextResponse } from 'next/server';
import { assignAgentToOrganization } from '@/lib/agents';

export async function POST(request: NextRequest) {
    try {
        const { external_agent_id, organization_id } = await request.json();

        if (!external_agent_id) {
            return NextResponse.json(
                { error: 'external_agent_id is required' },
                { status: 400 }
            );
        }

        const result = await assignAgentToOrganization(external_agent_id, organization_id || null);

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error in agent assignment:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        );
    }
}

