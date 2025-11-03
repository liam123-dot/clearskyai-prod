"use client"

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ToolConfig, ToolDatabaseRecord } from '@/lib/tools/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
// import { SmsToolForm } from '@/components/tools/sms-tool-form'
// import { TransferCallToolForm } from '@/components/tools/transfer-call-tool-form'
import { PipedreamActionToolForm } from '@/components/tools/pipedream-action-tool-form'
import { Trash2 } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

interface EditToolFormProps {
  tool: ToolDatabaseRecord
  slug: string
}

export function EditToolForm({ tool, slug }: EditToolFormProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Tool metadata
  const [label, setLabel] = useState(tool.label || '')
  const [description, setDescription] = useState(tool.description || '')
  const [async, setAsync] = useState(tool.async || false)
  const [executeOnCallStart, setExecuteOnCallStart] = useState(tool.execute_on_call_start || false)
  // attach_to_agent defaults to true, can only be false if execute_on_call_start is true
  // If execute_on_call_start is false, attach_to_agent must be true
  const [attachToAgent, setAttachToAgent] = useState(
    tool.execute_on_call_start ? (tool.attach_to_agent !== false) : true
  )

  // If executeOnCallStart is disabled, force attachToAgent to true
  const handleExecuteOnCallStartChange = (checked: boolean) => {
    setExecuteOnCallStart(checked)
    if (!checked) {
      setAttachToAgent(true)
    }
  }

  // Type-specific configuration
  const [toolConfig, setToolConfig] = useState<ToolConfig | null>(
    tool.config_metadata as ToolConfig | null
  )

  const handleToolConfigChange = useCallback((config: ToolConfig) => {
    // Merge with current label and description
    setToolConfig(config)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!label.trim()) {
      toast.error('Please enter a tool name')
      return
    }

    if (!description.trim()) {
      toast.error('Please enter a tool description')
      return
    }

    if (!toolConfig) {
      toast.error('Tool configuration is missing')
      return
    }

    setIsSubmitting(true)

    try {
      // Final config with updated label, description, async, execute_on_call_start, and attach_to_agent
      // Ensure attach_to_agent is true if execute_on_call_start is false
      const finalConfig: ToolConfig = {
        ...toolConfig,
        label: label.trim(),
        description: description.trim(),
        async,
        execute_on_call_start: executeOnCallStart,
        attach_to_agent: executeOnCallStart ? attachToAgent : true,
      }

      const response = await fetch(`/api/${slug}/tools/${tool.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalConfig),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update tool')
      }

      toast.success('Tool updated successfully!', {
        description: `${label} has been updated.`,
      })

      // Refresh the page to show updated data
      router.refresh()
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while updating the tool.'

      toast.error('Failed to update tool', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)

    try {
      const response = await fetch(`/api/${slug}/tools/${tool.id}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete tool')
      }

      toast.success('Tool deleted successfully')

      // Redirect to tools list
      router.push(`/${slug}/tools`)
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while deleting the tool.'

      toast.error('Failed to delete tool', {
        description: errorMessage,
      })
      console.error(error)
    } finally {
      setIsDeleting(false)
    }
  }

  if (!toolConfig) {
    return (
      <div className="max-w-4xl">
        <p className="text-sm text-muted-foreground">
          This tool was created with an older version and cannot be edited.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      {/* Tool Information */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Tool Information</CardTitle>
              <CardDescription>Configure your tool settings</CardDescription>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm" disabled={isDeleting} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete the tool &quot;{label}&quot;. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tool Type</Label>
              <p className="text-sm">
                {toolConfig.type === 'sms' && 'SMS / Text Message'}
                {toolConfig.type === 'transfer_call' && 'Transfer Call'}
                {toolConfig.type === 'api_request' && 'API Request'}
                {toolConfig.type === 'pipedream_action' && 'External App'}
              </p>
              <p className="text-xs text-muted-foreground">Type cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="label">Tool Name *</Label>
              <Input
                id="label"
                placeholder="e.g., Send Order Confirmation SMS"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Tool Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe when and how the AI agent should use this tool..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
              required
            />
            <p className="text-xs text-muted-foreground">
              Explain to the agent when and how to use this tool
            </p>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="async" className="text-sm font-medium cursor-pointer">
                Don&apos;t Wait for Response
              </Label>
              <p className="text-xs text-muted-foreground">
                The agent will continue the conversation immediately without waiting for this tool to finish
              </p>
            </div>
            <Switch
              id="async"
              checked={async}
              onCheckedChange={setAsync}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="execute-on-call-start" className="text-sm font-medium cursor-pointer">
                Execute on Call Start
              </Label>
              <p className="text-xs text-muted-foreground">
                Run this tool automatically when a call starts (ideal for CRM lookups that inject customer context)
              </p>
            </div>
            <Switch
              id="execute-on-call-start"
              checked={executeOnCallStart}
              onCheckedChange={handleExecuteOnCallStartChange}
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div className="space-y-0.5">
              <Label htmlFor="attach-to-agent" className="text-sm font-medium cursor-pointer">
                Allow Agent Attachment
              </Label>
              <p className="text-xs text-muted-foreground">
                {!executeOnCallStart
                  ? "Tool can be attached to agents and used during conversations (always enabled when 'Execute on Call Start' is disabled)"
                  : attachToAgent 
                    ? "Tool can be attached to agents and used during conversations"
                    : "Tool only runs preemptively (on call start), cannot be attached to agents"}
              </p>
            </div>
            <Switch
              id="attach-to-agent"
              checked={attachToAgent}
              onCheckedChange={setAttachToAgent}
              disabled={!executeOnCallStart}
            />
          </div>

          {/* Type-Specific Configuration - Integrated */}
          <div className="pt-4 border-t">
            {toolConfig.type === 'sms' && (
              <div className="text-sm text-muted-foreground">SMS Tool Form - Coming soon</div>
            )}

            {toolConfig.type === 'transfer_call' && (
              <div className="text-sm text-muted-foreground">Transfer Call Tool Form - Coming soon</div>
            )}

            {toolConfig.type === 'pipedream_action' && (
              <PipedreamActionToolForm
                slug={slug}
                initialData={{ ...toolConfig, label, description }}
                onChange={handleToolConfigChange}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit Button */}
      <div className="flex gap-3 pt-4 border-t">
        <Button type="submit" disabled={isSubmitting} size="lg">
          {isSubmitting ? 'Saving Changes...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.push(`/${slug}/tools`)}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}

