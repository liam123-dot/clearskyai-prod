'use client';

import { TestAgentButton } from './test-agent-button';

interface TestAgentButtonWrapperProps {
  slug: string;
  agentId: string;
  assistantId: string;
}

export function TestAgentButtonWrapper({ slug, agentId, assistantId }: TestAgentButtonWrapperProps) {
  const publishableKey = process.env.NEXT_PUBLIC_VAPI_PUBLISHABLE_KEY;

  console.log('VAPI publishable key:', publishableKey);

  if (!publishableKey) {
    return null; // Silently fail if key is not available
  }

  return <TestAgentButton assistantId={assistantId} vapiPublishableKey={publishableKey} />;
}

