"use client"

import { useState, useEffect } from 'react'
import { HandoffToolConfig } from '@/lib/tools/types'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, AlertCircle } from 'lucide-react'

interface HandoffToolFormProps {
  initialData?: Partial<HandoffToolConfig>
  onChange: (config: HandoffToolConfig) => void
  slug: string
}

interface Agent {
  id: string
  vapi_assistant_id: string
  vapiAssistant?: {
    name?: string
  }
}

export function HandoffToolForm({ initialData, onChange, slug }: HandoffToolFormProps) {
  const [assistantId, setAssistantId] = useState(initialData?.assistantId || '')
  const [assistantName, setAssistantName] = useState(initialData?.assistantName || '')
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Fetch agents on mount
  useEffect(() => {
    const fetchAgents = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await fetch(`/api/${slug}/agents`)
        if (!response.ok) {
          throw new Error('Failed to load agents')
        }
        const data = await response.json()
        
        // API returns array directly, not wrapped in { agents: [...] }
        const agentsList = Array.isArray(data) ? data : []
        setAgents(agentsList)
        
        // If there's only one agent and no initial data, select it automatically
        if (agentsList.length === 1 && !initialData?.assistantId) {
          setAssistantId(agentsList[0].vapi_assistant_id)
          setAssistantName(agentsList[0].vapiAssistant?.name || 'Agent')
        }
      } catch (err) {
        console.error('Error fetching agents:', err)
        setError(err instanceof Error ? err.message : 'Failed to load agents')
      } finally {
        setLoading(false)
      }
    }

    fetchAgents()
  }, [slug, initialData?.assistantId])

  // Emit config whenever values change
  useEffect(() => {
    if (assistantId) {
      const config: HandoffToolConfig = {
        type: 'handoff',
        label: initialData?.label || '',
        description: initialData?.description || '',
        assistantId,
        assistantName,
      }
      onChange(config)
    }
  }, [assistantId, assistantName, initialData?.label, initialData?.description, onChange])

  const handleAssistantChange = (value: string) => {
    setAssistantId(value)
    const selectedAgent = agents.find((a) => a.vapi_assistant_id === value)
    if (selectedAgent) {
      setAssistantName(selectedAgent.vapiAssistant?.name || 'Agent')
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Assistant Selector */}
          <div className="space-y-2">
            <Label htmlFor="assistant">Target Assistant *</Label>
            {loading ? (
              <div className="flex items-center gap-2 p-3 border rounded-lg bg-muted/50">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Loading agents...</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-3 border border-destructive/20 rounded-lg bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <span className="text-sm text-destructive">{error}</span>
              </div>
            ) : agents.length === 0 ? (
              <div className="flex items-center gap-2 p-3 border border-yellow-500/20 rounded-lg bg-yellow-500/10">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-yellow-700">
                  No agents found. Please create an agent first.
                </span>
              </div>
            ) : (
              <Select value={assistantId} onValueChange={handleAssistantChange}>
                <SelectTrigger id="assistant">
                  <SelectValue placeholder="Select an assistant to hand off to..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.vapi_assistant_id}>
                      <div className="flex flex-col items-start">
                        <div className="font-medium">{agent.vapiAssistant?.name || 'Unnamed Agent'}</div>
                        <div className="text-xs text-muted-foreground">{agent.vapi_assistant_id}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <CardDescription>
              Select which assistant should receive the handoff. The conversation history will be
              transferred to them.
            </CardDescription>
          </div>

          {/* Info box */}
          <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm">
            <p className="text-blue-700 dark:text-blue-300">
              <strong>Note:</strong> The handoff tool transfers the conversation to another AI
              assistant in your organization. The conversation history is preserved using rolling
              history mode.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

