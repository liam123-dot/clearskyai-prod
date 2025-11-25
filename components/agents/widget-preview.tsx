"use client"

import { useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

interface WidgetPreviewProps {
  agentId: string
  baseUrl: string
}

export function WidgetPreview({ agentId, baseUrl }: WidgetPreviewProps) {
  useEffect(() => {
    // Load the widget script
    const script = document.createElement('script')
    script.src = `${baseUrl}/api/widget/${agentId}/script`
    script.async = true
    document.body.appendChild(script)

    // Cleanup function
    return () => {
      // Remove the script
      script.remove()
      
      // Clean up the widget if it exists
      if (window.ClearskyWidget?.destroy) {
        window.ClearskyWidget.destroy()
      }
    }
  }, [agentId, baseUrl])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live Preview</CardTitle>
        <CardDescription>
          This is how the widget will appear on your website. The voice assistant button will be in the bottom right corner.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground">
          The widget is now active on this page. Look for it in the bottom right corner.
        </div>
      </CardContent>
    </Card>
  )
}

// Extend window type for TypeScript
declare global {
  interface Window {
    ClearskyWidget?: {
      destroy: () => void
    }
    ClearskyWidgetLoaded?: boolean
  }
}

