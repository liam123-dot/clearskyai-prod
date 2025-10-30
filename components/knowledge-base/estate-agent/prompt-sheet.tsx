"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Copy, Check, FileText } from "lucide-react"
import { toast } from "sonner"

interface PromptSheetProps {
  knowledgeBaseId: string
  knowledgeBaseName: string
}

export function PromptSheet({ knowledgeBaseId, knowledgeBaseName }: PromptSheetProps) {
  const [prompt, setPrompt] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const fetchPrompt = async () => {
    if (prompt) return // Already loaded
    
    setLoading(true)
    try {
      const response = await fetch(`/api/query/estate-agent/${knowledgeBaseId}/prompt`)
      if (!response.ok) {
        throw new Error("Failed to fetch prompt")
      }
      const data = await response.json()
      setPrompt(data.prompt)
    } catch (error) {
      toast.error("Failed to load prompt")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!prompt) return

    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      toast.success("Prompt copied to clipboard")
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      toast.error("Failed to copy prompt")
      console.error(error)
    }
  }

  useEffect(() => {
    if (open && !prompt && !loading) {
      fetchPrompt()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" onClick={fetchPrompt}>
          <FileText className="h-4 w-4 mr-2" />
          View Agent Prompt
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Voice Agent Prompt</SheetTitle>
          <SheetDescription>
            Copy this prompt to add to your voice agent configuration for {knowledgeBaseName}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              disabled={!prompt || loading}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Prompt
                </>
              )}
            </Button>
          </div>
          
          {loading ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">Loading prompt...</div>
            </div>
          ) : prompt ? (
            <div className="bg-muted rounded-lg p-4">
              <pre className="text-sm whitespace-pre-wrap font-mono overflow-x-auto">
                {prompt}
              </pre>
            </div>
          ) : (
            <div className="flex items-center justify-center p-8">
              <div className="text-sm text-muted-foreground">No prompt available</div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

