"use client"

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

interface AgentSuccessEvalFormProps {
  agentId: string
  slug: string
  initialSuccessEvaluationPrompt: string
  initialSummaryPrompt: string
}

export function AgentSuccessEvalForm({
  agentId,
  slug,
  initialSuccessEvaluationPrompt,
  initialSummaryPrompt,
}: AgentSuccessEvalFormProps) {
  // Baseline values (last saved state) - used for change detection
  const [baselineSuccessEvaluationPrompt, setBaselineSuccessEvaluationPrompt] = useState(initialSuccessEvaluationPrompt)
  const [baselineSummaryPrompt, setBaselineSummaryPrompt] = useState(initialSummaryPrompt)

  // Current form values
  const [successEvaluationPrompt, setSuccessEvaluationPrompt] = useState(initialSuccessEvaluationPrompt)
  const [summaryPrompt, setSummaryPrompt] = useState(initialSummaryPrompt)
  const [isSaving, setIsSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const hasChanges =
      successEvaluationPrompt !== baselineSuccessEvaluationPrompt ||
      summaryPrompt !== baselineSummaryPrompt

    if (!hasChanges) {
      toast.info('No changes to save')
      return
    }

    setIsSaving(true)

    try {
      // Build analysisPlan structure using simple format (direct string properties)
      const analysisPlan: any = {}
      
      // Add successEvaluationPrompt if changed
      if (successEvaluationPrompt !== baselineSuccessEvaluationPrompt) {
        analysisPlan.successEvaluationPrompt = successEvaluationPrompt
      }
      
      // Add summaryPrompt if changed
      if (summaryPrompt !== baselineSummaryPrompt) {
        analysisPlan.summaryPrompt = summaryPrompt
      }

      // Only include analysisPlan if there are changes
      const updatePayload: any = {}
      if (Object.keys(analysisPlan).length > 0) {
        updatePayload.analysisPlan = analysisPlan
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
      setBaselineSuccessEvaluationPrompt(successEvaluationPrompt)
      setBaselineSummaryPrompt(summaryPrompt)

      toast.success('Success & Eval settings updated successfully!')
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'An error occurred while updating the agent.'

      toast.error('Failed to update Success & Eval settings', {
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
          <CardTitle>Success Evaluation Prompt</CardTitle>
          <CardDescription>
            Configure the prompt used to evaluate whether a call was successful. This prompt determines if the call achieved its goal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="successEvaluationPrompt">Success Evaluation Prompt</Label>
            <Textarea
              id="successEvaluationPrompt"
              placeholder="Enter the success evaluation prompt..."
              value={successEvaluationPrompt}
              onChange={(e) => setSuccessEvaluationPrompt(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This prompt is used to analyze the call transcript and determine if the call was successful.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Summary Prompt</CardTitle>
          <CardDescription>
            Configure the prompt used to generate call summaries. This prompt guides how call summaries are created.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summaryPrompt">Summary Prompt</Label>
            <Textarea
              id="summaryPrompt"
              placeholder="Enter the summary prompt..."
              value={summaryPrompt}
              onChange={(e) => setSummaryPrompt(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              This prompt is used to generate concise summaries of the call transcript.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button
          type="submit"
          disabled={
            isSaving ||
            (successEvaluationPrompt === baselineSuccessEvaluationPrompt &&
              summaryPrompt === baselineSummaryPrompt)
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

