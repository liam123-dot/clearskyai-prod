'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { IconPlus, IconLoader2 } from '@tabler/icons-react'
import type { KnowledgeBaseType, ResyncSchedule } from '@/lib/knowledge-bases'

interface CreateKnowledgeBaseDialogProps {
  organizationSlug: string
}

export function CreateKnowledgeBaseDialog({ 
  organizationSlug,
}: CreateKnowledgeBaseDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [type, setType] = useState<KnowledgeBaseType>('general')
  const [forSaleUrl, setForSaleUrl] = useState('')
  const [rentalUrl, setRentalUrl] = useState('')
  const [resyncSchedule, setResyncSchedule] = useState<ResyncSchedule>('none')

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error('Please enter a name for the knowledge base')
      return
    }

    setCreating(true)
    try {
      const data: Record<string, unknown> = {}
      
      // Add estate agent specific data
      if (type === 'estate_agent') {
        if (forSaleUrl) data.for_sale_url = forSaleUrl
        if (rentalUrl) data.rental_url = rentalUrl
        data.resync_schedule = resyncSchedule
      }

      const response = await fetch(`/api/${organizationSlug}/knowledge-bases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          type,
          data,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create knowledge base')
      }

      toast.success('Knowledge base created successfully')
      
      // Reset form and close
      setName('')
      setType('general')
      setForSaleUrl('')
      setRentalUrl('')
      setResyncSchedule('none')
      setOpen(false)
      
      // Refresh the page to show the new knowledge base
      router.refresh()
    } catch (error) {
      console.error('Error creating knowledge base:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to create knowledge base')
    } finally {
      setCreating(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button>
          <IconPlus className="mr-2 size-4" />
          Create Knowledge Base
        </Button>
      </SheetTrigger>
      <SheetContent className="sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Knowledge Base</SheetTitle>
          <SheetDescription>
            Create a new knowledge base for your organization.
          </SheetDescription>
        </SheetHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="kb-name">Name</Label>
            <Input
              id="kb-name"
              placeholder="My Knowledge Base"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="kb-type">Type</Label>
            <Select value={type} onValueChange={(value) => setType(value as KnowledgeBaseType)}>
              <SelectTrigger id="kb-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general">General</SelectItem>
                <SelectItem value="estate_agent">Estate Agent</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === 'estate_agent' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="for-sale-url">For Sale URL (optional)</Label>
                <Input
                  id="for-sale-url"
                  placeholder="https://www.rightmove.co.uk/property-for-sale/..."
                  value={forSaleUrl}
                  onChange={(e) => setForSaleUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rental-url">Rental URL (optional)</Label>
                <Input
                  id="rental-url"
                  placeholder="https://www.rightmove.co.uk/property-to-rent/..."
                  value={rentalUrl}
                  onChange={(e) => setRentalUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="resync-schedule">Re-sync Schedule</Label>
                <Select 
                  value={resyncSchedule} 
                  onValueChange={(value) => setResyncSchedule(value as ResyncSchedule)}
                >
                  <SelectTrigger id="resync-schedule">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="6_hours">Every 6 hours</SelectItem>
                    <SelectItem value="12_hours">Every 12 hours</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleCreate} disabled={creating} className="w-full">
            {creating ? (
              <>
                <IconLoader2 className="mr-2 size-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Knowledge Base'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

