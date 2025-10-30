'use client'

import { useState, useEffect, useCallback } from "react"
import Image from 'next/image'
import { useQuery } from "@tanstack/react-query"
import { Search, Loader2, ExternalLink } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import type { AppsResponse, TokenResponse, PipedreamApp } from "@/lib/pipedream/types"

interface CredentialsDialogProps {
  slug: string
  onConnectionSuccess?: () => void
  app?: PipedreamApp // If provided, skip app search and connect directly
}

export function CredentialsDialog({ slug, onConnectionSuccess, app }: CredentialsDialogProps) {
  const [open, setOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [debouncedQuery, setDebouncedQuery] = useState("")
  const [connectToken, setConnectToken] = useState<TokenResponse | null>(null)

  const fetchConnectToken = useCallback(async () => {
    try {
      const response = await fetch(`/api/${slug}/tools/credentials/token`)
      if (!response.ok) {
        throw new Error('Failed to generate connect token')
      }
      const data: TokenResponse = await response.json()
      if (data.success) {
        setConnectToken(data)
      }
    } catch (error) {
      console.error('Error fetching connect token:', error)
      toast.error('Failed to initialize connection')
    }
  }, [slug])

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Generate token when dialog opens
  useEffect(() => {
    if (open) {
      fetchConnectToken()
    }
  }, [open, fetchConnectToken])

  // Fetch apps based on search query
  const { data: appsData, isLoading: appsLoading } = useQuery<AppsResponse>({
    queryKey: ['pipedream-apps', slug, debouncedQuery],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (debouncedQuery) {
        params.append('q', debouncedQuery)
      }
      
      const response = await fetch(`/api/${slug}/tools/credentials/apps?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch apps')
      }
      return response.json()
    },
    enabled: open, // Only fetch when dialog is open
  })

  // Handle connecting an app
  const handleConnectApp = useCallback(async (app: PipedreamApp) => {
    try {
      if (!connectToken?.connectLinkUrl) {
        throw new Error('Connection token not ready. Please try again.')
      }

      // Construct Connect URL with app slug as query parameter
      const connectUrl = new URL(connectToken.connectLinkUrl)
      connectUrl.searchParams.set('app', app.nameSlug)

      // Open Pipedream Connect in a popup window immediately
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2
      window.open(
        connectUrl.toString(),
        'pipedream-connect',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      )

      // Close the dialog
      setOpen(false)

      // Show success message
      toast.success('Opening Pipedream Connect...', {
        description: 'Complete the connection in the new window',
      })

      // Notify parent to refresh connections after a delay
      setTimeout(() => {
        onConnectionSuccess?.()
      }, 2000)
    } catch (error) {
      console.error('Error connecting app:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to connect app')
    }
  }, [connectToken, onConnectionSuccess])

  // If app is provided, connect directly when token is ready
  useEffect(() => {
    if (open && app && connectToken?.connectLinkUrl) {
      handleConnectApp(app)
    }
  }, [open, app, connectToken, handleConnectApp])

  const apps = appsData?.apps || []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Add Credential</Button>
      </DialogTrigger>
      <DialogContent className={app ? "max-w-md" : "max-w-6xl h-[700px] flex flex-col"}>
        {app ? (
          // Direct connection mode - show loading state
          <div className="flex flex-col items-center justify-center py-8">
            <DialogHeader className="mb-6">
              <DialogTitle>Connecting {app.name}</DialogTitle>
              <DialogDescription>
                Opening authentication window...
              </DialogDescription>
            </DialogHeader>
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-4">
              Please complete the authentication in the popup window
            </p>
          </div>
        ) : (
          // Search mode - show app selection UI
          <>
            <DialogHeader>
              <DialogTitle>Connect an App</DialogTitle>
              <DialogDescription>
                Search and connect apps to enable integrations for your agents
              </DialogDescription>
            </DialogHeader>

            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search apps (e.g., Google Sheets, Slack, Gmail)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Apps Grid */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {appsLoading ? (
                <div className="grid grid-cols-3 gap-3">
                  {[...Array(12)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center gap-2">
                          <Skeleton className="w-12 h-12 rounded" />
                          <Skeleton className="h-4 w-24" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : apps.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <p className="text-sm text-muted-foreground">
                    {searchQuery ? 'No apps found' : 'Start typing to search for apps'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {apps.map((appItem) => (
                    <Card
                      key={appItem.nameSlug}
                      className="hover:border-primary transition-colors cursor-pointer"
                      onClick={() => handleConnectApp(appItem)}
                    >
                      <CardContent className="p-4">
                        <div className="flex flex-col items-center gap-2 text-center">
                          {appItem.imgSrc ? (
                            <Image
                              src={appItem.imgSrc}
                              alt={appItem.name}
                              width={48}
                              height={48}
                              className="rounded object-contain"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded bg-muted flex items-center justify-center text-lg font-semibold">
                              {appItem.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div className="space-y-1">
                            <h4 className="text-sm font-medium line-clamp-2">{appItem.name}</h4>
                            <ExternalLink className="h-3 w-3 mx-auto text-muted-foreground" />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

