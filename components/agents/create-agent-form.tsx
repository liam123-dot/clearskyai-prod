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
  organizations?: Organization[]
  lockedOrganizationId?: string
  lockedOrganizationName?: string
}

export function CreateAgentForm({ 
  organizations = [], 
  lockedOrganizationId,
  lockedOrganizationName 
}: CreateAgentFormProps) {
  const router = useRouter()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [organizationId, setOrganizationId] = useState<string>(lockedOrganizationId || '')
  const [agentType, setAgentType] = useState<'blank' | 'demo'>('blank')
  const [demoType, setDemoType] = useState<'estate_agent' | ''>('')
  const [platform, setPlatform] = useState<'rightmove' | 'zoopla'>('rightmove')
  const [estateAgentName, setEstateAgentName] = useState('')
  const [forSaleUrl, setForSaleUrl] = useState('')
  const [rentalUrl, setRentalUrl] = useState('')

  // Auto-update agent name when estate agent name changes (for demo agents)
  const handleEstateAgentNameChange = (value: string) => {
    setEstateAgentName(value)
    if (agentType === 'demo' && demoType === 'estate_agent') {
      setName(value.trim() ? `${value.trim()} - Demo` : '')
    }
  }

  // Reset demo fields when switching agent types
  const handleAgentTypeChange = (value: 'blank' | 'demo') => {
    setAgentType(value)
    if (value === 'blank') {
      setDemoType('')
      setPlatform('rightmove')
      setEstateAgentName('')
      setForSaleUrl('')
      setRentalUrl('')
      setName('')
    } else {
      setDemoType('estate_agent')
    }
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the agent')
      return
    }

    const finalOrganizationId = lockedOrganizationId || organizationId
    if (!finalOrganizationId) {
      toast.error('Please select an organization')
      return
    }

    // Validate demo agent fields
    if (agentType === 'demo') {
      if (!demoType) {
        toast.error('Please select a demo agent type')
        return
      }
      if (demoType === 'estate_agent') {
        if (!estateAgentName.trim()) {
          toast.error('Please enter the estate agent name')
          return
        }
        if (!forSaleUrl.trim() && !rentalUrl.trim()) {
          toast.error('Please enter at least one RightMove URL (for sale or rental)')
          return
        }
      }
    }

    setCreating(true)
    try {
      const requestBody: Record<string, unknown> = {
        name: name.trim(),
        organization_id: finalOrganizationId,
        agent_type: agentType,
      }

      // Add demo-specific data
      if (agentType === 'demo') {
        requestBody.demo_type = demoType
        if (demoType === 'estate_agent') {
          requestBody.platform = platform
          requestBody.estate_agent_name = estateAgentName.trim()
          if (forSaleUrl.trim()) {
            requestBody.for_sale_url = forSaleUrl.trim()
          }
          if (rentalUrl.trim()) {
            requestBody.rental_url = rentalUrl.trim()
          }
        }
      }

      const response = await fetch('/api/admin/agents/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create agent')
      }

      const data = await response.json()
      toast.success('Agent created successfully')
      
      // Reset form
      setName('')
      setPlatform('rightmove')
      setEstateAgentName('')
      setForSaleUrl('')
      setRentalUrl('')
      setDemoType('')
      setAgentType('blank')
      if (!lockedOrganizationId) {
        setOrganizationId('')
      }
      
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
        {lockedOrganizationId ? (
          <div className="flex h-10 w-full rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
            {lockedOrganizationName || 'Organization'}
          </div>
        ) : (
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
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="agent-type">Agent Type</Label>
        <Select value={agentType} onValueChange={handleAgentTypeChange}>
          <SelectTrigger id="agent-type">
            <SelectValue placeholder="Select agent type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blank">Blank Agent</SelectItem>
            <SelectItem value="demo">Demo Agent</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground">
          {agentType === 'blank' 
            ? 'Create an agent with default settings. You can configure prompts and tools later.'
            : 'Create a demo agent with pre-configured estate agent prompts and settings.'}
        </p>
      </div>

      {agentType === 'demo' && (
        <>
          <div className="space-y-2">
            <Label htmlFor="demo-type">Demo Type</Label>
            <Select value={demoType} onValueChange={(value) => setDemoType(value as 'estate_agent')}>
              <SelectTrigger id="demo-type">
                <SelectValue placeholder="Select demo type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="estate_agent">Estate Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {demoType === 'estate_agent' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="platform">Platform</Label>
                <Select value={platform} onValueChange={(value) => setPlatform(value as 'rightmove' | 'zoopla')}>
                  <SelectTrigger id="platform">
                    <SelectValue placeholder="Select platform" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="rightmove">Rightmove</SelectItem>
                    <SelectItem value="zoopla">Zoopla</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="estate-agent-name">Estate Agent Name</Label>
                <Input
                  id="estate-agent-name"
                  placeholder="Enter estate agent name"
                  value={estateAgentName}
                  onChange={(e) => handleEstateAgentNameChange(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="for-sale-url">For Sale URL (optional)</Label>
                <Input
                  id="for-sale-url"
                  placeholder={
                    platform === 'rightmove'
                      ? "https://www.rightmove.co.uk/property-for-sale/..."
                      : "https://www.zoopla.co.uk/for-sale/property/..."
                  }
                  value={forSaleUrl}
                  onChange={(e) => setForSaleUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rental-url">Rental URL (optional)</Label>
                <Input
                  id="rental-url"
                  placeholder={
                    platform === 'rightmove'
                      ? "https://www.rightmove.co.uk/property-to-rent/..."
                      : "https://www.zoopla.co.uk/to-rent/property/..."
                  }
                  value={rentalUrl}
                  onChange={(e) => setRentalUrl(e.target.value)}
                />
              </div>
            </>
          )}
        </>
      )}

      <div className="space-y-2">
        <Label htmlFor="name">Agent Name</Label>
        <Input
          id="name"
          placeholder="Agent Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={agentType === 'demo' && demoType === 'estate_agent'}
        />
        {agentType === 'demo' && demoType === 'estate_agent' && (
          <p className="text-sm text-muted-foreground">
            Agent name is automatically set based on the estate agent name.
          </p>
        )}
      </div>

      <Button 
        onClick={handleCreate} 
        disabled={creating || !(lockedOrganizationId || organizationId)} 
        className="w-full"
      >
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

