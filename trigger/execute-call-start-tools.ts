import { task, logger } from "@trigger.dev/sdk/v3";
import { executeOnCallStartTools } from "@/lib/tools/on-call-start";

interface ExecuteCallStartToolsPayload {
  agentId: string;
  callRecordId: string;
  callerNumber: string;
  calledNumber: string;
  controlUrl: string;
}

/**
 * Execute on-call-start tools for a call
 * Triggered when a call starts and control URL is available
 */
export const executeCallStartTools = task({
  id: "execute-call-start-tools",
  maxDuration: 60, // 60 seconds
  run: async (payload: ExecuteCallStartToolsPayload) => {
    const { agentId, callRecordId, callerNumber, calledNumber, controlUrl } = payload;

    logger.info("🎯 Starting on-call-start tools execution", {
      agentId,
      callRecordId,
      callerNumber,
      calledNumber,
      controlUrl,
    });

    try {
      await executeOnCallStartTools(
        agentId,
        callRecordId,
        callerNumber,
        calledNumber,
        controlUrl
      );

      logger.info("✅ On-call-start tools execution completed", {
        callRecordId,
      });

      return {
        success: true,
        callRecordId,
      };
    } catch (error) {
      logger.error("❌ On-call-start tools execution failed", {
        callRecordId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      // Re-throw to mark task as failed
      throw error;
    }
  },
});

