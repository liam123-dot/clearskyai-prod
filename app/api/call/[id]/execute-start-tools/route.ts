import { after, NextRequest, NextResponse } from 'next/server';
import { executeOnCallStartTools } from '@/lib/tools/on-call-start';

/**
 * API endpoint to execute on-call-start tools for a call
 * Responds immediately and executes tools in background using after()
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: callRecordId } = await params;
    
    // Parse request body
    let body: {
      agentId?: string;
      callerNumber?: string;
      calledNumber?: string;
      controlUrl?: string;
    };
    
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Invalid JSON in request body');
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { agentId, callerNumber, calledNumber, controlUrl } = body;

    // Validate required parameters
    if (!agentId || !callerNumber || !calledNumber || !controlUrl) {
      console.error('❌ Missing required parameters');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameters: agentId, callerNumber, calledNumber, controlUrl' 
        },
        { status: 400 }
      );
    }

    console.log(`🚀 Execute start tools endpoint called for call ${callRecordId}`);
    console.log(`   Agent ID: ${agentId}`);
    console.log(`   Caller: ${callerNumber}, Called: ${calledNumber}`);

    // Execute the on-call-start tools in background using after()
    // This allows us to respond immediately while tools run asynchronously
    after(async () => {
      await executeOnCallStartTools(
        agentId,
        callRecordId,
        callerNumber,
        calledNumber,
        controlUrl
      );
    });

    // Respond immediately - tools will execute in background
    return NextResponse.json({
      success: true,
      callRecordId,
      message: 'Tool execution started in background',
    });
  } catch (error) {
    console.error('❌ Error setting up on-call-start tools execution:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to setup tool execution' 
      },
      { status: 500 }
    );
  }
}

