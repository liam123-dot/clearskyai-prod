import { executeOnCallStartTools } from '@/lib/tools/on-call-start';

interface ExecuteCallStartToolsParams {
  agentId: string;
  callRecordId: string;
  callerNumber: string;
  calledNumber: string;
  controlUrl: string;
}

/**
 * Durable workflow to execute on-call-start tools
 * Uses Vercel Workflows for automatic retries and resumability
 */
export async function executeCallStartToolsWorkflow(params: ExecuteCallStartToolsParams) {
  'use workflow';

  const { agentId, callRecordId, callerNumber, calledNumber, controlUrl } = params;

  console.log(`🎯 Starting workflow for call ${callRecordId}`);
  console.log(`   Agent ID: ${agentId}`);
  console.log(`   Caller: ${callerNumber}, Called: ${calledNumber}`);
  console.log(`   Control URL: ${controlUrl}`);

  // Execute the on-call-start tools
  // This function already handles all the logic including:
  // - Database queries
  // - Tool execution
  // - Context injection
  await executeOnCallStartTools(
    agentId,
    callRecordId,
    callerNumber,
    calledNumber,
    controlUrl
  );

  console.log(`✅ Workflow completed for call ${callRecordId}`);

  return {
    success: true,
    callRecordId,
  };
}

