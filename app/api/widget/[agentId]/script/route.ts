import { NextRequest, NextResponse } from "next/server"
import { getAgentById } from "@/lib/vapi/agents"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params
  
  const agent = await getAgentById(agentId)

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const widgetUrl = `${baseUrl}/widget/${agentId}`
  
  const script = `(function() {
  'use strict';
  
  // Avoid loading twice
  if (window.ClearskyWidgetLoaded) return;
  window.ClearskyWidgetLoaded = true;
  
  // Configuration
  const WIDGET_URL = '${widgetUrl}';
  
  function createWidget() {
    // Create styles
    const style = document.createElement('style');
    style.textContent = 
      '#clearsky-widget-container {' +
        'position: fixed;' +
        'bottom: 20px;' +
        'right: 20px;' +
        'width: 250px;' +
        'height: 80px;' +
        'z-index: 9999;' +
        'border: none;' +
        'overflow: visible;' +
      '}' +
      '#clearsky-widget-iframe {' +
        'width: 100%;' +
        'height: 100%;' +
        'border: none;' +
        'display: block;' +
        'background: transparent;' +
        'overflow: visible;' +
      '}';
    document.head.appendChild(style);
    
    // Create container
    const container = document.createElement('div');
    container.id = 'clearsky-widget-container';
    
    // Create iframe
    const iframe = document.createElement('iframe');
    iframe.id = 'clearsky-widget-iframe';
    iframe.src = WIDGET_URL;
    iframe.setAttribute('allow', 'microphone');
    iframe.setAttribute('aria-label', 'Voice chat widget');
    
    container.appendChild(iframe);
    
    // Append to body
    document.body.appendChild(container);
    
    // Expose API for customization
    window.ClearskyWidget = {
      destroy: function() {
        container.remove();
        style.remove();
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

