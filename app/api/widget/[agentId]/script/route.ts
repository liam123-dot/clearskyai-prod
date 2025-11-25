import { NextRequest, NextResponse } from "next/server"
import { getAgentById } from "@/lib/agents"
import { UnifiedAgent } from "@/lib/agents"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  
  const agent = await getAgentById(agentId) as UnifiedAgent

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }
  
  // Only support ElevenLabs agents for widget embed
  if (agent.provider !== 'elevenlabs') {
    return new NextResponse('// Widget only available for ElevenLabs agents', {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
      },
    })
  }

  const elevenLabsAgentId = agent.externalAgentId
  
  const script = `(function() {
  'use strict';
  
  // Avoid loading twice
  if (window.ClearskyWidgetLoaded) return;
  window.ClearskyWidgetLoaded = true;
  
  function createWidget() {
    // Create the ElevenLabs ConvAI widget element
    const convaiElement = document.createElement('elevenlabs-convai');
    convaiElement.setAttribute('agent-id', '${elevenLabsAgentId}');
    document.body.appendChild(convaiElement);
    
    // Load the ElevenLabs widget script
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@elevenlabs/convai-widget-embed';
    script.async = true;
    script.type = 'text/javascript';
    document.body.appendChild(script);
    
    // Expose API for customization
    window.ClearskyWidget = {
      destroy: function() {
        convaiElement.remove();
        script.remove();
        window.ClearskyWidgetLoaded = false;
      }
    };
  }
  
  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();`

  return new NextResponse(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

