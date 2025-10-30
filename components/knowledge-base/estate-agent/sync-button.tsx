'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { IconRefresh, IconLoader2 } from '@tabler/icons-react'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'

interface SyncButtonProps {
  knowledgeBaseId: string
  organizationSlug: string
}

export function SyncButton({ knowledgeBaseId, organizationSlug }: SyncButtonProps) {
  const router = useRouter()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    setSyncing(true)
    try {
      const response = await fetch(
        `/api/${organizationSlug}/knowledge-bases/${knowledgeBaseId}/sync`,
        {
          method: 'POST',
        }
      )

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to start sync')
      }

      const result = await response.json()
      toast.success('Sync started successfully', {
        description: 'Properties will be updated in the background',
      })

      // Wait a bit before refreshing to allow the task to start
      setTimeout(() => {
        router.refresh()
        setSyncing(false)
      }, 2000)
    } catch (error) {
      console.error('Error syncing:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to start sync')
      setSyncing(false)
    }
  }

  return (
    <Button onClick={handleSync} disabled={syncing} variant="outline">
      {syncing ? (
        <>
          <IconLoader2 className="mr-2 size-4 animate-spin" />
          Syncing...
        </>
      ) : (
        <>
          <IconRefresh className="mr-2 size-4" />
          Sync Properties
        </>
      )}
    </Button>
  )
}

