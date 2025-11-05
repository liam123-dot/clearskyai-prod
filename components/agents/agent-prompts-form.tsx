"use client"

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'
import { IdleMessagesForm } from './idle-messages-form'

interface AgentPromptsFormProps {
  agentId: string
  slug: string
  initialPrompt: string
  initialFirstMessage: string
  initialIdleMessages: string[]
  initialIdleTimeoutSeconds: number
}

export function AgentPromptsForm({
  agentId,
  slug,
  initialPrompt,
  initialFirstMessage,
  initialIdleMessages,
  initialIdleTimeoutSeconds,
}: AgentPromptsFormProps) {
  // Baseline values (last saved state) - used for change detection
  const [baselineFirstMessage, setBaselineFirstMessage] = useState(initialFirstMessage)
  const [baselinePrompt, setBaselinePrompt] = useState(initialPrompt)
  const [baselineIdleMessages, setBaselineIdleMessages] = useState(initialIdleMessages)
  const [baselineIdleTimeoutSeconds, setBaselineIdleTimeoutSeconds] = useState(initialIdleTimeoutSeconds)

  // Current form values
  const [firstMessage, setFirstMessage] = useState(initialFirstMessage)
  const [prompt, setPrompt] = useState(initialPrompt)
  const [idleMessages, setIdleMessages] = useState<string[]>(initialIdleMessages)
  const [idleTimeoutSeconds, setIdleTimeoutSeconds] = useState<number>(initialIdleTimeoutSeconds)
  const [isSaving, setIsSaving] = useState(false)

  const handleIdleMessagesChange = (messages: string[], timeout: number) => {
    setIdleMessages(messages)
    setIdleTimeoutSeconds(timeout)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Check if idle messages have changed
    const idleMessagesChanged = 
      JSON.stringify(idleMessages) !== JSON.stringify(baselineIdleMessages) ||
      idleTimeoutSeconds !== baselineIdleTimeoutSeconds

    const hasChanges =
      firstMessage !== baselineFirstMessage ||
      prompt !== baselinePrompt ||
      idleMessagesChanged

    if (!hasChanges) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)

    try {
      const updatePayload: any = {
        firstMessage: firstMessage !== baselineFirstMessage ? firstMessage : undefined,
        prompt: prompt !== baselinePrompt ? prompt : undefined,
      }

      // Add messagePlan if idle messages changed
      if (idleMessagesChanged) {
        updatePayload.messagePlan = {
          idleMessages,
          idleTimeoutSeconds,
        }
      }

      // Remove undefined fields
      Object.keys(updatePayload).forEach(key => {
        if (updatePayload[key] === undefined) {
          delete updatePayload[key]
        }
      })

      const response = await fetch(`/api/${slug}/agents/${agentId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatePayload),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update agent')
      }

      // Optimistic update: update baseline values to current values
      setBaselineFirstMessage(firstMessage)
      setBaselinePrompt(prompt)
      setBaselineIdleMessages(idleMessages)
      setBaselineIdleTimeoutSeconds(idleTimeoutSeconds)

      toast.success('Agent prompts updated successfully!')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while updating the agent.'

      toast.error('Failed to update agent prompts', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle>First Message</CardTitle>
          <CardDescription>
            Configure the first message that the agent will say when a call starts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="firstMessage">First Message</Label>
            <Textarea
              id="firstMessage"
              placeholder="Enter the first message..."
              value={firstMessage}
              onChange={(e) => setFirstMessage(e.target.value)}
              className="min-h-[100px]"
            />
            <p className="text-xs text-muted-foreground">
              This is the initial greeting message that will be spoken when a call begins.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Prompt</CardTitle>
          <CardDescription>
            Configure the system message that guides the agent's behavior and responses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Enter the system prompt..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[300px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This prompt defines how the agent behaves and responds to users.
            </p>
          </div>
        </CardContent>
      </Card>

      <IdleMessagesForm
        initialIdleMessages={initialIdleMessages}
        initialIdleTimeoutSeconds={initialIdleTimeoutSeconds}
        onChange={handleIdleMessagesChange}
      />

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={
            isSaving ||
            (firstMessage === baselineFirstMessage &&
              prompt === baselinePrompt &&
              JSON.stringify(idleMessages) === JSON.stringify(baselineIdleMessages) &&
              idleTimeoutSeconds === baselineIdleTimeoutSeconds)
          }
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  )
}

