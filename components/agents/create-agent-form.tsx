'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { IconLoader2 } from '@tabler/icons-react'
import type { Organization } from '@/lib/organizations'

interface CreateAgentFormProps {
  organizations: Organization[]
}

export function CreateAgentForm({ organizations }: CreateAgentFormProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState<string>('')

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the agent')
      return
    }

    if (!organizationId) {
      toast.error('Please select an organization')
      return
    }

    setCreating(true)
    try {
      const response = await fetch('/api/admin/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          organization_id: organizationId,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create agent')
      }

      const data = await response.json()
      toast.success('Agent created successfully')
      
      // Reset form
      setName('')
      setOrganizationId('')
      
      // Redirect to organization's agent page
      if (data.organization_slug && data.agent_id) {
        router.push(`/${data.organization_slug}/agents/${data.agent_id}`)
      } else {
        // Fallback to admin agents page if slug not available
        router.push('/admin/agents')
      }
    } catch (error) {
      console.error('Error creating agent:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create agent')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="organization">Organization</Label>
        <Select value={organizationId} onValueChange={setOrganizationId}>
          <SelectTrigger id="organization">
            <SelectValue placeholder="Select an organization" />
          </SelectTrigger>
          <SelectContent>
            {organizations.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          placeholder="Agent Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <Button onClick={handleCreate} disabled={creating} className="w-full">
        {creating ? (
          <>
            <IconLoader2 className="mr-2 size-4 animate-spin" />
            Creating...
          </>
        ) : (
          'Create Agent'
        )}
      </Button>
    </div>
  )
}

