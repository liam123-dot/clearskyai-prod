"use client"

import { useState } from "react"
import { Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { toast } from "sonner"

interface EmbedCodeSectionProps {
  agentId: string
  baseUrl: string
}

export function EmbedCodeSection({ agentId, baseUrl }: EmbedCodeSectionProps) {
  const [copied, setCopied] = useState(false)
  
  const scriptUrl = `${baseUrl}/api/widget/${agentId}/script`
  const embedCode = `<script src="${scriptUrl}" async></script>`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(embedCode)
      setCopied(true)
      toast.success("Embed code copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy embed code")
      console.error(error)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Embed Widget on Your Website</CardTitle>
        <CardDescription>
          Copy and paste this code into your website to add the voice assistant widget.
          A button will appear in the bottom right corner. When clicked, a compact popup opens above it.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{embedCode}</code>
          </pre>
          <Button
            variant="outline"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleCopy}
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
        </div>
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Instructions:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-2">
            <li>Copy the code above</li>
            <li>Paste it before the closing <code className="bg-muted px-1 py-0.5 rounded">&lt;/body&gt;</code> tag of your HTML</li>
            <li>A floating button will appear in the bottom right corner</li>
            <li>Users can click it to open a popup and start talking to your assistant</li>
          </ol>
        </div>
      </CardContent>
    </Card>
  )
}

