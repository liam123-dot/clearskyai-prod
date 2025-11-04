import { NextRequest, NextResponse } from 'next/server';
import { executeOnCallStartTools } from '@/lib/tools/on-call-start';

/**
 * API endpoint to execute on-call-start tools for a call
 * Called asynchronously from the incoming call route
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callRecordId } = await params;
    const body = await request.json();

    const { agentId, callerNumber, calledNumber, controlUrl } = body;

    // Validate required parameters
    if (!agentId || !callRecordId || !callerNumber || !calledNumber || !controlUrl) {
      console.error('❌ Missing required parameters for execute-start-tools');
      console.error(`   Received:`, { agentId, callRecordId, callerNumber, calledNumber, controlUrl: controlUrl ? 'present' : 'missing' });
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    console.log(`🎯 Execute-start-tools endpoint called for call ${callRecordId}`);
    console.log(`   Agent ID: ${agentId}`);
    console.log(`   Caller: ${callerNumber}, Called: ${calledNumber}`);
    console.log(`   Control URL: ${controlUrl}`);

    // Execute tools synchronously - await completion to keep execution context alive
    // This endpoint is called with fire-and-forget from incoming route, so waiting here
    // doesn't block the TwiML response
    await executeOnCallStartTools(
      agentId,
      callRecordId,
      callerNumber,
      calledNumber,
      controlUrl
    );

    console.log(`✅ Execute-start-tools completed for call ${callRecordId}`);
    return NextResponse.json(
      { success: true, message: 'Tool execution completed' },
      { status: 200 }
    );
  } catch (error) {
    console.error('❌ Error in execute-start-tools endpoint:', error);
    console.error(`   Error type: ${error instanceof Error ? error.constructor.name : typeof error}`);
    console.error(`   Error message: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`   Stack trace:`, error.stack);
    }
    
    // Still return 200 to avoid retries from the caller
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 200 }
    );
  }
}

